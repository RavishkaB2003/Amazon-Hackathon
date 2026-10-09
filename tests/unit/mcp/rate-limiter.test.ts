import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SlidingWindowRateLimiter } from '../../../src/server/transport/rate-limiter';

describe('Sliding Window Rate Limiter (Unit)', () => {
  let limiter: SlidingWindowRateLimiter;

  beforeEach(() => {
    limiter = new SlidingWindowRateLimiter(5, 1000); // 5 req per 1000ms for testing
    vi.useRealTimers();
  });

  it('allows requests within threshold limit', () => {
    const ip = '127.0.0.1';
    for (let i = 0; i < 5; i++) {
      const res = limiter.check(ip);
      expect(res.allowed).toBe(true);
      expect(res.remaining).toBe(5 - (i + 1));
    }
  });

  it('rejects the (N+1)th request exceeding threshold', () => {
    const ip = '127.0.0.1';
    for (let i = 0; i < 5; i++) {
      limiter.check(ip);
    }

    const blocked = limiter.check(ip);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetMs).toBeGreaterThan(0);
  });

  it('tracks different IP keys independently', () => {
    const ip1 = '127.0.0.1';
    const ip2 = '192.168.1.100';

    for (let i = 0; i < 5; i++) {
      limiter.check(ip1);
    }
    expect(limiter.check(ip1).allowed).toBe(false);

    // ip2 should still be allowed
    const resIp2 = limiter.check(ip2);
    expect(resIp2.allowed).toBe(true);
    expect(resIp2.remaining).toBe(4);
  });

  it('re-allows requests once sliding window expires', async () => {
    vi.useFakeTimers();
    const mockLimiter = new SlidingWindowRateLimiter(2, 500);

    expect(mockLimiter.check('client-a').allowed).toBe(true);
    expect(mockLimiter.check('client-a').allowed).toBe(true);
    expect(mockLimiter.check('client-a').allowed).toBe(false);

    // Advance timer past window
    vi.advanceTimersByTime(550);

    expect(mockLimiter.check('client-a').allowed).toBe(true);
    vi.useRealTimers();
  });

  it('resets correctly on clear', () => {
    const ip = '127.0.0.1';
    for (let i = 0; i < 5; i++) {
      limiter.check(ip);
    }
    expect(limiter.check(ip).allowed).toBe(false);

    limiter.reset();
    expect(limiter.check(ip).allowed).toBe(true);
  });
});
