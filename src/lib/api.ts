/**
 * 同源 API 客户端与共享契约类型。
 * 前端只调用 /api/*，绝不接触任何上游端点或密钥。
 */
import type { ContextMemory, SegmentType } from './radio/types';

export interface SegmentRequestBody {
  stationId: string;
  segmentType: SegmentType;
  memory?: ContextMemory;
  userInput?: string;
}

export interface SegmentResponseBody {
  stationId: string;
  segmentType: SegmentType;
  title: string;
  text: string;
  memory: ContextMemory;
}

export interface VoicesResponseBody {
  voices: import('./radio/types').Voice[];
}

/** 把非 2xx 响应转成带服务端脱敏 message 的错误。 */
async function ensureOk(res: Response): Promise<void> {
  if (res.ok) return;
  let message = `Request failed with HTTP ${res.status}`;
  try {
    const data = (await res.json()) as { error?: string };
    if (data?.error) message = data.error;
  } catch {
    // 忽略解析失败，使用默认消息
  }
  throw new Error(message);
}

export async function fetchSegment(
  body: SegmentRequestBody,
  signal?: AbortSignal,
): Promise<SegmentResponseBody> {
  const res = await fetch('/api/segment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  await ensureOk(res);
  return (await res.json()) as SegmentResponseBody;
}

export async function fetchTts(
  body: { text: string; voice?: string; rate?: number; pitch?: number },
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  await ensureOk(res);
  return await res.arrayBuffer();
}

export async function fetchVoices(signal?: AbortSignal): Promise<VoicesResponseBody['voices']> {
  const res = await fetch('/api/voices', { signal });
  await ensureOk(res);
  const data = (await res.json()) as VoicesResponseBody;
  return data.voices;
}
