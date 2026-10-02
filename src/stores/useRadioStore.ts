import { create } from 'zustand';
import { audioEngine } from '@/lib/audio/engine';
import { fetchSegment, fetchTts } from '@/lib/api';
import { createMemory } from '@/lib/radio/prompt';
import { appendHistory, decideNextSegmentType } from '@/lib/radio/scheduler';
import { DEFAULT_STATION_ID, getStationById } from '@/lib/radio/stations';
import { chunkText } from '@/lib/radio/text';
import type { ContextMemory, SegmentMeta, SegmentType, Station } from '@/lib/radio/types';
import { usePlayerStore } from './usePlayerStore';

/** 期望缓冲的音频片段数；低于此值时预取下一段。 */
const BUFFER_TARGET = 3;
/** 单段文本切块大小（字符）。 */
const CHUNK_SIZE = 400;

interface RadioState {
  stationId: string;
  history: SegmentType[];
  memory: ContextMemory;
  pendingUserInput: string | null;
  looping: boolean;
  pumping: boolean;

  selectStation: (id: string) => void;
  start: () => Promise<void>;
  togglePlay: () => Promise<void>;
  stop: () => void;
  submitInteraction: (text: string) => Promise<void>;
  retry: () => Promise<void>;
  pump: () => Promise<void>;
}

function currentStation(stationId: string): Station | null {
  return getStationById(stationId) ?? null;
}

export const useRadioStore = create<RadioState>((set, get) => {
  /** 生成一段内容并入队（可能拆成多个音频片段）。 */
  async function generateOne(): Promise<void> {
    const { stationId, history, memory, pendingUserInput } = get();
    const station = currentStation(stationId);
    if (!station) return;

    const segmentType = decideNextSegmentType(station, history, {
      hasPendingUserInput: pendingUserInput !== null,
    });
    const userInput =
      segmentType === 'userInteraction' ? (pendingUserInput ?? undefined) : undefined;

    const player = usePlayerStore.getState();
    player.setStatus('buffering');

    const segment = await fetchSegment({ stationId, segmentType, memory, userInput });

    // 更新电台大脑状态：历史、上下文记忆、清空已消费的互动。
    set({
      history: appendHistory(history, segmentType),
      memory: segment.memory,
      pendingUserInput: segmentType === 'userInteraction' ? null : get().pendingUserInput,
    });

    const chunks = chunkText(segment.text, CHUNK_SIZE);
    for (const chunk of chunks) {
      const audio = await fetchTts({ text: chunk, voice: station.voice });
      const buffer = await audioEngine.decode(audio);
      const meta: SegmentMeta = {
        stationId,
        segmentType,
        title: segment.title,
        text: chunk,
      };
      audioEngine.enqueue(buffer, meta);
    }
  }

  async function pump(): Promise<void> {
    if (get().pumping) return;
    set({ pumping: true });
    const player = usePlayerStore.getState();
    try {
      while (get().looping && audioEngine.bufferedCount < BUFFER_TARGET) {
        await generateOne();
      }
      player.setError(null);
    } catch (err) {
      // 生成失败：停止循环避免风暴式重试，交由用户手动 retry。
      set({ looping: false });
      player.setError(err instanceof Error ? err.message : '生成失败，请重试');
    } finally {
      set({ pumping: false });
    }
  }

  return {
    stationId: DEFAULT_STATION_ID,
    history: [],
    memory: createMemory(),
    pendingUserInput: null,
    looping: false,
    pumping: false,

    selectStation: (id) => {
      const wasLooping = get().looping;
      audioEngine.stop();
      set({
        stationId: id,
        history: [],
        memory: createMemory(),
        pendingUserInput: null,
        looping: false,
      });
      usePlayerStore.getState().setStatus('idle');
      usePlayerStore.getState().setError(null);
      if (wasLooping) void get().start();
    },

    start: async () => {
      set({ looping: true });
      usePlayerStore.getState().setError(null);
      audioEngine.onDrained = () => void pump();
      await audioEngine.play();
      await pump();
    },

    togglePlay: async () => {
      const { isPlaying } = usePlayerStore.getState();
      if (isPlaying) {
        await audioEngine.pause();
      } else {
        if (!get().looping) {
          await get().start();
        } else {
          await audioEngine.resume();
          void pump();
        }
      }
    },

    stop: () => {
      set({ looping: false });
      audioEngine.stop();
      usePlayerStore.getState().setStatus('idle');
    },

    submitInteraction: async (text) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      set({ pendingUserInput: trimmed });
      // 若正在播放，尽快让下一段优先回应；否则不主动启动。
      if (get().looping) await pump();
    },

    retry: async () => {
      set({ looping: true });
      usePlayerStore.getState().setError(null);
      await audioEngine.resume();
      await pump();
    },

    pump,
  };
});
