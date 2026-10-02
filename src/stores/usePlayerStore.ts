import { create } from 'zustand';
import type { SegmentMeta } from '@/lib/radio/types';
import type { EngineState } from '@/lib/audio/engine';

export type PlayerStatus = 'idle' | 'buffering' | 'playing' | 'paused' | 'error';
export type Theme = 'dark' | 'light';

interface PlayerState {
  status: PlayerStatus;
  isPlaying: boolean;
  bufferedCount: number;
  currentMeta: SegmentMeta | null;
  volume: number;
  theme: Theme;
  errorMessage: string | null;

  syncFromEngine: (state: EngineState) => void;
  setStatus: (status: PlayerStatus) => void;
  setVolume: (volume: number) => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setError: (message: string | null) => void;
}

const initialTheme: Theme =
  typeof window !== 'undefined' && window.localStorage.getItem('aibc-theme') === 'light'
    ? 'light'
    : 'dark';

export const usePlayerStore = create<PlayerState>((set, get) => ({
  status: 'idle',
  isPlaying: false,
  bufferedCount: 0,
  currentMeta: null,
  volume: 0.8,
  theme: initialTheme,
  errorMessage: null,

  syncFromEngine: (state) =>
    set({
      isPlaying: state.isPlaying,
      bufferedCount: state.bufferedCount,
      currentMeta: state.currentMeta,
      volume: state.volume,
      // 引擎真正在出声时才切到 playing；否则保留 buffering/paused/error/idle。
      status: state.isPlaying ? 'playing' : get().status === 'playing' ? 'paused' : get().status,
    }),

  setStatus: (status) =>
    set({ status, errorMessage: status === 'error' ? get().errorMessage : null }),
  setVolume: (volume) => set({ volume }),
  setTheme: (theme) => {
    if (typeof window !== 'undefined') window.localStorage.setItem('aibc-theme', theme);
    set({ theme });
  },
  toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
  setError: (message) => set({ errorMessage: message, status: message ? 'error' : get().status }),
}));
