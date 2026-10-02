'use client';

import { getStationById } from '@/lib/radio/stations';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { useRadioStore } from '@/stores/useRadioStore';

const STATUS_LABEL: Record<string, string> = {
  idle: '待机',
  buffering: '缓冲中',
  playing: '播放中',
  paused: '已暂停',
  error: '出错',
};

export function StatusBar() {
  const stationId = useRadioStore((s) => s.stationId);
  const historyLength = useRadioStore((s) => s.history.length);
  const status = usePlayerStore((s) => s.status);
  const station = getStationById(stationId);

  return (
    <footer className="flex items-center justify-between gap-3 rounded-xl border border-border bg-bg-elevated px-4 py-2 text-xs text-fg-muted">
      <span className="truncate">{station ? `${station.icon} ${station.name}` : '未选择频道'}</span>
      <span className="shrink-0">
        {STATUS_LABEL[status] ?? status} · 已播 {historyLength} 段
      </span>
    </footer>
  );
}
