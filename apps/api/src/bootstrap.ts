import { INestApplication, RequestMethod } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { trustedClientIp } from './common/client-ip';
import type { Env } from './config/env';

/**
 * Shared HTTP configuration used by main.ts and by integration tests, so tests exercise
 * exactly the same middleware stack (cookies, CSRF, prefixes, error handling) as production.
 */
export function configureApp(app: INestApplication, env: Env, options: { useLogger?: boolean } = {}): void {
  const express = app as NestExpressApplication;
  if (options.useLogger !== false) app.useLogger(app.get(Logger));

  if (env.TRUST_PROXY) express.set('trust proxy', 1);
  if (env.PROXY_SECRET) app.use(trustedClientIp(env.PROXY_SECRET));
  express.disable('x-powered-by');
  express.useBodyParser('json', { limit: '1mb' });

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          // Swagger UI needs inline styles/scripts on /api/docs only.
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  app.use(cookieParser());
  app.enableCors({
    origin: env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-Request-Id'],
  });

  app.setGlobalPrefix('api/v1', {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: 'health/live', method: RequestMethod.GET },
      { path: 'metrics', method: RequestMethod.GET },
    ],
  });
  app.enableShutdownHooks();

  const swaggerEnabled = env.SWAGGER_ENABLED ?? env.NODE_ENV !== 'production';
  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('Enterprise SaaS CRM API')
      .setDescription(
        'Multi-tenant CRM REST API. Authenticate with POST /api/v1/auth/login (session cookie). ' +
          'State-changing requests must send the crm_csrf cookie value in the X-CSRF-Token header.',
      )
      .setVersion('1.0.0')
      .addCookieAuth('crm_session')
      .build();
    SwaggerModule.setup('api/docs', app, () => SwaggerModule.createDocument(app, config), { jsonDocumentUrl: 'api/docs-json' });
  }
}
