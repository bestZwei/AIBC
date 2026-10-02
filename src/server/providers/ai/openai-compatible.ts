import { z } from 'zod';
import { getEnv } from '../../env';
import { AppError, upstreamError } from '../../errors';
import type { AiProvider, GenerateTextOptions } from './types';

/** OpenAI 兼容的 /chat/completions 响应（只取我们关心的字段）。 */
const ChatCompletionResponse = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string() }).passthrough(),
      }),
    )
    .min(1),
});

const REQUEST_TIMEOUT_MS = 30_000;

/**
 * 通用 AI 适配器：任何 OpenAI 兼容的 chat/completions 端点（OpenAI、Google AI
 * Studio 的 /v1beta/openai、DeepSeek、自建网关……）。具体供应商由
 * AI_BASE_URL + AI_API_KEY + AI_MODEL 决定，端点与密钥全来自服务端 env，绝不出现在前端。
 */
export class OpenAiCompatibleProvider implements AiProvider {
  readonly id = 'openai-compatible';

  async generateText(options: GenerateTextOptions): Promise<string> {
    const env = getEnv();
    const url = `${env.AI_BASE_URL.replace(/\/$/, '')}/chat/completions`;

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
          Authorization: `Bearer ${env.AI_API_KEY}`,
        },
        body: JSON.stringify({
          model: options.model ?? env.AI_MODEL,
          max_tokens: options.maxTokens ?? env.AI_MAX_TOKENS,
          temperature: options.temperature ?? env.AI_TEMPERATURE,
          messages: [
            { role: 'system', content: options.system },
            { role: 'user', content: options.prompt },
          ],
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
    const parsed = ChatCompletionResponse.safeParse(json);
    if (!parsed.success) {
      throw new AppError(502, `${this.id} returned an unexpected response shape`);
    }

    const text = parsed.data.choices[0].message.content.trim();
    if (!text) {
      throw new AppError(502, `${this.id} returned empty content`);
    }
    return text;
  }
}
