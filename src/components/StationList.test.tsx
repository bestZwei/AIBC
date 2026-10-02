import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { StationList } from './StationList';
import { PRESET_STATIONS } from '@/lib/radio/stations';
import { useRadioStore } from '@/stores/useRadioStore';

afterEach(() => {
  cleanup();
  useRadioStore.setState({ stationId: PRESET_STATIONS[0].id });
});

describe('StationList', () => {
  it('渲染全部预设频道', () => {
    render(<StationList />);
    for (const station of PRESET_STATIONS) {
      expect(screen.getByText(station.name)).toBeInTheDocument();
    }
    expect(screen.getAllByRole('button')).toHaveLength(PRESET_STATIONS.length);
  });

  it('点击频道会切换 store 中的当前频道', async () => {
    const user = userEvent.setup();
    render(<StationList />);
    const story = PRESET_STATIONS.find((s) => s.id === 'story')!;
    await user.click(screen.getByText(story.name));
    expect(useRadioStore.getState().stationId).toBe('story');
  });
});
