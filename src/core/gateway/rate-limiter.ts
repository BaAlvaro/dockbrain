import type { Logger } from '../../utils/logger.js';

interface RateLimitEntry {
  count: number;
  reset_at: number;
}

export class RateLimiter {
  private limits = new Map<string, RateLimitEntry>();

  constructor(
    private logger: Logger,
    private defaultLimitPerMinute: number = 10
  ) {
    setInterval(() => this.cleanup(), 60000);
  }

  check(key: string, limitPerMinute?: number): boolean {
    const limit = limitPerMinute || this.defaultLimitPerMinute;
    const now = Date.now();
    const entry = this.limits.get(key);

    if (!entry || entry.reset_at < now) {
      this.limits.set(key, {
        count: 1,
        reset_at: now + 60000,
      });
      return true;
    }

    if (entry.count >= limit) {
      this.logger.warn({ key, count: entry.count, limit }, 'Rate limit exceeded');
      return false;
    }

    entry.count++;
    return true;
  }

  reset(key: string): void {
    this.limits.delete(key);
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.limits.entries()) {
      if (entry.reset_at < now) {
        this.limits.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug({ cleaned }, 'Cleaned expired rate limit entries');
    }
  }
}
