'use client';

import { audioEngine } from '@/lib/audio/engine';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { useRadioStore } from '@/stores/useRadioStore';
import { Visualizer } from './Visualizer';

export function Player() {
  const status = usePlayerStore((s) => s.status);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const volume = usePlayerStore((s) => s.volume);
  const currentMeta = usePlayerStore((s) => s.currentMeta);
  const bufferedCount = usePlayerStore((s) => s.bufferedCount);
  const errorMessage = usePlayerStore((s) => s.errorMessage);

  const togglePlay = useRadioStore((s) => s.togglePlay);
  const stop = useRadioStore((s) => s.stop);
  const retry = useRadioStore((s) => s.retry);

  const onAir = status === 'playing';

  const handleVolume = (value: number) => {
    audioEngine.setVolume(value);
  };

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-bg-elevated p-5">
      <div className="flex items-center justify-between">
        <div
          className={[
            'flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold tracking-widest',
            onAir ? 'bg-on-air/15 text-on-air' : 'bg-border/50 text-fg-muted',
          ].join(' ')}
          aria-live="polite"
        >
          <span
            className={[
              'h-2 w-2 rounded-full',
              onAir ? 'on-air-dot bg-on-air' : 'bg-fg-muted',
            ].join(' ')}
          />
          {onAir ? 'ON AIR' : status === 'buffering' ? 'BUFFERING' : 'OFF AIR'}
        </div>
        <span className="text-xs text-fg-muted">缓冲 {bufferedCount} 段</span>
      </div>

      <Visualizer />

      <div className="min-h-[4.5rem]">
        <p className="text-sm font-medium text-fg">{currentMeta?.title ?? '未在播放'}</p>
        <p className="mt-1 line-clamp-3 text-sm text-fg-muted">
          {currentMeta?.text ?? '选择一个频道，点击播放，让 AI 为你开播。'}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void togglePlay()}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-lg text-accent-fg transition-transform hover:scale-105 active:scale-95"
          aria-label={isPlaying ? '暂停' : '播放'}
        >
          {isPlaying ? '❚❚' : '▶'}
        </button>
        <button
          type="button"
          onClick={stop}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-fg-muted transition-colors hover:text-fg"
          aria-label="停止"
        >
          ■
        </button>

        <label className="ml-auto flex items-center gap-2 text-fg-muted">
          <span className="text-xs" aria-hidden>
            🔊
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => handleVolume(Number(e.target.value))}
            className="h-1 w-32 cursor-pointer accent-[var(--accent)]"
            aria-label="音量"
          />
        </label>
      </div>

      {status === 'error' && errorMessage && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-on-air/40 bg-on-air/10 px-3 py-2 text-sm text-on-air">
          <span className="truncate">{errorMessage}</span>
          <button
            type="button"
            onClick={() => void retry()}
            className="shrink-0 rounded-md border border-on-air/50 px-2 py-1 text-xs hover:bg-on-air/20"
          >
            重试
          </button>
        </div>
      )}
    </section>
  );
}
