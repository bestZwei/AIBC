import { describe, expect, it } from 'vitest';
import { appendHistory, decideNextSegmentType, weightedPick } from './scheduler';
import { PRESET_STATIONS, getStationById } from './stations';
import type { Segment, SegmentType, Station } from './types';

const news = getStationById('news') as Station;

describe('decideNextSegmentType', () => {
  it('首段总是开场白', () => {
    expect(decideNextSegmentType(news, [])).toBe('intro');
  });

  it('有待处理听众留言时优先互动', () => {
    const history: SegmentType[] = ['intro', 'news'];
    expect(decideNextSegmentType(news, history, { hasPendingUserInput: true })).toBe(
      'userInteraction',
    );
  });

  it('避免连续重复最近出现的段类型', () => {
    const history: SegmentType[] = ['intro', 'news'];
    // random=0 会命中池中第一个候选；news 在最近窗口内应被过滤掉
    const next = decideNextSegmentType(news, history, { random: () => 0 });
    expect(next).not.toBe('news');
  });

  it('播放足够久且近期无 outro 时会收尾', () => {
    const history = Array.from({ length: 13 }, () => 'news' as SegmentType);
    expect(decideNextSegmentType(news, history, { random: () => 0.5 })).toBe('outro');
  });

  it('对任意预设频道都能返回其合法段类型', () => {
    for (const station of PRESET_STATIONS) {
      const type = decideNextSegmentType(station, ['intro'], { random: () => 0.999 });
      const valid = station.segments.some((s) => s.type === type) || type === 'userInteraction';
      expect(valid).toBe(true);
    }
  });
});

describe('weightedPick', () => {
  it('空数组返回 null', () => {
    expect(weightedPick([])).toBeNull();
  });

  it('全部权重为 0 时回退到第一个', () => {
    const segs: Segment[] = [
      { type: 'news', weight: 0 },
      { type: 'outro', weight: 0 },
    ];
    expect(weightedPick(segs, () => 0.5)?.type).toBe('news');
  });

  it('random 接近 1 时命中最后一个', () => {
    const segs: Segment[] = [
      { type: 'news', weight: 1 },
      { type: 'outro', weight: 1 },
    ];
    expect(weightedPick(segs, () => 0.999)?.type).toBe('outro');
  });
});

describe('appendHistory', () => {
  it('追加并裁剪到上限', () => {
    const history = Array.from({ length: 20 }, () => 'news' as SegmentType);
    const next = appendHistory(history, 'outro', 20);
    expect(next).toHaveLength(20);
    expect(next[next.length - 1]).toBe('outro');
    expect(next[0]).toBe('news');
  });
});
