import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetEnvCache } from '../../env';
import { AppError } from '../../errors';
import { OpenAiCompatibleProvider } from './openai-compatible';

type MockInit = {
  method: string;
  headers: Record<string, string>;
  body: string;
  signal?: AbortSignal;
};

const snapshot = { ...process.env };

/** jsdom 不提供 fetch/Response，这里只伪造适配器实际读取的几个字段。 */
function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

/** 记录调用参数的 fetch 桩，成功返回给定响应体。 */
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
    AI_PROVIDER: 'openai-compatible',
    AI_BASE_URL: 'https://upstream.test/v1',
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

describe('OpenAiCompatibleProvider', () => {
  it('用 env 组装 chat/completions 请求并取回文本', async () => {
    const calls = captureFetch({ choices: [{ message: { content: ' 晚上好。 ' } }] });

    const text = await new OpenAiCompatibleProvider().generateText({
      system: '你是主播',
      prompt: '播报开场',
    });

    expect(text).toBe('晚上好。');
    expect(calls[0].url).toBe('https://upstream.test/v1/chat/completions');
    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].init.headers.Authorization).toBe('Bearer sk-TEST-KEY');
    expect(JSON.parse(calls[0].init.body)).toEqual({
      model: 'env-model',
      max_tokens: 321,
      temperature: 0.4,
      messages: [
        { role: 'system', content: '你是主播' },
        { role: 'user', content: '播报开场' },
      ],
    });
  });

  it('单次请求参数覆盖 env 默认值', async () => {
    const calls = captureFetch({ choices: [{ message: { content: 'ok' } }] });

    await new OpenAiCompatibleProvider().generateText({
      system: 's',
      prompt: 'p',
      model: 'call-model',
      maxTokens: 64,
      temperature: 1.5,
    });

    expect(JSON.parse(calls[0].init.body)).toMatchObject({
      model: 'call-model',
      max_tokens: 64,
      temperature: 1.5,
    });
  });

  it('基础地址末尾斜杠不会拼出双斜杠', async () => {
    process.env.AI_BASE_URL = 'https://upstream.test/v1/';
    resetEnvCache();
    const calls = captureFetch({ choices: [{ message: { content: 'ok' } }] });

    await new OpenAiCompatibleProvider().generateText({ system: 's', prompt: 'p' });

    expect(calls[0].url).toBe('https://upstream.test/v1/chat/completions');
  });

  it('上游非 2xx 时抛 502，且不回显响应体', async () => {
    // 响应体里埋了泄露探针，用于断言它不会出现在我们的错误信息里。
    vi.stubGlobal(
      'fetch',
      vi.fn(async (): Promise<Response> => jsonResponse({ error: 'detail sk-LEAKED' }, 500)),
    );

    const err = await new OpenAiCompatibleProvider()
      .generateText({ system: 's', prompt: 'p' })
      .then(() => null)
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(AppError);
    expect(err).toMatchObject({ status: 502, message: 'openai-compatible returned HTTP 500' });
    expect((err as Error).message).not.toContain('sk-LEAKED');
  });

  it('响应结构不符时抛 502', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (): Promise<Response> => jsonResponse({ nope: true })),
    );

    await expect(
      new OpenAiCompatibleProvider().generateText({ system: 's', prompt: 'p' }),
    ).rejects.toMatchObject({
      status: 502,
      message: 'openai-compatible returned an unexpected response shape',
    });
  });

  it('内容为空时抛 502', async () => {
    captureFetch({ choices: [{ message: { content: '   ' } }] });

    await expect(
      new OpenAiCompatibleProvider().generateText({ system: 's', prompt: 'p' }),
    ).rejects.toMatchObject({
      status: 502,
      message: 'openai-compatible returned empty content',
    });
  });

  it('网络异常归一为 502 上游错误', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (): Promise<Response> => Promise.reject(new Error('socket hang up'))),
    );

    await expect(
      new OpenAiCompatibleProvider().generateText({ system: 's', prompt: 'p' }),
    ).rejects.toMatchObject({ status: 502, message: 'openai-compatible upstream request failed' });
  });
});
