import { Global, Inject, Logger, Module, OnModuleDestroy } from '@nestjs/common';
import IORedis, { type Redis } from 'ioredis';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';

export const REDIS = Symbol('REDIS');

const logger = new Logger('Redis');

/**
 * Optional shared Redis client. When REDIS_URL is not configured the app falls back to
 * in-memory rate limiting and in-process background jobs, so local development works without it.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [ENV],
      useFactory: (env: Env): Redis | null => {
        if (!env.REDIS_URL || env.NODE_ENV === 'test') return null;
        const client = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: 3, enableOfflineQueue: true, lazyConnect: false });
        client.on('error', (error) => logger.warn(`Redis error: ${error.message}`));
        return client;
      },
    },
  ],
  exports: [REDIS],
})
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject(REDIS) private readonly redis: Redis | null) {}

  async onModuleDestroy(): Promise<void> {
    if (this.redis) await this.redis.quit().catch(() => undefined);
  }
}
