import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { API, ApiClient, createTestApp, lastEmailToken, PASSWORD, prisma, registerUser, uniqueEmail } from './helpers';

describe('Authentication (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('registers a user with a workspace, default pipeline and session', async () => {
    const owner = await registerUser(app, 'reg', 'Acme Corp');
    expect(owner.user.memberships).toHaveLength(1);
    expect(owner.user.memberships[0]).toMatchObject({ role: 'OWNER', workspace: { name: 'Acme Corp', plan: 'FREE' } });
    expect(owner.user.emailVerified).toBe(false);

    const me = await owner.client.get('/auth/me').expect(200);
    expect(me.body.email).toBe(owner.email);

    const pipelines = await owner.client.get(`/workspaces/${owner.workspaceId}/pipelines`).expect(200);
    expect(pipelines.body[0].stages.map((s: { name: string }) => s.name)).toEqual([
      'Lead In', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost',
    ]);

    const user = await prisma(app).user.findUniqueOrThrow({ where: { email: owner.email } });
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(user.passwordHash).not.toContain(PASSWORD);
  });

  it('rejects duplicate emails and invalid input', async () => {
    const owner = await registerUser(app, 'dup');
    const client = await new ApiClient(app).init();
    const dup = await client.post('/auth/register', { name: 'Dup', email: owner.email.toUpperCase(), password: PASSWORD, workspaceName: 'X Co' });
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe('EMAIL_TAKEN');

    const invalid = await client.post('/auth/register', { name: 'A', email: 'nope', password: 'short', workspaceName: '' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.code).toBe('VALIDATION_FAILED');
    expect(invalid.body.details.map((d: { path: string }) => d.path).sort()).toEqual(['email', 'name', 'password', 'password', 'workspaceName'].sort());
  });

  it('logs in, logs out and invalidates the session', async () => {
    const owner = await registerUser(app, 'login');
    const client = await new ApiClient(app).init();

    const wrong = await client.post('/auth/login', { email: owner.email, password: 'WrongPassword1' });
    expect(wrong.status).toBe(401);
    expect(wrong.body.code).toBe('INVALID_CREDENTIALS');

    const unknown = await client.post('/auth/login', { email: uniqueEmail('ghost'), password: 'WrongPassword1' });
    expect(unknown.status).toBe(401);
    expect(unknown.body.message).toBe(wrong.body.message);

    const ok = await client.post('/auth/login', { email: owner.email, password: PASSWORD });
    expect(ok.status).toBe(200);
    const cookies = ok.headers['set-cookie'] as unknown as string[];
    const session = cookies.find((c) => c.startsWith('crm_session='))!;
    expect(session).toMatch(/HttpOnly/i);
    expect(session).toMatch(/SameSite=Lax/i);

    await client.get('/auth/me').expect(200);
    await client.post('/auth/logout').expect(204);
    const after = await client.get('/auth/me');
    expect(after.status).toBe(401);
    expect(after.body.code).toBe('UNAUTHENTICATED');
  });

  it('rejects unauthenticated access and forged session cookies', async () => {
    await request(app.getHttpServer()).get(`${API}/workspaces`).expect(401);
    await request(app.getHttpServer()).get(`${API}/auth/me`).set('Cookie', 'crm_session=forged-token-value-that-is-long-enough').expect(401);
  });

  it('expires sessions server-side', async () => {
    const owner = await registerUser(app, 'expiry');
    await prisma(app).session.updateMany({ where: { userId: owner.user.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const res = await owner.client.get('/auth/me');
    expect(res.status).toBe(401);
  });

  it('enforces CSRF tokens on state-changing requests', async () => {
    const owner = await registerUser(app, 'csrf');
    const noToken = await owner.client.agent.post(`${API}/workspaces`).send({ name: 'Nope' });
    expect(noToken.status).toBe(403);
    const forged = await owner.client.agent.post(`${API}/workspaces`).set('X-CSRF-Token', 'abc.def').send({ name: 'Nope' });
    expect(forged.status).toBe(403);
  });

  it('locks the account after repeated failures', async () => {
    const owner = await registerUser(app, 'lock');
    const client = await new ApiClient(app).init();
    for (let i = 0; i < 10; i += 1) {
      await client.post('/auth/login', { email: owner.email, password: 'WrongPassword1' }).then((r) => expect(r.status).toBe(401));
    }
    const locked = await client.post('/auth/login', { email: owner.email, password: PASSWORD });
    expect(locked.status).toBe(429);
    expect(locked.body.code).toBe('ACCOUNT_LOCKED');
  });

  it('resets a password with a single-use emailed token and revokes sessions', async () => {
    const owner = await registerUser(app, 'reset');
    const anon = await new ApiClient(app).init();

    const unknown = await anon.post('/auth/forgot-password', { email: uniqueEmail('nobody') });
    expect(unknown.status).toBe(200);

    await anon.post('/auth/forgot-password', { email: owner.email }).expect(200);
    const token = lastEmailToken(app, owner.email, '/reset-password?token=');

    const weak = await anon.post('/auth/reset-password', { token, password: 'weak' });
    expect(weak.status).toBe(400);

    await anon.post('/auth/reset-password', { token, password: 'BrandNewPass456' }).expect(200);
    const reuse = await anon.post('/auth/reset-password', { token, password: 'AnotherPass789' });
    expect(reuse.status).toBe(400);
    expect(reuse.body.code).toBe('INVALID_TOKEN');

    // Existing session was revoked.
    expect((await owner.client.get('/auth/me')).status).toBe(401);
    expect((await anon.post('/auth/login', { email: owner.email, password: PASSWORD })).status).toBe(401);
    await anon.post('/auth/login', { email: owner.email, password: 'BrandNewPass456' }).expect(200);
  });

  it('rejects expired reset tokens', async () => {
    const owner = await registerUser(app, 'expired');
    const anon = await new ApiClient(app).init();
    await anon.post('/auth/forgot-password', { email: owner.email }).expect(200);
    const token = lastEmailToken(app, owner.email, '/reset-password?token=');
    await prisma(app).authToken.updateMany({ where: { userId: owner.user.id, type: 'PASSWORD_RESET' }, data: { expiresAt: new Date(Date.now() - 1) } });
    const res = await anon.post('/auth/reset-password', { token, password: 'BrandNewPass456' });
    expect(res.status).toBe(400);
  });

  it('verifies email addresses', async () => {
    const owner = await registerUser(app, 'verify');
    const token = lastEmailToken(app, owner.email, '/verify-email?token=');
    await owner.client.post('/auth/verify-email', { token }).expect(200);
    const me = await owner.client.get('/auth/me').expect(200);
    expect(me.body.emailVerified).toBe(true);
    const again = await owner.client.post('/auth/resend-verification');
    expect(again.body.code).toBe('ALREADY_VERIFIED');
  });

  it('updates the profile, changes password and manages sessions', async () => {
    const owner = await registerUser(app, 'profile');
    const second = await new ApiClient(app).init();
    await second.post('/auth/login', { email: owner.email, password: PASSWORD }).expect(200);

    const profile = await owner.client.patch('/users/me', { name: 'Renamed User', jobTitle: 'VP Sales', phone: '+27 11 555 0000', timezone: 'Africa/Johannesburg' });
    expect(profile.status).toBe(200);
    expect(profile.body).toMatchObject({ name: 'Renamed User', jobTitle: 'VP Sales', timezone: 'Africa/Johannesburg' });

    const sessions = await owner.client.get('/users/me/sessions').expect(200);
    expect(sessions.body).toHaveLength(2);
    expect(sessions.body.filter((s: { current: boolean }) => s.current)).toHaveLength(1);

    const badCurrent = await owner.client.post('/users/me/password', { currentPassword: 'Wrong1234567', newPassword: 'ChangedPass999' });
    expect(badCurrent.status).toBe(400);
    expect(badCurrent.body.code).toBe('INVALID_PASSWORD');

    await owner.client.post('/users/me/password', { currentPassword: PASSWORD, newPassword: 'ChangedPass999' }).expect(200);
    expect((await second.get('/auth/me')).status).toBe(401);
    await owner.client.get('/auth/me').expect(200);
  });
});
