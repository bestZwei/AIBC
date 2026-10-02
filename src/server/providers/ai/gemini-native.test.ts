import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetEnvCache } from '../../env';
import { AppError } from '../../errors';
import { GeminiNativeProvider } from './gemini-native';

type MockInit = {
  method: string;
  headers: Record<string, string>;
  body: string;
  signal?: AbortSignal;
};

const snapshot = { ...process.env };

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function captureFetch(body: unknown) {
  const calls: { url: string; init: MockInit }[] = [];
  const fetchMock = vi.fn(async (url: string, init: MockInit): Promise<Response> => {
    calls.push({ url, init });
    return jsonResponse(body);
  });
  vi.stubGlobal('fetch', fetchMock);
  return calls;
}

beforeEach(() => {
  process.env = {
    ...snapshot,
    AI_PROVIDER: 'gemini-native',
    AI_BASE_URL: 'https://generativelanguage.googleapis.com/v1beta',
    AI_API_KEY: 'sk-TEST-KEY',
    AI_MODEL: 'env-model',
    AI_MAX_TOKENS: '321',
    AI_TEMPERATURE: '0.4',
  };
  resetEnvCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env = { ...snapshot };
  resetEnvCache();
});

describe('GeminiNativeProvider', () => {
  it('用原生协议组装 generateContent 请求', async () => {
    const calls = captureFetch({ candidates: [{ content: { parts: [{ text: '晚上好。' }] } }] });

    const text = await new GeminiNativeProvider().generateText({
      system: '你是主播',
      prompt: '播报开场',
    });

    expect(text).toBe('晚上好。');
    expect(calls[0].url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/env-model:generateContent',
    );
    // 原生协议用请求头传密钥，不是 Bearer。
    expect(calls[0].init.headers['x-goog-api-key']).toBe('sk-TEST-KEY');
    expect(calls[0].init.headers.Authorization).toBeUndefined();
    expect(JSON.parse(calls[0].init.body)).toEqual({
      systemInstruction: { parts: [{ text: '你是主播' }] },
      contents: [{ role: 'user', parts: [{ text: '播报开场' }] }],
      generationConfig: { maxOutputTokens: 321, temperature: 0.4 },
    });
  });

  it('复用 AI_BASE_URL 上的 /openai 后缀也能定位原生端点', async () => {
    process.env.AI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/';
    resetEnvCache();
    const calls = captureFetch({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] });

    await new GeminiNativeProvider().generateText({ system: 's', prompt: 'p' });

    expect(calls[0].url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/env-model:generateContent',
    );
  });

  it('模型名做了 URL 编码，单次参数覆盖 env', async () => {
    const calls = captureFetch({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] });

    await new GeminiNativeProvider().generateText({
      system: '',
      prompt: 'p',
      model: 'gemini 2.0 flash',
      maxTokens: 8,
      temperature: 0,
    });

    expect(calls[0].url).toContain('/models/gemini%202.0%20flash:generateContent');
    const body = JSON.parse(calls[0].init.body);
    // 空 system 不应产生 systemInstruction 字段。
    expect(body.systemInstruction).toBeUndefined();
    expect(body.generationConfig).toEqual({ maxOutputTokens: 8, temperature: 0 });
  });

  it('拼接多个 part 的文本，忽略无文本的 part', async () => {
    captureFetch({
      candidates: [
        {
          content: {
            parts: [{ text: '第一段' }, { text: '' }, { inlineData: {} }, { text: '第二段' }],
          },
        },
      ],
    });

    const text = await new GeminiNativeProvider().generateText({ system: 's', prompt: 'p' });

    expect(text).toBe('第一段第二段');
  });

  it('promptFeedback.blockReason 透出到 502', async () => {
    captureFetch({ promptFeedback: { blockReason: 'SAFETY' } });

    const err = await new GeminiNativeProvider()
      .generateText({ system: 's', prompt: 'p' })
      .then(() => null)
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(AppError);
    expect(err).toMatchObject({
      status: 502,
      message: 'gemini-native rejected the prompt: SAFETY',
    });
  });

  it('上游非 2xx 时抛 502，且不回显响应体', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (): Promise<Response> => jsonResponse({ error: 'detail sk-LEAKED' }, 403)),
    );

    await expect(
      new GeminiNativeProvider().generateText({ system: 's', prompt: 'p' }),
    ).rejects.toMatchObject({ status: 502, message: 'gemini-native returned HTTP 403' });
  });

  it('缺少 candidates 或文本为空时抛 502', async () => {
    captureFetch({ candidates: [{ content: { parts: [{ text: '  ' }] } }] });

    await expect(
      new GeminiNativeProvider().generateText({ system: 's', prompt: 'p' }),
    ).rejects.toMatchObject({ status: 502, message: 'gemini-native returned empty content' });

    vi.unstubAllGlobals();
    captureFetch({ usageMetadata: {} });

    await expect(
      new GeminiNativeProvider().generateText({ system: 's', prompt: 'p' }),
    ).rejects.toMatchObject({ status: 502, message: 'gemini-native returned empty content' });
  });

  it('响应结构不符时抛 502', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (): Promise<Response> => jsonResponse({ candidates: 'nope' })),
    );

    await expect(
      new GeminiNativeProvider().generateText({ system: 's', prompt: 'p' }),
    ).rejects.toMatchObject({
      status: 502,
      message: 'gemini-native returned an unexpected response shape',
    });
  });

  it('网络异常归一为 502 上游错误', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (): Promise<Response> => Promise.reject(new Error('socket hang up'))),
    );

    await expect(
      new GeminiNativeProvider().generateText({ system: 's', prompt: 'p' }),
    ).rejects.toMatchObject({ status: 502, message: 'gemini-native upstream request failed' });
  });
});
