import { setTimeout as sleep } from 'node:timers/promises';
import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { waitUntil } from '@vercel/functions';
import { Queue, Worker } from 'bullmq';
import IORedis, { type Redis } from 'ioredis';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';

export type JobHandler = (data: Record<string, unknown>) => Promise<void>;

const QUEUE_NAME = 'crm-jobs';
const MAX_ATTEMPTS = 3;

/**
 * Background job facade.
 *  - REDIS_URL configured: BullMQ queue + worker (retries with exponential backoff, schedulers).
 *  - No Redis: jobs run in-process asynchronously with the same retry policy. On Vercel the
 *    function is kept alive until the job settles (waitUntil); outside Vercel that call is a no-op.
 *  - JOBS_INLINE (tests): jobs run synchronously so results can be asserted deterministically.
 */
@Injectable()
export class JobsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);
  private readonly handlers = new Map<string, JobHandler>();
  private readonly timers: NodeJS.Timeout[] = [];
  private connection?: Redis;
  private queue?: Queue;
  private worker?: Worker;

  constructor(@Inject(ENV) private readonly env: Env) {
    if (env.REDIS_URL && !env.JOBS_INLINE && env.NODE_ENV !== 'test') {
      this.connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
      this.connection.on('error', (error) => this.logger.warn(`Queue Redis error: ${error.message}`));
      this.queue = new Queue(QUEUE_NAME, { connection: this.connection });
    }
  }

  get mode(): 'bullmq' | 'in-process' | 'inline' {
    if (this.env.JOBS_INLINE) return 'inline';
    return this.queue ? 'bullmq' : 'in-process';
  }

  register(name: string, handler: JobHandler): void {
    this.handlers.set(name, handler);
  }

  onApplicationBootstrap(): void {
    if (this.queue && this.connection && this.env.RUN_WORKER) {
      this.worker = new Worker(
        QUEUE_NAME,
        async (job) => {
          const handler = this.handlers.get(job.name);
          if (!handler) throw new Error(`No handler registered for job "${job.name}"`);
          await handler(job.data as Record<string, unknown>);
        },
        { connection: this.connection.duplicate({ maxRetriesPerRequest: null }), concurrency: 5 },
      );
      this.worker.on('failed', (job, error) =>
        this.logger.error(`Job ${job?.name ?? 'unknown'} (${job?.id ?? '-'}) failed: ${error.message}`),
      );
    }
    this.logger.log(`Background jobs running in ${this.mode} mode`);
  }

  async enqueue(name: string, data: Record<string, unknown> = {}): Promise<void> {
    if (this.env.JOBS_INLINE) {
      await this.run(name, data);
      return;
    }
    if (this.queue) {
      await this.queue.add(name, data, {
        attempts: MAX_ATTEMPTS,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      });
      return;
    }
    const job = new Promise<void>((resolve) => setImmediate(resolve)).then(() => this.runWithRetry(name, data));
    waitUntil(job);
  }

  /**
   * Registers a recurring job. No-op in inline mode (tests trigger handlers directly) and on
   * Vercel, where functions do not stay running and Vercel Cron calls the job's endpoint instead.
   */
  async schedule(name: string, everyMs: number): Promise<void> {
    if (this.env.JOBS_INLINE) return;
    if (this.env.VERCEL && !this.queue) return;
    if (this.queue) {
      await this.queue.upsertJobScheduler(name, { every: everyMs }, { name, data: {} });
      return;
    }
    const timer = setInterval(() => void this.enqueue(name), everyMs);
    timer.unref();
    this.timers.push(timer);
  }

  async run(name: string, data: Record<string, unknown>): Promise<void> {
    const handler = this.handlers.get(name);
    if (!handler) throw new Error(`No handler registered for job "${name}"`);
    await handler(data);
  }

  /** Resolves once the job succeeds or exhausts its attempts; never rejects. */
  private async runWithRetry(name: string, data: Record<string, unknown>): Promise<void> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        await this.run(name, data);
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (attempt >= MAX_ATTEMPTS) {
          this.logger.error(`Job ${name} failed after ${attempt} attempts: ${message}`);
          return;
        }
        this.logger.warn(`Job ${name} attempt ${attempt} failed (${message}); retrying`);
        await sleep(2 ** attempt * 1000, undefined, { ref: false });
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.timers.forEach(clearInterval);
    await this.worker?.close().catch(() => undefined);
    await this.queue?.close().catch(() => undefined);
    await this.connection?.quit().catch(() => undefined);
  }
}
