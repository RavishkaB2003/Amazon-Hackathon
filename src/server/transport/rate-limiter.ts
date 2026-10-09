/**
 * In-process Sliding Window Rate Limiter
 * Default limit: 60 requests per minute per IP
 */

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
}

export class SlidingWindowRateLimiter {
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private requestLog = new Map<string, number[]>();

  constructor(maxRequests = 60, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  check(key: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    let timestamps = this.requestLog.get(key) || [];
    // Filter out timestamps outside the sliding window
    timestamps = timestamps.filter((t) => t > windowStart);

    if (timestamps.length >= this.maxRequests) {
      const oldestInWindow = timestamps[0];
      const resetMs = Math.max(0, oldestInWindow + this.windowMs - now);
      this.requestLog.set(key, timestamps);
      return {
        allowed: false,
        limit: this.maxRequests,
        remaining: 0,
        resetMs,
      };
    }

    timestamps.push(now);
    this.requestLog.set(key, timestamps);

    return {
      allowed: true,
      limit: this.maxRequests,
      remaining: this.maxRequests - timestamps.length,
      resetMs: this.windowMs,
    };
  }

  reset(): void {
    this.requestLog.clear();
  }
}
