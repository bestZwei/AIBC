'use client';

import { useEffect } from 'react';
import { usePlayerStore } from '@/stores/usePlayerStore';

export function ThemeToggle() {
  const theme = usePlayerStore((s) => s.theme);
  const toggleTheme = usePlayerStore((s) => s.toggleTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="切换主题"
      className="rounded-full border border-border bg-bg-elevated px-3 py-1.5 text-sm text-fg-muted transition-colors hover:text-fg"
    >
      {theme === 'dark' ? '🌙' : '☀️'}
    </button>
  );
}
