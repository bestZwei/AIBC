import { EngineBridge } from '@/components/EngineBridge';
import { Interaction } from '@/components/Interaction';
import { Player } from '@/components/Player';
import { StationList } from '@/components/StationList';
import { StatusBar } from '@/components/StatusBar';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function Home() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6">
      <EngineBridge />

      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-fg">AIBC</h1>
          <p className="text-sm text-fg-muted">你的个人 AI 电台 · 连续 · 被动 · 可插话</p>
        </div>
        <ThemeToggle />
      </header>

      <main className="grid flex-1 grid-cols-1 gap-6 md:grid-cols-[260px_1fr]">
        <aside className="flex flex-col gap-4">
          <h2 className="text-sm font-medium text-fg">频道</h2>
          <StationList />
        </aside>

        <div className="flex flex-col gap-4">
          <Player />
          <Interaction />
        </div>
      </main>

      <StatusBar />
    </div>
  );
}
