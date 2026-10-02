import { getEnv } from '../../env';
import { AppError } from '../../errors';
import { EdgeTtsProvider } from './edge-tts';
import type { TtsProvider } from './types';

export type { TtsProvider, SynthesizeOptions, SynthesizeResult } from './types';

const registry = new Map<string, () => TtsProvider>([['edge-tts', () => new EdgeTtsProvider()]]);

let instance: TtsProvider | null = null;

/** 按 env.TTS_PROVIDER 返回单例适配器。 */
export function getTtsProvider(): TtsProvider {
  if (instance) return instance;
  const { TTS_PROVIDER } = getEnv();
  const create = registry.get(TTS_PROVIDER);
  if (!create) {
    throw new AppError(500, `Unknown TTS_PROVIDER "${TTS_PROVIDER}"`);
  }
  instance = create();
  return instance;
}

/** 仅供测试重置单例。 */
export function resetTtsProvider(): void {
  instance = null;
}
