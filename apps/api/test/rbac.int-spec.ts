import { INestApplication } from '@nestjs/common';
import { addMember, ApiClient, createTestApp, lastEmailToken, prisma, registerUser, TestUser } from './helpers';

describe('Roles, members and invitations (integration)', () => {
  let app: INestApplication;
  let owner: TestUser;
  let admin: TestUser;
  let manager: TestUser;
  let rep: TestUser;
  let viewer: TestUser;
  let base: string;

  beforeAll(async () => {
    app = await createTestApp();
    owner = await registerUser(app, 'rbac-owner', 'RBAC Corp');
    base = `/workspaces/${owner.workspaceId}`;
    // Free plan allows 3 members; upgrade (simulated billing) to fit the whole team.
    await owner.client.post(`${base}/subscription/change-plan`, { plan: 'GROWTH' }).expect(200);
    admin = await addMember(app, owner, 'ADMIN');
    manager = await addMember(app, owner, 'MANAGER');
    rep = await addMember(app, owner, 'SALES_REPRESENTATIVE', 'rep');
    viewer = await addMember(app, owner, 'VIEWER');
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists members with roles and exposes role permissions', async () => {
    const members = await viewer.client.get(`${base}/members`).expect(200);
    expect(members.body.map((m: { role: string }) => m.role).sort()).toEqual(['ADMIN', 'MANAGER', 'OWNER', 'SALES_REPRESENTATIVE', 'VIEWER']);
    const detail = await viewer.client.get(base).expect(200);
    expect(detail.body.role).toBe('VIEWER');
    expect(detail.body.permissions).toContain('records:read');
    expect(detail.body.permissions).not.toContain('records:create');
  });

  it('makes viewers read-only', async () => {
    const res = await viewer.client.post(`${base}/customers`, { fullName: 'Viewer attempt' });
    expect(res.status).toBe(403);
    expect((await viewer.client.post(`${base}/tasks`, { title: 'x' })).status).toBe(403);
    await viewer.client.get(`${base}/customers`).expect(200);
  });

  it('auto-assigns rep records and blocks assigning to others', async () => {
    const own = await rep.client.post(`${base}/customers`, { fullName: 'Rep Customer' }).expect(201);
    expect(own.body.assignedTo.id).toBe(rep.user.id);
    const other = await rep.client.post(`${base}/customers`, { fullName: 'Rep assigns', assignedToId: manager.user.id });
    expect(other.status).toBe(403);
    await rep.client.patch(`${base}/customers/${own.body.id}`, { status: 'ACTIVE' }).expect(200);
    const reassign = await rep.client.patch(`${base}/customers/${own.body.id}`, { assignedToId: manager.user.id });
    expect(reassign.status).toBe(403);
  });

  it('prevents reps from editing or deleting records they do not own', async () => {
    const managerCustomer = await manager.client.post(`${base}/customers`, { fullName: 'Manager Customer' }).expect(201);
    const edit = await rep.client.patch(`${base}/customers/${managerCustomer.body.id}`, { fullName: 'Changed' });
    expect(edit.status).toBe(403);
    expect((await rep.client.delete(`${base}/customers/${managerCustomer.body.id}`)).status).toBe(403);
    await manager.client.patch(`${base}/customers/${managerCustomer.body.id}`, { assignedToId: rep.user.id }).expect(200);
    // Now assigned to the rep, the rep may edit it.
    await rep.client.patch(`${base}/customers/${managerCustomer.body.id}`, { fullName: 'Changed' }).expect(200);
  });

  it('restricts billing to the owner and role changes by hierarchy', async () => {
    const adminBilling = await admin.client.post(`${base}/subscription/change-plan`, { plan: 'ENTERPRISE' });
    expect(adminBilling.status).toBe(403);
    await admin.client.get(`${base}/subscription`).expect(200);

    const members = (await owner.client.get(`${base}/members`)).body as { id: string; role: string; user: { id: string } }[];
    const viewerMember = members.find((m) => m.user.id === viewer.user.id)!;
    const ownerMember = members.find((m) => m.role === 'OWNER')!;
    const adminMember = members.find((m) => m.user.id === admin.user.id)!;

    expect((await admin.client.patch(`${base}/members/${viewerMember.id}`, { role: 'ADMIN' })).status).toBe(403);
    await admin.client.patch(`${base}/members/${viewerMember.id}`, { role: 'MANAGER' }).expect(200);
    await admin.client.patch(`${base}/members/${viewerMember.id}`, { role: 'VIEWER' }).expect(200);
    expect((await admin.client.delete(`${base}/members/${ownerMember.id}`)).status).toBe(403);
    expect((await admin.client.patch(`${base}/members/${adminMember.id}`, { role: 'VIEWER' })).status).toBe(403);
    expect((await manager.client.patch(`${base}/members/${viewerMember.id}`, { role: 'MANAGER' })).status).toBe(403);
    expect((await rep.client.post(`${base}/invitations`, { email: 'x@test.local', role: 'VIEWER' })).status).toBe(403);
  });

  it('validates invitation acceptance', async () => {
    const outsider = await registerUser(app, 'outsider');
    await owner.client.post(`${base}/invitations`, { email: 'someone-else@test.local', role: 'VIEWER' }).expect(201);
    const token = lastEmailToken(app, 'someone-else@test.local', '/invite/');

    const preview = await new ApiClient(app).init().then((c) => c.get(`/invitations/${token}`));
    expect(preview.status).toBe(200);
    expect(preview.body).toMatchObject({ workspaceName: 'RBAC Corp', email: 'someone-else@test.local', role: 'VIEWER' });

    const wrongUser = await outsider.client.post(`/invitations/${token}/accept`);
    expect(wrongUser.status).toBe(403);

    const invitations = await owner.client.get(`${base}/invitations`).expect(200);
    const pending = invitations.body.find((i: { email: string; status: string }) => i.email === 'someone-else@test.local' && i.status === 'PENDING');
    await owner.client.delete(`${base}/invitations/${pending.id}`).expect(204);
    expect((await new ApiClient(app).init().then((c) => c.get(`/invitations/${token}`))).status).toBe(400);

    const dupMember = await owner.client.post(`${base}/invitations`, { email: rep.email, role: 'VIEWER' });
    expect(dupMember.status).toBe(409);
  });

  it('removes members and unassigns their records', async () => {
    const temp = await addMember(app, owner, 'SALES_REPRESENTATIVE', 'temp');
    const customer = await temp.client.post(`${base}/customers`, { fullName: 'Temp Customer' }).expect(201);
    const members = (await owner.client.get(`${base}/members`)).body as { id: string; user: { id: string } }[];
    const tempMember = members.find((m) => m.user.id === temp.user.id)!;
    await owner.client.delete(`${base}/members/${tempMember.id}`).expect(204);

    expect((await temp.client.get(`${base}/customers`)).status).toBe(404);
    const after = await owner.client.get(`${base}/customers/${customer.body.id}`).expect(200);
    expect(after.body.assignedTo).toBeNull();
    const logs = await prisma(app).auditLog.findMany({ where: { workspaceId: owner.workspaceId, action: 'member.removed' } });
    expect(logs.length).toBeGreaterThan(0);
  });

  it('lets members leave but not the owner, and transfers ownership', async () => {
    const leaver = await addMember(app, owner, 'VIEWER', 'leaver');
    await leaver.client.post(`${base}/leave`).expect(204);
    expect((await leaver.client.get(base)).status).toBe(404);

    const ownerLeave = await owner.client.post(`${base}/leave`);
    expect(ownerLeave.body.code).toBe('OWNER_CANNOT_LEAVE');

    expect((await admin.client.post(`${base}/transfer-ownership`, { userId: admin.user.id })).status).toBe(403);
    await owner.client.post(`${base}/transfer-ownership`, { userId: admin.user.id }).expect(200);
    const detail = await admin.client.get(base).expect(200);
    expect(detail.body.role).toBe('OWNER');
    expect((await owner.client.get(base)).body.role).toBe('ADMIN');
  });
});
