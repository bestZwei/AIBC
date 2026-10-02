import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetEnvCache } from '../../env';
import { AppError } from '../../errors';
import { getAiProvider, resetAiProvider } from './index';

const snapshot = { ...process.env };

beforeEach(() => {
  process.env = { ...snapshot, AI_API_KEY: 'sk-TEST-KEY' };
  resetEnvCache();
  resetAiProvider();
});

afterEach(() => {
  process.env = { ...snapshot };
  resetEnvCache();
  resetAiProvider();
});

describe('getAiProvider', () => {
  it('AI_PROVIDER 选择通用 OpenAI 兼容适配器', () => {
    process.env.AI_PROVIDER = 'openai-compatible';
    expect(getAiProvider().id).toBe('openai-compatible');
  });

  it('AI_PROVIDER 选择 Gemini 原生适配器', () => {
    process.env.AI_PROVIDER = 'gemini-native';
    expect(getAiProvider().id).toBe('gemini-native');
  });

  it('未设置时落到默认适配器', () => {
    delete process.env.AI_PROVIDER;
    expect(getAiProvider().id).toBe('openai-compatible');
  });

  it('同一进程内返回单例', () => {
    process.env.AI_PROVIDER = 'gemini-native';
    expect(getAiProvider()).toBe(getAiProvider());
  });

  it('未知的 AI_PROVIDER 明确报错，而不是静默用默认值', () => {
    process.env.AI_PROVIDER = 'openai';
    expect(() => getAiProvider()).toThrowError(/Unknown AI_PROVIDER "openai"/);
    expect(() => getAiProvider()).toThrowError(AppError);
  });
});
