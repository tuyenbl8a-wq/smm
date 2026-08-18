export interface RedisCounter {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
}
export class DistributedRateLimiter {
  constructor(
    private redis: RedisCounter,
    private namespace = "smm:api-v2",
  ) {}
  async consume(id: string, limit: number, now = Date.now()) {
    const bucket = Math.floor(now / 60000),
      key = `${this.namespace}:${id}:${bucket}`,
      count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, 61);
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      retryAfter: 61 - Math.floor((now % 60000) / 1000),
    };
  }
}
