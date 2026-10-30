import { INestApplication } from '@nestjs/common';
import { createTestApp, defaultPipeline, registerUser, TestUser } from './helpers';

/**
 * Cross-tenant isolation: a user of workspace B must never read, modify, delete or reference
 * records of workspace A, even with valid ids taken from A.
 */
describe('Tenant isolation (integration)', () => {
  let app: INestApplication;
  let a: TestUser;
  let b: TestUser;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    app = await createTestApp();
    a = await registerUser(app, 'tenant-a', 'Tenant A');
    b = await registerUser(app, 'tenant-b', 'Tenant B');

    const base = `/workspaces/${a.workspaceId}`;
    ids.customer = (await a.client.post(`${base}/customers`, { fullName: 'A Customer', email: 'a-customer@test.local' })).body.id;
    ids.lead = (await a.client.post(`${base}/leads`, { fullName: 'A Lead' })).body.id;
    const pipeline = await defaultPipeline(a);
    ids.pipeline = pipeline.id;
    ids.stage = pipeline.stages[0]!.id;
    ids.deal = (await a.client.post(`${base}/deals`, { title: 'A Deal', value: 1000, pipelineId: ids.pipeline, stageId: ids.stage })).body.id;
    ids.task = (await a.client.post(`${base}/tasks`, { title: 'A Task', customerId: ids.customer })).body.id;
    ids.activity = (await a.client.post(`${base}/activities`, { type: 'CALL', subject: 'A call', customerId: ids.customer })).body.id;
    ids.note = (await a.client.post(`${base}/notes`, { body: 'Secret note', customerId: ids.customer })).body.id;
    for (const [key, value] of Object.entries(ids)) if (!value) throw new Error(`fixture ${key} missing`);
  });

  afterAll(async () => {
    await app.close();
  });

  it('hides workspace A entirely from user B', async () => {
    const res = await b.client.get(`/workspaces/${a.workspaceId}`);
    expect(res.status).toBe(404);
    for (const path of ['customers', 'leads', 'deals', 'tasks', 'activities', 'pipelines', 'members', 'subscription', 'analytics/overview']) {
      expect((await b.client.get(`/workspaces/${a.workspaceId}/${path}`)).status).toBe(404);
    }
  });

  it('prevents IDOR by using A ids inside B workspace routes', async () => {
    const base = `/workspaces/${b.workspaceId}`;
    expect((await b.client.get(`${base}/customers/${ids.customer}`)).status).toBe(404);
    expect((await b.client.get(`${base}/leads/${ids.lead}`)).status).toBe(404);
    expect((await b.client.get(`${base}/deals/${ids.deal}`)).status).toBe(404);
    expect((await b.client.get(`${base}/tasks/${ids.task}`)).status).toBe(404);
    expect((await b.client.get(`${base}/customers/${ids.customer}/timeline`)).status).toBe(404);
    expect((await b.client.get(`${base}/pipelines/${ids.pipeline}`)).status).toBe(404);
    expect((await b.client.get(`${base}/pipelines/${ids.pipeline}/board`)).status).toBe(404);

    expect((await b.client.patch(`${base}/customers/${ids.customer}`, { fullName: 'Hacked' })).status).toBe(404);
    expect((await b.client.patch(`${base}/leads/${ids.lead}`, { fullName: 'Hacked' })).status).toBe(404);
    expect((await b.client.patch(`${base}/deals/${ids.deal}`, { title: 'Hacked' })).status).toBe(404);
    expect((await b.client.patch(`${base}/tasks/${ids.task}`, { title: 'Hacked' })).status).toBe(404);
    expect((await b.client.post(`${base}/leads/${ids.lead}/convert`, {})).status).toBe(404);
    expect((await b.client.post(`${base}/deals/${ids.deal}/move`, { stageId: ids.stage })).status).toBe(404);
    expect((await b.client.delete(`${base}/customers/${ids.customer}`)).status).toBe(404);
    expect((await b.client.delete(`${base}/activities/${ids.activity}`)).status).toBe(404);
    expect((await b.client.delete(`${base}/notes/${ids.note}`)).status).toBe(404);

    const notes = await b.client.get(`${base}/notes?customerId=${ids.customer}`);
    expect(notes.status).toBe(200);
    expect(notes.body).toEqual([]);
  });

  it('rejects cross-tenant references in B records', async () => {
    const base = `/workspaces/${b.workspaceId}`;
    const bPipeline = await defaultPipeline(b);

    const dealWithForeignCustomer = await b.client.post(`${base}/deals`, {
      title: 'B deal', value: 10, pipelineId: bPipeline.id, stageId: bPipeline.stages[0]!.id, customerId: ids.customer,
    });
    expect(dealWithForeignCustomer.status).toBe(400);
    expect(dealWithForeignCustomer.body.code).toBe('INVALID_REFERENCE');

    const dealWithForeignStage = await b.client.post(`${base}/deals`, { title: 'B deal', value: 10, pipelineId: bPipeline.id, stageId: ids.stage });
    expect(dealWithForeignStage.status).toBe(400);

    const taskForForeignDeal = await b.client.post(`${base}/tasks`, { title: 'x', dealId: ids.deal });
    expect(taskForForeignDeal.status).toBe(400);

    const assignToForeignUser = await b.client.post(`${base}/customers`, { fullName: 'x', assignedToId: a.user.id });
    expect(assignToForeignUser.status).toBe(400);

    const activityOnForeignCustomer = await b.client.post(`${base}/activities`, { type: 'NOTE', subject: 'x', customerId: ids.customer });
    expect(activityOnForeignCustomer.status).toBe(400);
  });

  it('keeps list, search and analytics results scoped to the workspace', async () => {
    const base = `/workspaces/${b.workspaceId}`;
    const customers = await b.client.get(`${base}/customers?q=A%20Customer`).expect(200);
    expect(customers.body.meta.total).toBe(0);
    const search = await b.client.get(`${base}/search?q=A`).expect(200);
    expect(search.body.customers).toHaveLength(0);
    expect(search.body.deals).toHaveLength(0);
    const analytics = await b.client.get(`${base}/analytics/overview`).expect(200);
    expect(analytics.body.kpis.totalCustomers).toBe(0);
    expect(analytics.body.kpis.pipelineValue).toBe(0);
  });

  it('does not leak A data after the failed attempts', async () => {
    const customer = await a.client.get(`/workspaces/${a.workspaceId}/customers/${ids.customer}`).expect(200);
    expect(customer.body.fullName).toBe('A Customer');
    const deal = await a.client.get(`/workspaces/${a.workspaceId}/deals/${ids.deal}`).expect(200);
    expect(deal.body.title).toBe('A Deal');
  });

  it('isolates notifications per user', async () => {
    const notifications = await a.client.get('/notifications').expect(200);
    for (const n of notifications.body.data as { id: string }[]) {
      await b.client.post(`/notifications/${n.id}/read`).expect(204);
    }
    const after = await a.client.get('/notifications?unreadOnly=true').expect(200);
    expect(after.body.meta.total).toBe(notifications.body.unreadCount);
  });
});
