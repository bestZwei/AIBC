/**
 * 电台领域核心类型定义。
 * isomorphic：客户端调度与服务端生成共用同一套类型，杜绝旧项目
 * prompts/defaultPrompts 字段不一致、存储键不一致一类问题。
 */

/** 节目段类型。新增频道时若引入新类型，在此扩展即可。 */
export const SEGMENT_TYPES = [
  'intro',
  'outro',
  'transition',
  'userInteraction',
  'news',
  'commentary',
  'storyBegin',
  'storyMiddle',
  'storyEnd',
  'scienceTopic',
  'scienceFact',
  'dailyTopic',
  'funFact',
  'guestIntro',
  'interviewQ1',
  'interviewA1',
  'interviewQ2',
  'interviewA2',
  'mainContent',
  'secondaryContent',
] as const;

/** 节目段类型联合（由 SEGMENT_TYPES 派生，单一事实来源）。 */
export type SegmentType = (typeof SEGMENT_TYPES)[number];

/** 频道内容编排中的一个节目段及其出现权重。 */
export interface Segment {
  type: SegmentType;
  weight: number;
}

/** 各节目段类型对应的提示词模板。支持 {stationName} 与 {userInput} 占位符。 */
export type PromptMap = Partial<Record<SegmentType, string>>;

/** 一个广播频道的完整定义。 */
export interface Station {
  id: string;
  name: string;
  description: string;
  /** emoji 图标，避免引入图标库依赖 */
  icon: string;
  /** TTS 语音 short name */
  voice: string;
  /** 频道专属人设/风格，叠加在基础系统提示之上 */
  systemPrompt: string;
  segments: Segment[];
  prompts: PromptMap;
}

/** TTS 可用语音。 */
export interface Voice {
  shortName: string;
  friendlyName?: string;
  locale?: string;
  gender?: string;
}

/** 一段内容的元数据，随音频在播放队列中流转，用于「正在播放」展示。 */
export interface SegmentMeta {
  stationId: string;
  segmentType: SegmentType;
  title: string;
  text: string;
}

/** 频道上下文记忆，用于保持连续性与话题聚焦。 */
export interface ContextMemory {
  currentTopic: string | null;
  recentTopics: string[];
  continuityHints: string[];
}
