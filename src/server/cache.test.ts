import { describe, expect, it } from 'vitest';
import { LruCache } from './cache';

describe('LruCache', () => {
  it('存取命中', () => {
    const cache = new LruCache<number>(10, 1000);
    cache.set('a', 1, 0);
    expect(cache.get('a', 0)).toBe(1);
    expect(cache.has('a', 0)).toBe(true);
  });

  it('未命中返回 undefined', () => {
    const cache = new LruCache<number>(10, 1000);
    expect(cache.get('missing', 0)).toBeUndefined();
  });

  it('TTL 过期后失效', () => {
    const cache = new LruCache<number>(10, 1000);
    cache.set('a', 1, 0);
    expect(cache.get('a', 999)).toBe(1);
    expect(cache.get('a', 1000)).toBeUndefined();
  });

  it('超出容量时淘汰最久未使用项', () => {
    const cache = new LruCache<number>(2, 10_000);
    cache.set('a', 1, 0);
    cache.set('b', 2, 0);
    cache.get('a', 0); // a 变为最近使用
    cache.set('c', 3, 0); // 应淘汰 b
    expect(cache.get('a', 0)).toBe(1);
    expect(cache.get('b', 0)).toBeUndefined();
    expect(cache.get('c', 0)).toBe(3);
    expect(cache.size).toBe(2);
  });

  it('clear 清空', () => {
    const cache = new LruCache<number>(10, 1000);
    cache.set('a', 1, 0);
    cache.clear();
    expect(cache.size).toBe(0);
  });
});
