import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RateLimitService implements OnModuleDestroy {
  private redisClient: Redis;
  private REQUESTS_PER_HOUR: number;
  private WINDOW_SIZE_IN_SECONDS: number;

  constructor() {
    this.redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
    });

    this.REQUESTS_PER_HOUR = parseInt(process.env.REQUESTS_PER_HOUR) || 100;
    this.WINDOW_SIZE_IN_SECONDS =
      parseInt(process.env.WINDOW_SIZE_IN_SECONDS) || 3600;
  }

  async onModuleDestroy() {
    await this.redisClient.quit();
  }

  async incrementRequestCount(userId: number | string) {
    const key = `rate-limit:${userId}`;

    const [[countError, countResult], [ttlError, ttlResult]] =
      await this.redisClient.multi().incr(key).ttl(key).exec();

    if (countError || ttlError) {
      throw new Error('Failed to retrieve rate limit information from Redis');
    }

    return {
      currentCount: countResult as number,
      ttl: ttlResult as number,
    };
  }

  async setExpirationTime(userId: number | string) {
    const key = `rate-limit:${userId}`;
    await this.redisClient.expire(key, this.WINDOW_SIZE_IN_SECONDS);
  }

  async isRateLimited(currentCount: number) {
    return currentCount > this.REQUESTS_PER_HOUR;
  }

  calculateRemainingRequests(currentCount: number) {
    return Math.max(0, this.REQUESTS_PER_HOUR - currentCount);
  }

  generateRateLimitExceededMessage(ttl: number): string {
    const resetDate = new Date(Date.now() + ttl * 1000);
    const resetTime = resetDate.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short',
    });
    return `Rate limit exceeded. You have reached the maximum number of ${this.REQUESTS_PER_HOUR} requests per hour. Please try again after ${resetTime}.`;
  }
}
