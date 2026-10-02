import { describe, expect, it } from 'vitest';
import {
  buildSegmentPrompt,
  buildSystemPrompt,
  createMemory,
  extractTopic,
  updateMemory,
} from './prompt';
import { getStationById } from './stations';
import type { Station } from './types';

const story = getStationById('story') as Station;
const news = getStationById('news') as Station;

describe('buildSystemPrompt', () => {
  it('叠加基础提示与频道人设', () => {
    const sys = buildSystemPrompt(news);
    expect(sys).toContain('广播电台主播');
    expect(sys).toContain('新闻');
  });
});

describe('buildSegmentPrompt', () => {
  it('互动段替换 {userInput}', () => {
    const prompt = buildSegmentPrompt(news, 'userInteraction', createMemory(), '今天天气如何');
    expect(prompt).toContain('今天天气如何');
    expect(prompt).not.toContain('{userInput}');
  });

  it('缺失模板时回退到通用提示且包含频道名', () => {
    const prompt = buildSegmentPrompt(story, 'mainContent', createMemory());
    expect(prompt).toContain(story.name);
  });

  it('故事续写会带入连续性提示', () => {
    let memory = createMemory();
    memory = updateMemory(memory, 'storyMiddle', '主角走进了那片森林，夜色渐深。');
    const prompt = buildSegmentPrompt(story, 'storyEnd', memory);
    expect(prompt).toContain('上次');
  });

  it('评论段会带入当前话题', () => {
    let memory = createMemory();
    memory = updateMemory(memory, 'news', '某地宣布新的交通政策。其余内容……');
    const prompt = buildSegmentPrompt(news, 'commentary', memory);
    expect(prompt).toContain('主题');
  });
});

describe('memory', () => {
  it('extractTopic 取首句并截断', () => {
    expect(extractTopic('这是第一句。这是第二句。')).toBe('这是第一句');
    const long = '一'.repeat(50);
    expect(extractTopic(long, 30)).toHaveLength(30);
  });

  it('updateMemory 不修改原对象（不可变）', () => {
    const original = createMemory();
    const next = updateMemory(original, 'news', '一个新话题。更多内容');
    expect(original.currentTopic).toBeNull();
    expect(next.currentTopic).toBe('一个新话题');
  });

  it('连续性提示最多保留 3 条', () => {
    let memory = createMemory();
    for (let i = 0; i < 5; i++) {
      memory = updateMemory(memory, 'storyMiddle', `第${i}段情节。`);
    }
    expect(memory.continuityHints.length).toBeLessThanOrEqual(3);
  });
});
