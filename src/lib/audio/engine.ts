import type { SegmentMeta } from '@/lib/radio/types';

export interface QueuedClip {
  buffer: AudioBuffer;
  meta: SegmentMeta;
}

export interface EngineState {
  isPlaying: boolean;
  bufferedCount: number;
  currentMeta: SegmentMeta | null;
  volume: number;
}

type Listener = (state: EngineState) => void;

/**
 * 基于 Web Audio 的连续播放引擎（客户端单例）。
 * - 队列：解码后的 AudioBuffer 依次播放，一段结束自动接下一段（电台式连续体验）。
 * - 暂停/恢复通过 AudioContext.suspend/resume 实现，保持时钟一致。
 * - 暴露 AnalyserNode 供可视化使用。
 */
class RadioAudioEngine {
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private queue: QueuedClip[] = [];
  private source: AudioBufferSourceNode | null = null;

  private playing = false;
  private currentMeta: SegmentMeta | null = null;
  private volume = 0.8;

  private listeners = new Set<Listener>();
  private frequencyData: Uint8Array | null = null;

  private ensureContext(): AudioContext {
    if (this.ctx) return this.ctx;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctor();
    const gain = ctx.createGain();
    gain.gain.value = this.volume;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    gain.connect(analyser);
    analyser.connect(ctx.destination);
    this.ctx = ctx;
    this.gain = gain;
    this.analyser = analyser;
    this.frequencyData = new Uint8Array(analyser.frequencyBinCount);
    return ctx;
  }

  /** 解码上游音频字节为 AudioBuffer。 */
  async decode(audio: ArrayBuffer): Promise<AudioBuffer> {
    const ctx = this.ensureContext();
    return await ctx.decodeAudioData(audio.slice(0));
  }

  enqueue(buffer: AudioBuffer, meta: SegmentMeta): void {
    this.queue.push({ buffer, meta });
    if (this.playing && !this.source) this.playNext();
    this.emit();
  }

  /** 开始播放队列（需在用户手势后调用）。 */
  async play(): Promise<void> {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') await ctx.resume();
    this.playing = true;
    if (!this.source) this.playNext();
    this.emit();
  }

  async pause(): Promise<void> {
    this.playing = false;
    if (this.ctx && this.ctx.state === 'running') await this.ctx.suspend();
    this.emit();
  }

  async resume(): Promise<void> {
    if (!this.ctx) return;
    this.playing = true;
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    if (!this.source && this.queue.length > 0) this.playNext();
    this.emit();
  }

  /** 停止并清空队列。 */
  stop(): void {
    this.playing = false;
    this.queue = [];
    if (this.source) {
      this.source.onended = null;
      try {
        this.source.stop();
      } catch {
        // 忽略：source 可能已结束
      }
      this.source.disconnect();
      this.source = null;
    }
    this.currentMeta = null;
    this.emit();
  }

  setVolume(v: number): void {
    this.volume = Math.min(1, Math.max(0, v));
    if (this.gain) this.gain.gain.value = this.volume;
    this.emit();
  }

  clearQueue(): void {
    this.queue = [];
    this.emit();
  }

  get bufferedCount(): number {
    return this.queue.length;
  }

  getState(): EngineState {
    return {
      isPlaying: this.playing && this.ctx?.state === 'running',
      bufferedCount: this.queue.length,
      currentMeta: this.currentMeta,
      volume: this.volume,
    };
  }

  /** 供可视化读取频谱数据（0-255）。 */
  getFrequencyData(): Uint8Array {
    if (!this.analyser || !this.frequencyData) {
      return new Uint8Array(0);
    }
    this.analyser.getByteFrequencyData(this.frequencyData as Uint8Array<ArrayBuffer>);
    return this.frequencyData;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private playNext(): void {
    if (!this.playing || !this.ctx || !this.gain) return;
    const clip = this.queue.shift();
    if (!clip) {
      this.source = null;
      this.currentMeta = null;
      this.onDrained?.();
      this.emit();
      return;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = clip.buffer;
    source.connect(this.gain);
    source.onended = () => {
      if (this.source === source) {
        this.source = null;
        this.playNext();
      }
    };
    this.source = source;
    this.currentMeta = clip.meta;
    this.onClipStart?.(clip.meta);
    source.start(0);
    this.emit();
  }

  private emit(): void {
    const state = this.getState();
    for (const listener of this.listeners) listener(state);
  }

  /** 队列播空回调（供编排层补充内容）。 */
  onDrained: (() => void) | null = null;
  /** 每段开始播放回调。 */
  onClipStart: ((meta: SegmentMeta) => void) | null = null;
}

export const audioEngine = new RadioAudioEngine();
