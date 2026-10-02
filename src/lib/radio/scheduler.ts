import type { Segment, SegmentType, Station } from './types';

/**
 * 节目段调度器：决定「下一段播什么」。纯函数，随机源可注入以便测试。
 * 规则：有待处理听众留言 → 优先互动；首段 → 开场白；播放足够久 → 偶尔收尾；
 * 否则在近期未出现的段类型中做加权随机。
 */

export interface DecideOptions {
  hasPendingUserInput?: boolean;
  /** 注入随机源，默认 Math.random；测试可传确定性函数 */
  random?: () => number;
}

/** 连续播放多少段后开始考虑插入结束语 */
const OUTRO_AFTER = 12;
/** 近期历史窗口：避免连续重复同一类型 */
const RECENT_WINDOW = 2;
/** 保留的历史长度上限 */
const MAX_HISTORY = 20;

export function decideNextSegmentType(
  station: Station,
  history: SegmentType[],
  options: DecideOptions = {},
): SegmentType {
  const random = options.random ?? Math.random;

  if (options.hasPendingUserInput) return 'userInteraction';
  if (history.length === 0) return 'intro';

  const hasOutro = station.segments.some((s) => s.type === 'outro');
  if (hasOutro && history.length >= OUTRO_AFTER && !history.slice(-6).includes('outro')) {
    return 'outro';
  }

  const recent = new Set(history.slice(-RECENT_WINDOW));
  const candidates = station.segments.filter((s) => !recent.has(s.type));
  const pool = candidates.length > 0 ? candidates : station.segments;

  const picked = weightedPick(pool, random);
  return picked ? picked.type : station.segments[0].type;
}

/** 按权重随机选择一个节目段。weight<=0 视为不出现。 */
export function weightedPick(
  segments: Segment[],
  random: () => number = Math.random,
): Segment | null {
  if (segments.length === 0) return null;
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.weight), 0);
  if (total <= 0) return segments[0];

  let r = random() * total;
  for (const s of segments) {
    r -= Math.max(0, s.weight);
    if (r <= 0) return s;
  }
  return segments[segments.length - 1];
}

/** 追加历史并裁剪到上限，返回新数组（不可变，便于状态管理）。 */
export function appendHistory(
  history: SegmentType[],
  type: SegmentType,
  max = MAX_HISTORY,
): SegmentType[] {
  const next = [...history, type];
  return next.length > max ? next.slice(next.length - max) : next;
}
