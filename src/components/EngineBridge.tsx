'use client';

import { useEffect } from 'react';
import { audioEngine } from '@/lib/audio/engine';
import { usePlayerStore } from '@/stores/usePlayerStore';

/**
 * 把音频引擎的传输状态同步进 player store（单一订阅点）。
 * 无 UI 渲染。
 */
export function EngineBridge() {
  useEffect(() => {
    const unsubscribe = audioEngine.subscribe((state) => {
      usePlayerStore.getState().syncFromEngine(state);
    });
    return unsubscribe;
  }, []);

  return null;
}
