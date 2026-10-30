import { INestApplication } from '@nestjs/common';
import { addMember, createTestApp, defaultPipeline, lastEmailToken, prisma, registerUser, TestUser } from './helpers';
import { RemindersService } from '../src/modules/notifications/reminders.service';
import { MailService } from '../src/modules/mail/mail.service';

describe('Analytics, subscriptions and notifications (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
  });

  describe('analytics', () => {
    let owner: TestUser;
    let rep: TestUser;
    let base: string;

    beforeAll(async () => {
      owner = await registerUser(app, 'analytics', 'Analytics Co');
      base = `/workspaces/${owner.workspaceId}`;
      rep = await addMember(app, owner, 'SALES_REPRESENTATIVE', 'an-rep');
      const pipeline = await defaultPipeline(owner);
      const [leadIn, , proposal, , won, lost] = pipeline.stages;

      await owner.client.post(`${base}/customers`, { fullName: 'C1' }).expect(201);
      await owner.client.post(`${base}/customers`, { fullName: 'C2' }).expect(201);
      await rep.client.post(`${base}/customers`, { fullName: 'Rep C' }).expect(201);

      await owner.client.post(`${base}/leads`, { fullName: 'L1', status: 'QUALIFIED' }).expect(201);
      const l2 = await owner.client.post(`${base}/leads`, { fullName: 'L2', email: 'l2-an@test.local' }).expect(201);
      await owner.client.post(`${base}/leads/${l2.body.id}/convert`, {}).expect(200);

      const deal = (title: string, value: number, stageId: string, client = owner.client) =>
        client.post(`${base}/deals`, { title, value, pipelineId: pipeline.id, stageId }).expect(201);
      await deal('Open A', 10000, leadIn!.id); // 10%
      await deal('Open B', 20000, proposal!.id); // 50%
      await deal('Won A', 5000, won!.id);
      await deal('Won B', 7000, won!.id, rep.client);
      await deal('Lost A', 9000, lost!.id);

      await owner.client.post(`${base}/tasks`, { title: 'Late', dueAt: new Date(Date.now() - 3_600_000).toISOString() }).expect(201);
      const done = await owner.client.post(`${base}/tasks`, { title: 'Done' }).expect(201);
      await owner.client.patch(`${base}/tasks/${done.body.id}`, { status: 'COMPLETED' }).expect(200);
    });

    it('computes KPIs from real records', async () => {
      const res = await owner.client.get(`${base}/analytics/overview`).expect(200);
      expect(res.body.kpis).toMatchObject({
        totalCustomers: 4, // 3 created + 1 from lead conversion
        newCustomers: 4,
        totalLeads: 2,
        qualifiedLeads: 1,
        convertedLeads: 1,
        leadConversionRate: 50,
        activeDeals: 2,
        pipelineValue: 30000,
        weightedPipelineValue: 10000 * 0.1 + 20000 * 0.5,
        closedWonDeals: 2,
        closedLostDeals: 1,
        revenue: 12000,
        winRate: 66.7,
        completedTasks: 1,
        overdueTasks: 1,
      });
      const revenueTotal = res.body.revenueByPeriod.reduce((sum: number, p: { value: number }) => sum + p.value, 0);
      expect(revenueTotal).toBe(12000);
      expect(res.body.revenueByPeriod.length).toBeGreaterThanOrEqual(30);
      const wonStage = res.body.pipelineByStage.find((s: { type: string }) => s.type === 'WON');
      expect(wonStage).toMatchObject({ count: 2, value: 12000, weightedValue: 12000 });
      expect(res.body.leadsByStatus).toEqual(expect.arrayContaining([{ status: 'CONVERTED', count: 1 }, { status: 'QUALIFIED', count: 1 }]));
      // Free plan: team performance is a Growth feature.
      expect(res.body.teamPerformance).toBeNull();
    });

    it('scopes sales representative analytics to their own records', async () => {
      const res = await rep.client.get(`${base}/analytics/overview`).expect(200);
      expect(res.body.kpis.totalCustomers).toBe(1);
      expect(res.body.kpis.revenue).toBe(7000);
      expect(res.body.kpis.activeDeals).toBe(0);
    });

    it('shows team performance on Growth and validates the date range', async () => {
      await owner.client.post(`${base}/subscription/change-plan`, { plan: 'GROWTH' }).expect(200);
      const res = await owner.client.get(`${base}/analytics/overview`).expect(200);
      const repRow = res.body.teamPerformance.find((r: { user: { id: string } }) => r.user.id === rep.user.id);
      expect(repRow).toMatchObject({ dealsWon: 1, revenue: 7000 });

      const future = await owner.client.get(`${base}/analytics/overview?from=2030-01-01&to=2030-01-31`).expect(200);
      expect(future.body.kpis.revenue).toBe(0);
      const bad = await owner.client.get(`${base}/analytics/overview?from=2030-02-01&to=2030-01-01`);
      expect(bad.status).toBe(400);
    });
  });

  describe('subscriptions and plan limits', () => {
    it('enforces member limits, simulates plan changes and blocks unsafe downgrades', async () => {
      const owner = await registerUser(app, 'plans', 'Plans Co');
      const base = `/workspaces/${owner.workspaceId}`;
      const summary = await owner.client.get(`${base}/subscription`).expect(200);
      expect(summary.body).toMatchObject({ plan: 'FREE', billingMode: 'simulated', usage: { members: { used: 1, limit: 3 } } });

      await owner.client.post(`${base}/invitations`, { email: 'p1@test.local', role: 'VIEWER' }).expect(201);
      await owner.client.post(`${base}/invitations`, { email: 'p2@test.local', role: 'VIEWER' }).expect(201);
      const over = await owner.client.post(`${base}/invitations`, { email: 'p3@test.local', role: 'VIEWER' });
      expect(over.status).toBe(402);
      expect(over.body.code).toBe('PLAN_LIMIT_REACHED');

      const upgraded = await owner.client.post(`${base}/subscription/change-plan`, { plan: 'STARTER' }).expect(200);
      expect(upgraded.body.plan).toBe('STARTER');
      expect(upgraded.body.currentPeriodEnd).not.toBeNull();
      await owner.client.post(`${base}/invitations`, { email: 'p3@test.local', role: 'VIEWER' }).expect(201);

      const downgrade = await owner.client.post(`${base}/subscription/change-plan`, { plan: 'FREE' });
      expect(downgrade.status).toBe(409);
      expect(downgrade.body.code).toBe('PLAN_DOWNGRADE_BLOCKED');

      const audit = await owner.client.get(`${base}/audit-logs`);
      expect(audit.status).toBe(402); // audit log is an Enterprise feature
      await owner.client.post(`${base}/subscription/change-plan`, { plan: 'ENTERPRISE' }).expect(200);
      const logs = await owner.client.get(`${base}/audit-logs`).expect(200);
      expect(logs.body.data.some((l: { action: string }) => l.action === 'subscription.plan_changed')).toBe(true);
    });

    it('enforces record limits', async () => {
      const owner = await registerUser(app, 'limits', 'Limits Co');
      await prisma(app).customer.createMany({
        data: Array.from({ length: 250 }, (_, i) => ({ workspaceId: owner.workspaceId, fullName: `Bulk ${i}` })),
      });
      const res = await owner.client.post(`/workspaces/${owner.workspaceId}/customers`, { fullName: 'One too many' });
      expect(res.status).toBe(402);
      expect(res.body.code).toBe('PLAN_LIMIT_REACHED');
    });
  });

  describe('notifications', () => {
    it('lists, counts, marks read and honours preferences', async () => {
      const owner = await registerUser(app, 'notif', 'Notif Co');
      const base = `/workspaces/${owner.workspaceId}`;
      const rep = await addMember(app, owner, 'SALES_REPRESENTATIVE', 'notif-rep');
      await rep.client.post('/notifications/read-all').expect(200); // clear the invitation notification

      await owner.client.post(`${base}/tasks`, { title: 'T1', assignedToId: rep.user.id }).expect(201);
      await owner.client.post(`${base}/leads`, { fullName: 'Assigned lead', assignedToId: rep.user.id }).expect(201);
      // Task assignment emails are on by default.
      const mail = app.get(MailService);
      expect(mail.outbox.some((m) => m.to === rep.email && m.subject.includes('New task: T1'))).toBe(true);

      let count = await rep.client.get(`/notifications/unread-count?workspaceId=${owner.workspaceId}`).expect(200);
      expect(count.body.count).toBe(2);
      const list = await rep.client.get(`/notifications?workspaceId=${owner.workspaceId}`).expect(200);
      await rep.client.post(`/notifications/${list.body.data[0].id}/read`).expect(204);
      count = await rep.client.get(`/notifications/unread-count?workspaceId=${owner.workspaceId}`).expect(200);
      expect(count.body.count).toBe(1);
      await rep.client.post(`/notifications/read-all?workspaceId=${owner.workspaceId}`).expect(200);
      count = await rep.client.get(`/notifications/unread-count?workspaceId=${owner.workspaceId}`).expect(200);
      expect(count.body.count).toBe(0);

      const prefs = await rep.client.get('/notifications/preferences').expect(200);
      expect(prefs.body.find((p: { type: string }) => p.type === 'TASK_ASSIGNED')).toEqual({ type: 'TASK_ASSIGNED', inApp: true, email: true });
      await rep.client.put('/notifications/preferences', { preferences: [{ type: 'TASK_ASSIGNED', inApp: false, email: false }] }).expect(200);
      const before = mail.outbox.length;
      await owner.client.post(`${base}/tasks`, { title: 'T2', assignedToId: rep.user.id }).expect(201);
      expect(mail.outbox.length).toBe(before);
      count = await rep.client.get(`/notifications/unread-count?workspaceId=${owner.workspaceId}`).expect(200);
      expect(count.body.count).toBe(0);
    });

    it('sends due-soon and overdue reminders exactly once per due date', async () => {
      const owner = await registerUser(app, 'remind', 'Remind Co');
      const base = `/workspaces/${owner.workspaceId}`;
      const rep = await addMember(app, owner, 'SALES_REPRESENTATIVE', 'remind-rep');
      await owner.client.post(`${base}/tasks`, { title: 'Due soon', dueAt: new Date(Date.now() + 3_600_000).toISOString(), assignedToId: rep.user.id }).expect(201);
      await owner.client.post(`${base}/tasks`, { title: 'Overdue', dueAt: new Date(Date.now() - 3_600_000).toISOString(), assignedToId: rep.user.id }).expect(201);

      const reminders = app.get(RemindersService);
      await reminders.scan();
      await reminders.scan();
      const rows = await prisma(app).notification.findMany({ where: { userId: rep.user.id, type: { in: ['TASK_DUE_SOON', 'TASK_OVERDUE'] } } });
      expect(rows.filter((r) => r.title.includes('Due soon') && r.type === 'TASK_DUE_SOON')).toHaveLength(1);
      expect(rows.filter((r) => r.title.includes('Overdue') && r.type === 'TASK_OVERDUE')).toHaveLength(1);
    });

    it('notifies invited users who already have an account', async () => {
      const owner = await registerUser(app, 'inviter', 'Invite Co');
      const invitee = await registerUser(app, 'invitee');
      await owner.client.post(`/workspaces/${owner.workspaceId}/invitations`, { email: invitee.email, role: 'MANAGER' }).expect(201);
      const list = await invitee.client.get('/notifications').expect(200);
      expect(list.body.data[0]).toMatchObject({ type: 'WORKSPACE_INVITATION', workspaceId: null });
      expect(lastEmailToken(app, invitee.email, '/invite/')).toBeTruthy();
    });
  });
});
