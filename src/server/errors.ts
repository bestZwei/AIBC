/**
 * 统一的、脱敏的服务端错误。Route Handlers 只把 message/status 回传客户端，
 * 绝不回显上游响应体、密钥或堆栈。
 */
export class AppError extends Error {
  readonly status: number;
  /** 仅供服务端日志使用的内部原因，绝不下发前端。 */
  readonly cause?: unknown;

  constructor(status: number, message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.cause = options?.cause;
  }
}

/** 上游供应商调用失败（AI/TTS）。 */
export function upstreamError(provider: string, cause: unknown): AppError {
  const detail = cause instanceof Error ? cause.message : String(cause);
  return new AppError(502, `${provider} upstream request failed`, { cause: detail });
}
