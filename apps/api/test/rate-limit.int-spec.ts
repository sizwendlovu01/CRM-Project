import type { INestApplication } from '@nestjs/common';

describe('Rate limiting (integration)', () => {
  let app: INestApplication;
  let helpers: typeof import('./helpers');

  beforeAll(async () => {
    // Static @Throttle limits are read at import time, so configure before loading the app.
    process.env.AUTH_RATE_LIMIT_PER_MINUTE = '3';
    helpers = await import('./helpers');
    app = await helpers.createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('throttles repeated login attempts with 429', async () => {
    const client = await new helpers.ApiClient(app).init();
    const statuses: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      const res = await client.post('/auth/login', { email: 'nobody@test.local', password: 'WrongPassword1' });
      statuses.push(res.status);
      if (res.status === 429) expect(res.body.code).toBe('RATE_LIMITED');
    }
    expect(statuses.slice(0, 3)).toEqual([401, 401, 401]);
    expect(statuses.slice(3)).toEqual([429, 429]);
  });
});
