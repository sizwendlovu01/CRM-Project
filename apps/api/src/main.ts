import './load-env';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { loadEnv } from './config/env';

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true, bodyParser: false });
  configureApp(app, env);
  await app.listen(env.PORT, '0.0.0.0');
}

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection', reason);
});

bootstrap().catch((error: unknown) => {
  console.error('Failed to start API', error);
  process.exit(1);
});
