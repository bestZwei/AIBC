'use client';

import { PRESET_STATIONS } from '@/lib/radio/stations';
import { useRadioStore } from '@/stores/useRadioStore';

export function StationList() {
  const stationId = useRadioStore((s) => s.stationId);
  const selectStation = useRadioStore((s) => s.selectStation);

  return (
    <nav aria-label="频道列表" className="flex flex-col gap-2">
      {PRESET_STATIONS.map((station) => {
        const active = station.id === stationId;
        return (
          <button
            key={station.id}
            type="button"
            onClick={() => selectStation(station.id)}
            aria-current={active}
            className={[
              'flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
              active
                ? 'border-accent bg-accent/10 text-fg'
                : 'border-border bg-bg-elevated text-fg-muted hover:text-fg',
            ].join(' ')}
          >
            <span className="text-2xl leading-none" aria-hidden>
              {station.icon}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{station.name}</span>
              <span className="block truncate text-xs opacity-70">{station.description}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
