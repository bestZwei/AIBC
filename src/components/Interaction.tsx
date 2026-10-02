'use client';

import { useState } from 'react';
import { useRadioStore } from '@/stores/useRadioStore';

export function Interaction() {
  const [text, setText] = useState('');
  const submitInteraction = useRadioStore((s) => s.submitInteraction);
  const pendingUserInput = useRadioStore((s) => s.pendingUserInput);

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setText('');
    await submitInteraction(trimmed);
  };

  return (
    <section className="rounded-2xl border border-border bg-bg-elevated p-4">
      <h2 className="mb-2 text-sm font-medium text-fg">插话</h2>
      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          maxLength={500}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
          }}
          placeholder="向主播提个问题，下一段会优先回应…"
          className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-accent focus:outline-none"
          aria-label="听众留言"
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!text.trim()}
          className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg transition-opacity disabled:opacity-40"
        >
          发送
        </button>
      </div>
      {pendingUserInput && (
        <p className="mt-2 text-xs text-fg-muted">
          待回应：<span className="text-accent">{pendingUserInput}</span>
        </p>
      )}
    </section>
  );
}
