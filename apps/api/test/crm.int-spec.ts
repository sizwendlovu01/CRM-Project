import { INestApplication } from '@nestjs/common';
import { addMember, createTestApp, defaultPipeline, prisma, registerUser, TestUser } from './helpers';

describe('CRM records (integration)', () => {
  let app: INestApplication;
  let owner: TestUser;
  let base: string;

  beforeAll(async () => {
    app = await createTestApp();
    owner = await registerUser(app, 'crm', 'CRM Co');
    base = `/workspaces/${owner.workspaceId}`;
    await owner.client.post(`${base}/subscription/change-plan`, { plan: 'GROWTH' }).expect(200);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('customers', () => {
    it('supports CRUD, search, filtering, sorting and pagination', async () => {
      const names = ['Zara Zulu', 'Adam Abbott', 'Mia Moore'];
      for (const [i, fullName] of names.entries()) {
        await owner.client
          .post(`${base}/customers`, { fullName, company: `Company ${i}`, email: `c${i}-crm@test.local`, status: i === 0 ? 'ACTIVE' : 'PROSPECT' })
          .expect(201);
      }
      const sorted = await owner.client.get(`${base}/customers?sortBy=fullName&sortDir=asc&pageSize=2`).expect(200);
      expect(sorted.body.data.map((c: { fullName: string }) => c.fullName)).toEqual(['Adam Abbott', 'Mia Moore']);
      expect(sorted.body.meta).toMatchObject({ total: 3, totalPages: 2, page: 1 });

      const page2 = await owner.client.get(`${base}/customers?sortBy=fullName&sortDir=asc&pageSize=2&page=2`).expect(200);
      expect(page2.body.data[0].fullName).toBe('Zara Zulu');

      const search = await owner.client.get(`${base}/customers?q=company%201`).expect(200);
      expect(search.body.data.map((c: { fullName: string }) => c.fullName)).toEqual(['Adam Abbott']);

      const filtered = await owner.client.get(`${base}/customers?status=ACTIVE`).expect(200);
      expect(filtered.body.data).toHaveLength(1);

      const invalidQuery = await owner.client.get(`${base}/customers?pageSize=1000`);
      expect(invalidQuery.status).toBe(400);

      const id = sorted.body.data[0].id;
      const updated = await owner.client.patch(`${base}/customers/${id}`, { status: 'ACTIVE', industry: 'Mining' }).expect(200);
      expect(updated.body).toMatchObject({ status: 'ACTIVE', industry: 'Mining' });

      const detail = await owner.client.get(`${base}/customers/${id}`).expect(200);
      expect(detail.body.stats).toEqual({ openDeals: 0, openDealValue: 0, wonDealValue: 0, openTasks: 0 });

      await owner.client.post(`${base}/customers/${id}/archive`).expect(200);
      expect((await owner.client.get(`${base}/customers`)).body.meta.total).toBe(2);
      expect((await owner.client.get(`${base}/customers?archived=true`)).body.meta.total).toBe(1);
      await owner.client.post(`${base}/customers/${id}/restore`).expect(200);

      await owner.client.delete(`${base}/customers/${id}`).expect(204);
      expect((await owner.client.get(`${base}/customers/${id}`)).status).toBe(404);
      expect((await owner.client.get(`${base}/customers/not-a-uuid`)).status).toBe(400);
    });

    it('detects duplicates by email on create and update', async () => {
      const first = await owner.client.post(`${base}/customers`, { fullName: 'Dup One', email: 'dup-one@test.local', phone: '+27 82 111 2222' }).expect(201);
      const dup = await owner.client.post(`${base}/customers`, { fullName: 'Dup Two', email: 'DUP-ONE@test.local' });
      expect(dup.status).toBe(409);
      expect(dup.body.code).toBe('DUPLICATE_CUSTOMER');

      const second = await owner.client.post(`${base}/customers`, { fullName: 'Dup Two', phone: '+27 (82) 111-2222' }).expect(201);
      const clash = await owner.client.patch(`${base}/customers/${second.body.id}`, { email: 'dup-one@test.local' });
      expect(clash.status).toBe(409);

      const groups = await owner.client.get(`${base}/customers/duplicates`).expect(200);
      const phoneGroup = groups.body.find((g: { reason: string; value: string }) => g.reason === 'phone' && g.value === '27821112222');
      expect(phoneGroup.customers.map((c: { id: string }) => c.id).sort()).toEqual([first.body.id, second.body.id].sort());
    });

    it('exports CSV with formula protection and imports CSV with duplicates and errors', async () => {
      await owner.client.post(`${base}/customers`, { fullName: '=HYPERLINK("evil")', email: 'formula@test.local' }).expect(201);
      const exported = await owner.client.get(`${base}/customers/export?q=formula`).expect(200);
      expect(exported.headers['content-type']).toMatch(/text\/csv/);
      expect(exported.text.split('\r\n')[0]).toContain('Full Name,Company,Email');
      expect(exported.text).toContain(`"'=HYPERLINK(""evil"")"`);

      const csv = [
        'Full Name,Company,Email,Phone,Status,Source',
        'Import One,Imp Ltd,import-one@test.local,+27 11 000 0001,Active,Website',
        'Import Two,Imp Ltd,formula@test.local,,Prospect,',
        ',No Name Ltd,noname@test.local,,,',
        'Import Three,Imp Ltd,import-one@test.local,,,',
        'Bad Email,Imp Ltd,not-an-email,,,',
      ].join('\n');
      const result = await owner.client.upload(`${base}/customers/import`, 'file', csv).expect(200);
      expect(result.body).toEqual({
        totalRows: 5,
        created: 1,
        skippedDuplicates: 2,
        errors: [
          { row: 4, message: expect.stringContaining('fullName') },
          { row: 6, message: expect.stringContaining('email') },
        ],
      });
      const imported = await owner.client.get(`${base}/customers?q=import-one`).expect(200);
      expect(imported.body.data[0]).toMatchObject({ fullName: 'Import One', status: 'ACTIVE', source: 'WEBSITE' });

      const wrongType = await owner.client.upload(`${base}/customers/import`, 'file', 'x', 'data.exe', 'application/octet-stream');
      expect(wrongType.status).toBe(400);
      expect(wrongType.body.code).toBe('INVALID_FILE_TYPE');
      const noName = await owner.client.upload(`${base}/customers/import`, 'file', 'Email\na@b.com');
      expect(noName.body.code).toBe('INVALID_CSV');
    });

    it('blocks CSV import on the Free plan', async () => {
      const free = await registerUser(app, 'free-import');
      const res = await free.client.upload(`/workspaces/${free.workspaceId}/customers/import`, 'file', 'Full Name\nA');
      expect(res.status).toBe(402);
      expect(res.body.code).toBe('PLAN_FEATURE_UNAVAILABLE');
    });
  });

  describe('leads', () => {
    it('creates, filters and converts a lead into a customer and deal in one transaction', async () => {
      const lead = await owner.client
        .post(`${base}/leads`, { fullName: 'Lead Person', company: 'Lead Co', email: 'lead-person@test.local', priority: 'HIGH', estimatedValue: 25000, status: 'QUALIFIED' })
        .expect(201);
      expect(lead.body).toMatchObject({ status: 'QUALIFIED', priority: 'HIGH', estimatedValue: 25000 });
      expect((await owner.client.get(`${base}/leads?priority=HIGH&status=QUALIFIED`)).body.meta.total).toBeGreaterThanOrEqual(1);

      const converted = await owner.client.post(`${base}/leads/${lead.body.id}/convert`, { createDeal: true, dealTitle: 'Lead Co rollout' }).expect(200);
      expect(converted.body.lead.status).toBe('CONVERTED');
      expect(converted.body.lead.convertedCustomerId).toBe(converted.body.customerId);

      const customer = await owner.client.get(`${base}/customers/${converted.body.customerId}`).expect(200);
      expect(customer.body).toMatchObject({ fullName: 'Lead Person', company: 'Lead Co', source: 'LEAD_CONVERSION' });
      const deal = await owner.client.get(`${base}/deals/${converted.body.dealId}`).expect(200);
      expect(deal.body).toMatchObject({ title: 'Lead Co rollout', value: 25000, status: 'OPEN', customer: { id: converted.body.customerId } });

      const again = await owner.client.post(`${base}/leads/${lead.body.id}/convert`, {});
      expect(again.status).toBe(409);
      expect(again.body.code).toBe('LEAD_ALREADY_CONVERTED');
      const edit = await owner.client.patch(`${base}/leads/${lead.body.id}`, { fullName: 'x' });
      expect(edit.status).toBe(409);

      const timeline = await owner.client.get(`${base}/customers/${converted.body.customerId}/timeline`).expect(200);
      expect(timeline.body.some((i: { kind: string; activity?: { subject: string } }) => i.activity?.subject === 'Converted from lead')).toBe(true);
    });

    it('never converts the same lead twice under concurrent requests', async () => {
      const lead = await owner.client.post(`${base}/leads`, { fullName: 'Race Lead', email: 'race-lead@test.local' }).expect(201);
      const results = await Promise.all([
        owner.client.post(`${base}/leads/${lead.body.id}/convert`, {}),
        owner.client.post(`${base}/leads/${lead.body.id}/convert`, {}),
        owner.client.post(`${base}/leads/${lead.body.id}/convert`, {}),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 409, 409]);
      const customers = await prisma(app).customer.count({ where: { workspaceId: owner.workspaceId, email: 'race-lead@test.local' } });
      expect(customers).toBe(1);
    });

    it('reuses an existing customer with the same email when converting', async () => {
      const existing = await owner.client.post(`${base}/customers`, { fullName: 'Existing', email: 'existing-conv@test.local' }).expect(201);
      const lead = await owner.client.post(`${base}/leads`, { fullName: 'Existing Lead', email: 'existing-conv@test.local' }).expect(201);
      const converted = await owner.client.post(`${base}/leads/${lead.body.id}/convert`, {}).expect(200);
      expect(converted.body.customerId).toBe(existing.body.id);
    });
  });

  describe('pipelines and deals', () => {
    it('moves deals between stages with consistent ordering, status and totals', async () => {
      const pipeline = await defaultPipeline(owner);
      const [leadIn, qualified, , , won] = pipeline.stages;
      const mk = (title: string, value: number, stageId: string, probability?: number) =>
        owner.client.post(`${base}/deals`, { title, value, pipelineId: pipeline.id, stageId, probability }).expect(201);

      const d1 = (await mk('Deal One', 10000, leadIn!.id)).body;
      const d2 = (await mk('Deal Two', 20000, leadIn!.id)).body;
      const d3 = (await mk('Deal Three', 30000, qualified!.id, 60)).body;
      expect(d2.position).toBe(d1.position + 1);

      let board = await owner.client.get(`${base}/pipelines/${pipeline.id}/board`).expect(200);
      const openBefore = board.body.totals.openValue;

      // Move Deal Two to the top of "Qualified".
      const moved = await owner.client.post(`${base}/deals/${d2.id}/move`, { stageId: qualified!.id, position: 0 }).expect(200);
      expect(moved.body).toMatchObject({ stageId: qualified!.id, position: 0, status: 'OPEN' });
      board = await owner.client.get(`${base}/pipelines/${pipeline.id}/board`).expect(200);
      const qualifiedColumn = board.body.columns.find((c: { stage: { id: string } }) => c.stage.id === qualified!.id);
      expect(qualifiedColumn.deals.map((d: { title: string }) => d.title).slice(0, 2)).toEqual(['Deal Two', 'Deal Three']);
      expect(board.body.totals.openValue).toBe(openBefore);

      // Weighted: Deal Two uses stage probability 25%, Deal Three overrides 60%.
      expect(qualifiedColumn.weightedValue).toBe(20000 * 0.25 + 30000 * 0.6);

      const winning = await owner.client.post(`${base}/deals/${d3.id}/move`, { stageId: won!.id }).expect(200);
      expect(winning.body.status).toBe('WON');
      expect(winning.body.closedAt).not.toBeNull();
      expect(winning.body.effectiveProbability).toBe(100);

      const reopened = await owner.client.post(`${base}/deals/${d3.id}/move`, { stageId: leadIn!.id }).expect(200);
      expect(reopened.body.status).toBe('OPEN');
      expect(reopened.body.closedAt).toBeNull();

      const list = await owner.client.get(`${base}/deals?status=OPEN&minValue=15000&sortBy=value&sortDir=desc`).expect(200);
      expect(list.body.data[0].value).toBeGreaterThanOrEqual(list.body.data[list.body.data.length - 1].value);
      expect(list.body.data.every((d: { value: number }) => d.value >= 15000)).toBe(true);
    });

    it('manages stages and requires a target when deleting a non-empty stage', async () => {
      const created = await owner.client.post(`${base}/pipelines`, { name: 'Partnerships' }).expect(201);
      const pipelineId = created.body.id;
      const stage = await owner.client.post(`${base}/pipelines/${pipelineId}/stages`, { name: 'Discovery', probability: 15 }).expect(201);
      const target = created.body.stages[0];
      await owner.client.post(`${base}/deals`, { title: 'Stage deal', value: 5, pipelineId, stageId: stage.body.id }).expect(201);

      const blocked = await owner.client.delete(`${base}/pipelines/${pipelineId}/stages/${stage.body.id}`);
      expect(blocked.status).toBe(409);
      expect(blocked.body.code).toBe('STAGE_NOT_EMPTY');
      await owner.client.delete(`${base}/pipelines/${pipelineId}/stages/${stage.body.id}?moveDealsToStageId=${target.id}`).expect(204);

      const refreshed = await owner.client.get(`${base}/pipelines/${pipelineId}`).expect(200);
      expect(refreshed.body.stages.map((s: { position: number }) => s.position)).toEqual([0, 1, 2, 3, 4, 5]);
      expect(refreshed.body.stages[0].dealCount).toBe(1);

      const reversed = [...refreshed.body.stages].reverse().map((s: { id: string }) => s.id);
      const reordered = await owner.client.put(`${base}/pipelines/${pipelineId}/stages/order`, { stageIds: reversed }).expect(200);
      expect(reordered.body.stages.map((s: { id: string }) => s.id)).toEqual(reversed);
      expect((await owner.client.put(`${base}/pipelines/${pipelineId}/stages/order`, { stageIds: reversed.slice(1) })).status).toBe(400);

      const nonEmpty = await owner.client.delete(`${base}/pipelines/${pipelineId}`);
      expect(nonEmpty.body.code).toBe('PIPELINE_NOT_EMPTY');
    });
  });

  describe('tasks, activities and notes', () => {
    it('assigns tasks with notifications, tracks overdue and completion, supports comments', async () => {
      const rep = await addMember(app, owner, 'SALES_REPRESENTATIVE', 'task-rep');
      const overdue = await owner.client
        .post(`${base}/tasks`, { title: 'Overdue follow-up', dueAt: new Date(Date.now() - 86_400_000).toISOString(), assignedToId: rep.user.id, priority: 'HIGH' })
        .expect(201);
      expect(overdue.body.isOverdue).toBe(true);

      const notifications = await rep.client.get(`/notifications?workspaceId=${owner.workspaceId}`).expect(200);
      expect(notifications.body.data.some((n: { type: string; title: string }) => n.type === 'TASK_ASSIGNED' && n.title.includes('Overdue follow-up'))).toBe(true);

      const overdueList = await rep.client.get(`${base}/tasks?due=overdue&assignedToId=me`).expect(200);
      expect(overdueList.body.data.map((t: { id: string }) => t.id)).toContain(overdue.body.id);

      const done = await rep.client.patch(`${base}/tasks/${overdue.body.id}`, { status: 'COMPLETED' }).expect(200);
      expect(done.body.completedAt).not.toBeNull();
      expect(done.body.isOverdue).toBe(false);
      const reopened = await rep.client.patch(`${base}/tasks/${overdue.body.id}`, { status: 'TODO' }).expect(200);
      expect(reopened.body.completedAt).toBeNull();

      await owner.client.post(`${base}/tasks/${overdue.body.id}/comments`, { body: 'Please prioritise this' }).expect(201);
      const comments = await rep.client.get(`${base}/tasks/${overdue.body.id}/comments`).expect(200);
      expect(comments.body).toHaveLength(1);
      expect((await rep.client.post(`${base}/tasks/${overdue.body.id}/comments`, { body: '' })).status).toBe(400);
    });

    it('records activities, updates last interaction and builds a chronological timeline', async () => {
      const customer = await owner.client.post(`${base}/customers`, { fullName: 'Timeline Customer' }).expect(201);
      const id = customer.body.id;
      const older = new Date(Date.now() - 3 * 86_400_000).toISOString();
      const newer = new Date(Date.now() - 1 * 86_400_000).toISOString();
      await owner.client.post(`${base}/activities`, { type: 'MEETING', subject: 'Newer meeting', occurredAt: newer, customerId: id, durationMinutes: 45 }).expect(201);
      await owner.client.post(`${base}/activities`, { type: 'CALL', subject: 'Older call', occurredAt: older, customerId: id }).expect(201);
      await owner.client.post(`${base}/notes`, { body: 'Important note', customerId: id }).expect(201);

      const detail = await owner.client.get(`${base}/customers/${id}`).expect(200);
      expect(detail.body.lastInteractionAt).toBe(newer);

      const timeline = await owner.client.get(`${base}/customers/${id}/timeline`).expect(200);
      const times = timeline.body.map((i: { at: string }) => i.at);
      expect([...times].sort().reverse()).toEqual(times);
      expect(timeline.body[0].kind).toBe('note');

      const activities = await owner.client.get(`${base}/activities?customerId=${id}&type=CALL`).expect(200);
      expect(activities.body.data).toHaveLength(1);

      const unlinked = await owner.client.post(`${base}/activities`, { type: 'CALL', subject: 'Nowhere' });
      expect(unlinked.status).toBe(400);
    });
  });
});
