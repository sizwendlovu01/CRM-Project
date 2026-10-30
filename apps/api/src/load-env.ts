import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Loads apps/api/.env for local development (Node's built-in loader, no dependency).
 * Variables already present in the environment (Docker, CI) always take precedence.
 */
const file = resolve(process.cwd(), '.env');
if (process.env.NODE_ENV !== 'test' && existsSync(file)) process.loadEnvFile(file);
