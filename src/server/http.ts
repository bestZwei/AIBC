import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getEnv } from './env';
import { AppError } from './errors';
import { TokenBucket } from './ratelimit';

/** 从请求中尽力解析客户端 IP（用于限流）。 */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

let limiter: TokenBucket | null = null;

/** 全局限流器（按 env.API_RATE_LIMIT_PER_MIN，单实例）。 */
function getLimiter(): TokenBucket {
  if (!limiter) {
    limiter = TokenBucket.perMinute(getEnv().API_RATE_LIMIT_PER_MIN);
    limiter.sweep();
  }
  return limiter;
}

export interface RateLimitOutcome {
  allowed: boolean;
  response?: NextResponse;
  remaining: number;
}

/** 对单个请求执行限流；被拒时返回可直接下发的 429 响应。 */
export function checkRateLimit(req: NextRequest): RateLimitOutcome {
  const result = getLimiter().consume(getClientIp(req));
  if (!result.allowed) {
    const response = NextResponse.json(
      { error: 'Too many requests, please slow down.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(result.retryAfterMs / 1000)) },
      },
    );
    return { allowed: false, response, remaining: result.remaining };
  }
  return { allowed: true, remaining: result.remaining };
}

/**
 * 把异常映射为脱敏的 JSON 响应。
 * AppError 使用其 status/message；其它异常统一 500，且不回显内部细节。
 */
export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof AppError) {
    if (err.status >= 500) {
      console.error(`[api] ${err.message}`, err.cause ?? '');
    }
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error('[api] unexpected error', err);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
