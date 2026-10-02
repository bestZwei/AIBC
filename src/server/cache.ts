/**
 * 内存 LRU 缓存（单实例 MVP），带可选 TTL。用于缓存 TTS 音频、语音列表等重复请求，
 * 降低上游压力与延迟。多实例部署时应替换为共享缓存——见 docs/ARCHITECTURE.md。
 */
interface Entry<V> {
  value: V;
  expiresAt: number;
}

export class LruCache<V> {
  private readonly map = new Map<string, Entry<V>>();

  constructor(
    private readonly maxSize = 100,
    private readonly ttlMs = 5 * 60_000,
  ) {}

  get(key: string, now = Date.now()): V | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= now) {
      this.map.delete(key);
      return undefined;
    }
    // 命中即刷新为最近使用。
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: string, value: V, now = Date.now()): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, expiresAt: now + this.ttlMs });
    while (this.map.size > this.maxSize) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  has(key: string, now = Date.now()): boolean {
    return this.get(key, now) !== undefined;
  }

  get size(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }
}
