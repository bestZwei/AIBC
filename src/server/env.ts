import { z } from 'zod';

/**
 * 服务端环境变量契约。所有密钥只在这里读取，绝不下发前端。
 *
 * 采用「懒校验」：只有真正处理 /api/* 请求时才调用 getEnv()，
 * 这样 `next build` 在没有配置密钥的环境下依然能通过（不会在导入期抛错）。
 */
const EnvSchema = z.object({
  AI_PROVIDER: z.string().min(1).default('gemini-balance'),
  AI_BASE_URL: z.string().url().default('https://gemini-balance.neko.is-cool.dev/v1'),
  AI_API_KEY: z.string().min(1, 'AI_API_KEY is required'),
  AI_MODEL: z.string().min(1).default('gemini-2.0-flash'),
  AI_MAX_TOKENS: z.coerce.number().int().positive().default(1000),
  AI_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.7),

  TTS_PROVIDER: z.string().min(1).default('edge-tts'),
  TTS_BASE_URL: z.string().url().default('https://tts.ciallo.de/api'),
  TTS_DEFAULT_VOICE: z.string().min(1).default('zh-CN-XiaoxiaoNeural'),

  API_RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(30),
});

export type ServerEnv = z.infer<typeof EnvSchema>;

let cached: ServerEnv | null = null;

/** 校验并返回服务端环境变量（首次调用后缓存）。 */
export function getEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    // 只暴露字段名与原因，绝不回显任何值。
    throw new Error(`Invalid server environment: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** 仅供测试重置缓存。 */
export function resetEnvCache(): void {
  cached = null;
}
