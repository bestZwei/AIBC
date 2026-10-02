import type { ContextMemory, SegmentType, Station } from './types';

/**
 * 提示词构建与上下文记忆。纯函数，服务端生成时调用。
 */

const BASE_SYSTEM_PROMPT =
  '你是一位专业的 AI 广播电台主播，需要生成简洁、有吸引力、适合朗读的广播内容，语言生动自然，不要使用 Markdown 或表情符号。';

/** 会更新「当前话题」的段类型 */
const TOPIC_TYPES: SegmentType[] = [
  'news',
  'storyBegin',
  'scienceTopic',
  'dailyTopic',
  'guestIntro',
  'mainContent',
];

/** 会产生连续性提示的段类型 */
const CONTINUATION_TYPES: SegmentType[] = [
  'storyMiddle',
  'storyEnd',
  'commentary',
  'interviewQ2',
  'interviewA2',
];

/** 构建时需要带入当前话题的段类型 */
const TOPIC_AWARE_TYPES: SegmentType[] = [
  'commentary',
  'transition',
  'scienceTopic',
  'storyMiddle',
  'storyEnd',
];

/** 构建时需要带入连续性提示的段类型 */
const CONTINUITY_AWARE_TYPES: SegmentType[] = [
  'storyMiddle',
  'storyEnd',
  'interviewQ2',
  'interviewA2',
];

export function createMemory(): ContextMemory {
  return { currentTopic: null, recentTopics: [], continuityHints: [] };
}

export function extractTopic(content: string, maxLen = 30): string {
  const first = content.split(/[.。!！?？\n]/)[0]?.trim() ?? '';
  return first.length > maxLen ? first.slice(0, maxLen) : first;
}

function truncate(text: string, max = 100): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function continuityHint(segmentType: SegmentType, content: string): string {
  if (segmentType.startsWith('story')) {
    return `请在上次故事情节的基础上继续，上次讲到：${truncate(content)}`;
  }
  if (segmentType.startsWith('interview')) {
    return `上次访谈中嘉宾提到：${truncate(content)}`;
  }
  return `上次谈到：${truncate(content)}`;
}

/** 依据刚生成的内容更新记忆，返回新的不可变记忆对象。 */
export function updateMemory(
  memory: ContextMemory,
  segmentType: SegmentType,
  content: string,
): ContextMemory {
  const next: ContextMemory = {
    currentTopic: memory.currentTopic,
    recentTopics: [...memory.recentTopics],
    continuityHints: [...memory.continuityHints],
  };

  if (TOPIC_TYPES.includes(segmentType)) {
    const topic = extractTopic(content);
    if (topic && topic !== next.currentTopic) {
      if (next.currentTopic) {
        next.recentTopics = [...next.recentTopics, next.currentTopic].slice(-5);
      }
      next.currentTopic = topic;
    }
  }

  if (CONTINUATION_TYPES.includes(segmentType)) {
    next.continuityHints = [...next.continuityHints, continuityHint(segmentType, content)].slice(
      -3,
    );
  }

  return next;
}

export function buildSystemPrompt(station: Station): string {
  return station.systemPrompt
    ? `${BASE_SYSTEM_PROMPT} ${station.systemPrompt}`
    : BASE_SYSTEM_PROMPT;
}

function fillTemplate(template: string, station: Station, userInput?: string): string {
  return template
    .replaceAll('{stationName}', station.name)
    .replaceAll('{userInput}', userInput ?? '');
}

/** 构建某段类型的最终提示词（含互动替换与上下文增强）。 */
export function buildSegmentPrompt(
  station: Station,
  segmentType: SegmentType,
  memory: ContextMemory,
  userInput?: string,
): string {
  if (segmentType === 'userInteraction') {
    const template =
      station.prompts.userInteraction ?? '听众留言："{userInput}"。请以主播身份自然地回应。';
    return fillTemplate(template, station, userInput);
  }

  const template =
    station.prompts[segmentType] ??
    `作为「${station.name}」的主播，请生成一段适合"${segmentType}"类型的内容。`;
  let prompt = fillTemplate(template, station);

  if (memory.currentTopic && TOPIC_AWARE_TYPES.includes(segmentType)) {
    prompt += ` 请围绕我们正在讨论的主题："${memory.currentTopic}"。`;
  }
  if (memory.continuityHints.length > 0 && CONTINUITY_AWARE_TYPES.includes(segmentType)) {
    prompt += ` ${memory.continuityHints[memory.continuityHints.length - 1]}`;
  }
  return prompt;
}
