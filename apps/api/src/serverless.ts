import './load-env';
import 'reflect-metadata';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { loadEnv } from './config/env';

type RequestListener = (req: IncomingMessage, res: ServerResponse) => void;

let listener: Promise<RequestListener> | undefined;

/** Builds the Nest app once per function instance; warm invocations reuse it. */
async function createListener(): Promise<RequestListener> {
  const env = loadEnv();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true, bodyParser: false });
  configureApp(app, env);
  await app.init();
  return app.getHttpAdapter().getInstance() as RequestListener;
}

/** Request handler for serverless hosts (Vercel Function entry: apps/api/api/index.js). */
export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  listener ??= createListener();
  try {
    (await listener)(req, res);
  } catch (error) {
    // Let the next invocation retry start-up (for example after a database outage).
    listener = undefined;
    console.error('Failed to start API', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ statusCode: 500, error: 'Internal Server Error', message: 'The API failed to start.', code: 'STARTUP_FAILED' }));
  }
}
