import type { Voice } from '@/lib/radio/types';

/**
 * TTS 语音合成供应商适配接口。新增供应商（Azure/ElevenLabs/...）只需实现本接口并在工厂注册。
 */
export interface SynthesizeOptions {
  text: string;
  /** 供应商语音标识；缺省时由适配器回退到 env.TTS_DEFAULT_VOICE。 */
  voice?: string;
  /** 语速偏移，0 为正常。 */
  rate?: number;
  /** 音调偏移，0 为正常。 */
  pitch?: number;
  signal?: AbortSignal;
}

export interface SynthesizeResult {
  /** 可直接被 AudioContext.decodeAudioData 解码的音频字节（mp3/wav）。 */
  audio: ArrayBuffer;
  /** 音频 MIME 类型，如 audio/mpeg。 */
  contentType: string;
}

export interface TtsProvider {
  readonly id: string;
  synthesize(options: SynthesizeOptions): Promise<SynthesizeResult>;
  /** 返回可用语音列表（已归一化为领域 Voice 类型）。 */
  listVoices(): Promise<Voice[]>;
}
