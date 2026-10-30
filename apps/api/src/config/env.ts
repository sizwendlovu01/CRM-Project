import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false', '1', '0'])
  .optional()
  .transform((value) => value === 'true' || value === '1');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    REDIS_URL: z.string().optional().transform((v) => (v ? v : undefined)),
    APP_URL: z.string().url().default('http://localhost:3000'),
    CORS_ORIGINS: z.string().default('http://localhost:3000'),
    SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
    SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),
    COOKIE_SECURE: booleanString,
    TRUST_PROXY: booleanString,
    SMTP_HOST: z.string().default('localhost'),
    SMTP_PORT: z.coerce.number().int().positive().default(1025),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    SMTP_SECURE: booleanString,
    MAIL_FROM: z.string().default('Enterprise CRM <no-reply@crm.local>'),
    MAIL_TRANSPORT: z.enum(['smtp', 'memory']).default('smtp'),
    JOBS_INLINE: booleanString,
    RUN_WORKER: z
      .enum(['true', 'false'])
      .default('true')
      .transform((v) => v === 'true'),
    RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(600),
    AUTH_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(10),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    SWAGGER_ENABLED: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === 'true')),
    METRICS_ENABLED: z
      .enum(['true', 'false'])
      .default('true')
      .transform((v) => v === 'true'),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.MAIL_TRANSPORT === 'memory') {
      ctx.addIssue({ code: 'custom', path: ['MAIL_TRANSPORT'], message: 'memory transport is not allowed in production' });
    }
  });

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/** Parses and validates process.env once. Throws with a readable message on misconfiguration. */
export function loadEnv(): Env {
  if (cached) return cached;
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = result.data;
  return cached;
}

/** Test helper: forget the cached environment so tests can change variables. */
export function resetEnvCache(): void {
  cached = undefined;
}
