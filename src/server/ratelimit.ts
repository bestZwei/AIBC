/**
 * 内存令牌桶限流（单实例 MVP）。按 key（通常是 IP）限制每分钟请求数。
 * 多实例部署时应替换为 Redis 等共享存储——见 docs/ARCHITECTURE.md。
 */
interface Bucket {
  tokens: number;
  updatedAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** 剩余可用请求数。 */
  remaining: number;
  /** 距下一个令牌可用的毫秒数（被拒时用于 Retry-After）。 */
  retryAfterMs: number;
}

export class TokenBucket {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly capacity: number,
    private readonly refillPerMs: number,
  ) {}

  /** 每分钟 N 次的便捷构造。 */
  static perMinute(capacity: number): TokenBucket {
    return new TokenBucket(capacity, capacity / 60_000);
  }

  consume(key: string, now = Date.now(), cost = 1): RateLimitResult {
    const bucket = this.buckets.get(key);
    if (!bucket) {
      this.buckets.set(key, { tokens: this.capacity - cost, updatedAt: now });
      return { allowed: cost <= this.capacity, remaining: this.capacity - cost, retryAfterMs: 0 };
    }

    const elapsed = now - bucket.updatedAt;
    const refilled = Math.min(this.capacity, bucket.tokens + elapsed * this.refillPerMs);
    const allowed = refilled >= cost;
    const tokens = allowed ? refilled - cost : refilled;
    bucket.tokens = tokens;
    bucket.updatedAt = now;

    const retryAfterMs = allowed ? 0 : Math.ceil((cost - refilled) / this.refillPerMs);
    return { allowed, remaining: Math.floor(tokens), retryAfterMs };
  }

  /** 清理长时间未活动的桶，避免内存无限增长。 */
  sweep(maxAgeMs = 10 * 60_000, now = Date.now()): void {
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.updatedAt > maxAgeMs) this.buckets.delete(key);
    }
  }
}
