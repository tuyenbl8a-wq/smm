export interface RedisCounter {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
  incrWithExpiry?(key: string, seconds: number): Promise<number>;
}
export class DistributedRateLimiter {
  constructor(
    private redis: RedisCounter,
    private namespace = "smm:api-v2",
  ) {}
  async consume(id: string, limit: number, now = Date.now()) {
    const bucket = Math.floor(now / 60000),
      key = `${this.namespace}:${id}:${bucket}`,
      count = this.redis.incrWithExpiry
        ? await this.redis.incrWithExpiry(key, 61)
        : await this.redis.incr(key);
    // Compatibility is retained for injected test/legacy counters. The runtime
    // Redis client uses one EVAL command so increment and TTL are atomic.
    if (!this.redis.incrWithExpiry && count === 1)
      await this.redis.expire(key, 61);
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      retryAfter: 61 - Math.floor((now % 60000) / 1000),
    };
  }
}
