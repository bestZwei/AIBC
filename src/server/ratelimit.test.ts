import { describe, expect, it } from 'vitest';
import { TokenBucket } from './ratelimit';

describe('TokenBucket', () => {
  it('初始容量内允许请求', () => {
    const bucket = TokenBucket.perMinute(3);
    expect(bucket.consume('ip1', 0).allowed).toBe(true);
    expect(bucket.consume('ip1', 0).allowed).toBe(true);
    expect(bucket.consume('ip1', 0).allowed).toBe(true);
  });

  it('超出容量后拒绝，并给出 retryAfter', () => {
    const bucket = TokenBucket.perMinute(1);
    expect(bucket.consume('ip1', 0).allowed).toBe(true);
    const denied = bucket.consume('ip1', 0);
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterMs).toBeGreaterThan(0);
  });

  it('随时间补充令牌', () => {
    // 每分钟 60 个 => 每 1000ms 补 1 个
    const bucket = TokenBucket.perMinute(60);
    for (let i = 0; i < 60; i++) bucket.consume('ip1', 0);
    expect(bucket.consume('ip1', 0).allowed).toBe(false);
    expect(bucket.consume('ip1', 1000).allowed).toBe(true);
  });

  it('不同 key 互不影响', () => {
    const bucket = TokenBucket.perMinute(1);
    expect(bucket.consume('a', 0).allowed).toBe(true);
    expect(bucket.consume('b', 0).allowed).toBe(true);
    expect(bucket.consume('a', 0).allowed).toBe(false);
  });

  it('sweep 清理过期桶', () => {
    const bucket = TokenBucket.perMinute(10);
    bucket.consume('old', 0);
    bucket.sweep(1000, 5000);
    // old 已被清理，重新消费应从满容量开始
    expect(bucket.consume('old', 5000).remaining).toBe(9);
  });
});
