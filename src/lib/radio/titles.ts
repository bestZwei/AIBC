import type { SegmentType } from './types';

/** 节目段类型 → 展示用中文标题（用于「正在播放」区域）。 */
const TITLES: Partial<Record<SegmentType, string>> = {
  intro: '节目开场',
  outro: '节目尾声',
  transition: '节目过渡',
  userInteraction: '听众互动',
  news: '新闻播报',
  commentary: '新闻评论',
  storyBegin: '故事时间',
  storyMiddle: '故事时间',
  storyEnd: '故事时间',
  scienceTopic: '科学探索',
  scienceFact: '科学趣闻',
  dailyTopic: '趣味话题',
  funFact: '生活趣闻',
  guestIntro: '嘉宾访谈',
  interviewQ1: '嘉宾访谈',
  interviewA1: '嘉宾访谈',
  interviewQ2: '嘉宾访谈',
  interviewA2: '嘉宾访谈',
  mainContent: '正在播出',
  secondaryContent: '相关内容',
};

export function segmentTitle(type: SegmentType): string {
  return TITLES[type] ?? '正在播出';
}
