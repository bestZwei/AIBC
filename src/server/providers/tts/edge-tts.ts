import { z } from 'zod';
import type { Voice } from '@/lib/radio/types';
import { getEnv } from '../../env';
import { AppError, upstreamError } from '../../errors';
import type { SynthesizeOptions, SynthesizeResult, TtsProvider } from './types';

/** 上游 /voices 返回的元素（Edge-TTS 风格：大驼峰字段）。 */
const UpstreamVoice = z.object({
  ShortName: z.string(),
  FriendlyName: z.string().optional(),
  Locale: z.string().optional(),
  Gender: z.string().optional(),
});

const REQUEST_TIMEOUT_MS = 30_000;

/**
 * 默认 TTS 适配器：Edge-TTS 风格的 HTTP 端点。
 *   GET {base}/tts?t=&v=&r=&p=  -> 音频字节
 *   GET {base}/voices?l=zh      -> 语音列表
 * 端点全部来自服务端 env。
 */
export class EdgeTtsProvider implements TtsProvider {
  readonly id = 'edge-tts';

  async synthesize(options: SynthesizeOptions): Promise<SynthesizeResult> {
    const env = getEnv();
    const text = options.text.trim();
    if (!text) {
      throw new AppError(400, 'text must not be empty');
    }

    const params = new URLSearchParams({
      t: text,
      v: options.voice ?? env.TTS_DEFAULT_VOICE,
      r: String(options.rate ?? 0),
      p: String(options.pitch ?? 0),
    });
    const url = `${env.TTS_BASE_URL.replace(/\/$/, '')}/tts?${params.toString()}`;

    const res = await this.fetchWithTimeout(url, options.signal);
    if (!res.ok) {
      throw new AppError(502, `${this.id} returned HTTP ${res.status}`);
    }

    const contentType = res.headers.get('content-type')?.split(';')[0] ?? 'audio/mpeg';
    const audio = await res.arrayBuffer();
    if (audio.byteLength === 0) {
      throw new AppError(502, `${this.id} returned empty audio`);
    }
    return { audio, contentType };
  }

  async listVoices(): Promise<Voice[]> {
    const env = getEnv();
    const url = `${env.TTS_BASE_URL.replace(/\/$/, '')}/voices?l=zh`;

    const res = await this.fetchWithTimeout(url);
    if (!res.ok) {
      throw new AppError(502, `${this.id} returned HTTP ${res.status}`);
    }

    const json: unknown = await res.json();
    const parsed = z.array(UpstreamVoice).safeParse(json);
    if (!parsed.success) {
      throw new AppError(502, `${this.id} returned an unexpected voices shape`);
    }

    return parsed.data.map((v) => ({
      shortName: v.ShortName,
      friendlyName: v.FriendlyName,
      locale: v.Locale,
      gender: v.Gender,
    }));
  }

  private async fetchWithTimeout(url: string, signal?: AbortSignal): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    signal?.addEventListener('abort', () => controller.abort(), { once: true });
    try {
      return await fetch(url, { signal: controller.signal });
    } catch (err) {
      throw upstreamError(this.id, err);
    } finally {
      clearTimeout(timer);
    }
  }
}
