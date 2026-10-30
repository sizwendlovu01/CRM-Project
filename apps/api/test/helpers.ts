import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { CurrentUser, Role } from '@crm/shared';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { loadEnv } from '../src/config/env';
import { PrismaService } from '../src/database/prisma.service';
import { MailService } from '../src/modules/mail/mail.service';

export const API = '/api/v1';
export const PASSWORD = 'IntegrationPass123';

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ bodyParser: false, logger: false });
  configureApp(app, loadEnv(), { useLogger: false });
  await app.init();
  return app;
}

export function uniqueEmail(prefix = 'user'): string {
  return `${prefix}-${randomUUID().slice(0, 8)}@test.local`;
}

type Method = 'get' | 'post' | 'patch' | 'put' | 'delete';

/** Cookie-aware HTTP client that performs the CSRF double-submit like the browser app. */
export class ApiClient {
  readonly agent: ReturnType<typeof request.agent>;
  private csrf = '';

  constructor(private readonly app: INestApplication) {
    this.agent = request.agent(app.getHttpServer());
  }

  async init(): Promise<this> {
    const res = await this.agent.get(`${API}/auth/csrf`).expect(200);
    this.csrf = res.body.csrfToken;
    return this;
  }

  private refreshCsrf(res: { headers: Record<string, unknown> }) {
    const cookies = res.headers['set-cookie'] as string[] | undefined;
    const csrf = cookies?.find((c) => c.startsWith('crm_csrf='));
    if (csrf) this.csrf = decodeURIComponent(csrf.split(';')[0]!.slice('crm_csrf='.length));
  }

  /** Returns a chainable supertest request; CSRF rotation is tracked from every response. */
  request(method: Method, path: string, body?: unknown) {
    const req = this.agent[method](`${API}${path}`);
    if (method !== 'get') req.set('X-CSRF-Token', this.csrf);
    if (body !== undefined) req.send(body as object);
    req.on('response', (res: { headers: Record<string, unknown> }) => this.refreshCsrf(res));
    return req;
  }

  get(path: string) {
    return this.request('get', path);
  }
  post(path: string, body?: unknown) {
    return this.request('post', path, body ?? {});
  }
  patch(path: string, body: unknown) {
    return this.request('patch', path, body);
  }
  put(path: string, body: unknown) {
    return this.request('put', path, body);
  }
  delete(path: string) {
    return this.request('delete', path);
  }

  upload(path: string, field: string, content: string, filename = 'customers.csv', contentType = 'text/csv') {
    return this.agent
      .post(`${API}${path}`)
      .set('X-CSRF-Token', this.csrf)
      .attach(field, Buffer.from(content), { filename, contentType });
  }
}

export interface TestUser {
  client: ApiClient;
  user: CurrentUser;
  email: string;
  workspaceId: string;
  workspaceSlug: string;
}

export async function registerUser(app: INestApplication, prefix = 'owner', workspaceName = 'Test Workspace'): Promise<TestUser> {
  const client = await new ApiClient(app).init();
  const email = uniqueEmail(prefix);
  const res = await client.post('/auth/register', { name: `${prefix} user`, email, password: PASSWORD, workspaceName });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  const user = res.body as CurrentUser;
  const membership = user.memberships[0]!;
  return { client, user, email, workspaceId: membership.workspace.id, workspaceSlug: membership.workspace.slug };
}

/** Extracts the token from the most recent email sent to an address (memory transport). */
export function lastEmailToken(app: INestApplication, to: string, pathPart: string): string {
  const mail = app.get(MailService);
  const message = [...mail.outbox].reverse().find((m) => m.to === to && m.text.includes(pathPart));
  if (!message) throw new Error(`No email containing ${pathPart} sent to ${to}`);
  const match = message.text.match(new RegExp(`${pathPart.replace(/[?/]/g, '\\$&')}([A-Za-z0-9_%-]+)`));
  if (!match?.[1]) throw new Error('Token not found in email');
  return decodeURIComponent(match[1]);
}

/** Invites a new user with a role and accepts the invitation through the public API flow. */
export async function addMember(app: INestApplication, owner: TestUser, role: Exclude<Role, 'OWNER'>, prefix: string = role.toLowerCase()) {
  const member = await registerUser(app, prefix, `${prefix} personal`);
  const invite = await owner.client.post(`/workspaces/${owner.workspaceId}/invitations`, { email: member.email, role });
  if (invite.status !== 201) throw new Error(`invite failed: ${invite.status} ${JSON.stringify(invite.body)}`);
  const token = lastEmailToken(app, member.email, '/invite/');
  const accept = await member.client.post(`/invitations/${token}/accept`);
  if (accept.status !== 200) throw new Error(`accept failed: ${accept.status} ${JSON.stringify(accept.body)}`);
  return { ...member, workspaceId: owner.workspaceId, workspaceSlug: owner.workspaceSlug };
}

export function prisma(app: INestApplication): PrismaService {
  return app.get(PrismaService);
}

export async function defaultPipeline(user: TestUser) {
  const res = await user.client.get(`/workspaces/${user.workspaceId}/pipelines`).expect(200);
  return res.body[0] as { id: string; stages: { id: string; name: string; type: string; probability: number }[] };
}
