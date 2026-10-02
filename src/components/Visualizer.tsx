'use client';

import { useEffect, useRef } from 'react';
import { audioEngine } from '@/lib/audio/engine';
import { usePlayerStore } from '@/stores/usePlayerStore';

const BAR_COUNT = 48;

export function Visualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    };
    resize();
    window.addEventListener('resize', resize);

    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();

    const draw = () => {
      frame = requestAnimationFrame(draw);
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const data = audioEngine.getFrequencyData();
      const gap = 2 * dpr;
      const barWidth = (width - gap * (BAR_COUNT - 1)) / BAR_COUNT;

      for (let i = 0; i < BAR_COUNT; i++) {
        // 频谱数据可能为空（未初始化）；退化为一条基线。
        const value =
          data.length > 0 ? data[Math.floor((i / BAR_COUNT) * data.length)] / 255 : 0.02;
        const barHeight = Math.max(2 * dpr, value * height);
        const x = i * (barWidth + gap);
        const y = (height - barHeight) / 2;
        ctx.fillStyle = accent || '#6d86ff';
        ctx.globalAlpha = 0.35 + value * 0.65;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, barWidth / 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    draw();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, [isPlaying]);

  return <canvas ref={canvasRef} className="h-24 w-full" aria-hidden />;
}
