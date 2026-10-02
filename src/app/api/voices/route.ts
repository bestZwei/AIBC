import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { Voice } from '@/lib/radio/types';
import { LruCache } from '@/server/cache';
import { checkRateLimit, toErrorResponse } from '@/server/http';
import { getTtsProvider } from '@/server/providers/tts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const voicesCache = new LruCache<Voice[]>(1, 30 * 60_000);
const CACHE_KEY = 'voices';

export async function GET(req: NextRequest) {
  const limited = checkRateLimit(req);
  if (!limited.allowed) return limited.response;

  try {
    const cached = voicesCache.get(CACHE_KEY);
    const voices = cached ?? (await getTtsProvider().listVoices());
    if (!cached) voicesCache.set(CACHE_KEY, voices);

    return NextResponse.json(
      { voices },
      {
        headers: {
          'Cache-Control': 'public, max-age=1800',
          'X-RateLimit-Remaining': String(limited.remaining),
        },
      },
    );
  } catch (err) {
    return toErrorResponse(err);
  }
}
