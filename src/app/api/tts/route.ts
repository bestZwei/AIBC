import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { LruCache } from '@/server/cache';
import { AppError } from '@/server/errors';
import { checkRateLimit, toErrorResponse } from '@/server/http';
import { getTtsProvider } from '@/server/providers/tts';
import type { SynthesizeResult } from '@/server/providers/tts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TtsRequest = z.object({
  text: z.string().min(1).max(2000),
  voice: z.string().min(1).max(100).optional(),
  rate: z.number().min(-50).max(50).optional(),
  pitch: z.number().min(-50).max(50).optional(),
});

const audioCache = new LruCache<SynthesizeResult>(64, 10 * 60_000);

function cacheKey(input: { text: string; voice?: string; rate?: number; pitch?: number }): string {
  return createHash('sha256')
    .update(JSON.stringify([input.text, input.voice ?? '', input.rate ?? 0, input.pitch ?? 0]))
    .digest('hex');
}

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json();
    const parsed = TtsRequest.safeParse(body);
    if (!parsed.success) {
      throw new AppError(400, 'Invalid request body');
    }
    const input = parsed.data;

    // 校验通过后再限流（限流依赖服务端 env）。
    const limited = checkRateLimit(req);
    if (!limited.allowed) return limited.response;

    const key = cacheKey(input);
    const cached = audioCache.get(key);
    const result = cached ?? (await getTtsProvider().synthesize(input));
    if (!cached) audioCache.set(key, result);

    return new NextResponse(Buffer.from(result.audio), {
      status: 200,
      headers: {
        'Content-Type': result.contentType,
        'Cache-Control': 'private, max-age=300',
        'X-RateLimit-Remaining': String(limited.remaining),
        'X-Cache': cached ? 'HIT' : 'MISS',
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
