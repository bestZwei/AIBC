import { getEnv } from '../../env';
import { AppError } from '../../errors';
import { GeminiNativeProvider } from './gemini-native';
import { OpenAiCompatibleProvider } from './openai-compatible';
import type { AiProvider } from './types';

export type { AiProvider, GenerateTextOptions } from './types';

const registry = new Map<string, () => AiProvider>([
  ['openai-compatible', () => new OpenAiCompatibleProvider()],
  ['gemini-native', () => new GeminiNativeProvider()],
]);

let instance: AiProvider | null = null;

/** 按 env.AI_PROVIDER 返回单例适配器。 */
export function getAiProvider(): AiProvider {
  if (instance) return instance;
  const { AI_PROVIDER } = getEnv();
  const create = registry.get(AI_PROVIDER);
  if (!create) {
    throw new AppError(500, `Unknown AI_PROVIDER "${AI_PROVIDER}"`);
  }
  instance = create();
  return instance;
}

/** 仅供测试重置单例。 */
export function resetAiProvider(): void {
  instance = null;
}
