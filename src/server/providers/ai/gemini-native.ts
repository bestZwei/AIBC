import { z } from 'zod';
import { getEnv } from '../../env';
import { AppError, upstreamError } from '../../errors';
import type { AiProvider, GenerateTextOptions } from './types';

/** Gemini 原生 generateContent 响应（只取我们关心的字段）。 */
const GenerateContentResponse = z.object({
  candidates: z
    .array(
      z.object({
        content: z
          .object({
            parts: z.array(z.object({ text: z.string().optional() }).passthrough()).optional(),
          })
          .passthrough()
          .optional(),
      }),
    )
    .optional(),
  promptFeedback: z.object({ blockReason: z.string().optional() }).passthrough().optional(),
});

const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Google Gemini 原生适配器：POST {base}/models/{model}:generateContent。
 * 与 openai-compatible 的区别是协议本身——密钥走 x-goog-api-key 头，
 * 系统提示词走 systemInstruction，文本在 candidates[].content.parts[].text。
 */
export class GeminiNativeProvider implements AiProvider {
  readonly id = 'gemini-native';

  async generateText(options: GenerateTextOptions): Promise<string> {
    const env = getEnv();
    const model = options.model ?? env.AI_MODEL;
    const url = `${this.apiBase(env.AI_BASE_URL)}/models/${encodeURIComponent(model)}:generateContent`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    // 让外部 signal 也能中断。
    options.signal?.addEventListener('abort', () => controller.abort(), { once: true });

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': env.AI_API_KEY,
        },
        body: JSON.stringify({
          ...(options.system ? { systemInstruction: { parts: [{ text: options.system }] } } : {}),
          contents: [{ role: 'user', parts: [{ text: options.prompt }] }],
          generationConfig: {
            maxOutputTokens: options.maxTokens ?? env.AI_MAX_TOKENS,
            temperature: options.temperature ?? env.AI_TEMPERATURE,
          },
        }),
        signal: controller.signal,
      });
    } catch (err) {
      throw upstreamError(this.id, err);
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      // 不读取/回显上游响应体细节，避免泄露。
      throw new AppError(502, `${this.id} returned HTTP ${res.status}`);
    }

    const json: unknown = await res.json();
    const parsed = GenerateContentResponse.safeParse(json);
    if (!parsed.success) {
      throw new AppError(502, `${this.id} returned an unexpected response shape`);
    }

    const blockReason = parsed.data.promptFeedback?.blockReason;
    if (blockReason) {
      throw new AppError(502, `${this.id} rejected the prompt: ${blockReason}`);
    }

    const parts = parsed.data.candidates?.[0]?.content?.parts ?? [];
    const text = parts
      .map((p) => p.text ?? '')
      .join('')
      .trim();
    if (!text) {
      throw new AppError(502, `${this.id} returned empty content`);
    }
    return text;
  }

  /**
   * AI_BASE_URL 在两个 Google 形态的适配器之间共用一个变量，而它们只差一个
   * `/openai` 后缀；切换供应商因此只需要改 AI_PROVIDER。
   */
  private apiBase(baseUrl: string): string {
    const withoutTrailingSlash = baseUrl.replace(/\/$/, '');
    return withoutTrailingSlash.replace(/\/openai$/, '');
  }
}
