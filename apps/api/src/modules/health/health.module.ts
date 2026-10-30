import { Controller, Get, Header, Inject, Injectable, Module, NestMiddleware, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { NextFunction, Request, Response } from 'express';
import type { Redis } from 'ioredis';
import { collectDefaultMetrics, Histogram, Registry } from 'prom-client';
import { Public } from '../../common/decorators';
import { PrismaService } from '../../database/prisma.service';
import { REDIS } from '../../infrastructure/redis.module';
import { JobsService } from '../jobs/jobs.service';

export const metricsRegistry = new Registry();
collectDefaultMetrics({ register: metricsRegistry, prefix: 'crm_' });

const httpDuration = new Histogram({
  name: 'crm_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [metricsRegistry],
});

/** Records request latency per route template (not raw URL, to keep label cardinality bounded). */
@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const end = httpDuration.startTimer();
    res.on('finish', () => {
      const route = (req.route as { path?: string } | undefined)?.path ?? 'unmatched';
      end({ method: req.method, route: `${req.baseUrl ?? ''}${route}`, status: String(res.statusCode) });
    });
    next();
  }
}

@ApiExcludeController()
@SkipThrottle()
@Controller()
class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    @Inject(REDIS) private readonly redis: Redis | null,
  ) {}

  @Public()
  @Get('health/live')
  live() {
    return { status: 'ok' };
  }

  @Public()
  @Get('health')
  async health(@Res({ passthrough: true }) res: Response) {
    const database = await this.prisma.$queryRaw`SELECT 1`.then(() => 'up' as const).catch(() => 'down' as const);
    const redis = this.redis
      ? await this.redis.ping().then(() => 'up' as const).catch(() => 'down' as const)
      : ('not_configured' as const);
    const healthy = database === 'up' && redis !== 'down';
    res.status(healthy ? 200 : 503);
    return { status: healthy ? 'ok' : 'degraded', database, redis, jobs: this.jobs.mode, uptimeSeconds: Math.round(process.uptime()) };
  }

  @Public()
  @Get('metrics')
  @Header('Content-Type', metricsRegistry.contentType)
  metrics() {
    return metricsRegistry.metrics();
  }
}

@Module({ controllers: [HealthController], providers: [MetricsMiddleware] })
export class HealthModule {}
