import { describe, expect, it } from 'vitest';
import { chunkText } from './text';

describe('chunkText', () => {
  it('空字符串返回空数组', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('   ')).toEqual([]);
  });

  it('短文本原样返回单块', () => {
    expect(chunkText('你好，世界')).toEqual(['你好，世界']);
  });

  it('不超过上限时不切分', () => {
    const text = 'a'.repeat(800);
    expect(chunkText(text, 800)).toEqual([text]);
  });

  it('长文本被切成多块', () => {
    const text = '这是一个句子。'.repeat(200);
    const chunks = chunkText(text, 100);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.length).toBeGreaterThan(0);
    }
  });

  it('优先在句子结束处断开', () => {
    const text = `${'前'.repeat(60)}。${'后'.repeat(60)}`;
    const chunks = chunkText(text, 80);
    expect(chunks[0].endsWith('。')).toBe(true);
  });

  it('拼接后不丢失字符（忽略空白）', () => {
    const text = '人工智能正在改变世界，未来充满可能。'.repeat(50);
    const rejoined = chunkText(text, 120).join('');
    expect(rejoined.replace(/\s/g, '')).toBe(text.replace(/\s/g, ''));
  });
});
