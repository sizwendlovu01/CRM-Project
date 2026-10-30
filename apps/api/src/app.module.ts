import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import type { Redis } from 'ioredis';
import type { IncomingMessage } from 'node:http';
import { AppConfigModule, ENV } from './config/config.module';
import { loadEnv, type Env } from './config/env';
import { DatabaseModule } from './database/database.module';
import { RedisModule, REDIS } from './infrastructure/redis.module';
import { RedisThrottlerStorage } from './infrastructure/redis-throttler.storage';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { AuthModule } from './modules/auth/auth.module';
import { AuthGuard } from './modules/auth/auth.guard';
import { CsrfMiddleware } from './modules/auth/csrf.middleware';
import { JobsModule } from './modules/jobs/jobs.module';
import { MailModule } from './modules/mail/mail.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { UsersModule } from './modules/users/users.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';
import { CustomersModule } from './modules/customers/customers.module';
import { LeadsModule } from './modules/leads/leads.module';
import { PipelinesModule } from './modules/pipelines/pipelines.module';
import { DealsModule } from './modules/deals/deals.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { ActivitiesModule } from './modules/activities/activities.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { HealthModule, MetricsMiddleware } from './modules/health/health.module';

const env = loadEnv();

@Module({
  imports: [
    AppConfigModule,
    LoggerModule.forRoot({
      pinoHttp: {
        level: env.LOG_LEVEL,
        genReqId: (req: IncomingMessage) => {
          const header = req.headers['x-request-id'];
          return typeof header === 'string' && /^[\w-]{8,64}$/.test(header) ? header : randomUUID();
        },
        // Never log credentials, cookies or CSRF tokens.
        redact: {
          paths: [
            'req.headers.cookie',
            'req.headers.authorization',
            'req.headers["x-csrf-token"]',
            'res.headers["set-cookie"]',
            'req.body.password',
            'req.body.currentPassword',
            'req.body.newPassword',
            'req.body.token',
          ],
          censor: '[REDACTED]',
        },
        autoLogging: { ignore: (req) => /^\/(health|metrics)/.test(req.url ?? '') },
        serializers: {
          req: (req: { id: string; method: string; url: string }) => ({ id: req.id, method: req.method, url: req.url?.split('?')[0] }),
        },
        transport: env.NODE_ENV === 'development' ? { target: 'pino-pretty', options: { singleLine: true, colorize: true } } : undefined,
      },
    }),
    ThrottlerModule.forRootAsync({
      inject: [ENV, REDIS],
      useFactory: (config: Env, redis: Redis | null) => ({
        throttlers: [{ name: 'default', ttl: 60_000, limit: config.RATE_LIMIT_PER_MINUTE }],
        storage: redis ? new RedisThrottlerStorage(redis) : undefined,
      }),
    }),
    DatabaseModule,
    RedisModule,
    JobsModule,
    MailModule,
    AuditLogsModule,
    NotificationsModule,
    SubscriptionsModule,
    AuthModule,
    UsersModule,
    WorkspacesModule,
    CustomersModule,
    LeadsModule,
    PipelinesModule,
    DealsModule,
    TasksModule,
    ActivitiesModule,
    AnalyticsModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(MetricsMiddleware).forRoutes({ path: '*path', method: RequestMethod.ALL });
    consumer.apply(CsrfMiddleware).forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}
