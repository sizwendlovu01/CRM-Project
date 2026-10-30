/**
 * Development seed: two demo workspaces with realistic, internally consistent CRM data.
 *
 * Security:
 *  - Refuses to run when NODE_ENV=production.
 *  - Never uses a hard-coded password. Set SEED_PASSWORD, or a strong random password is
 *    generated and printed once to the console.
 */
import '../src/load-env';
import { randomBytes, randomUUID } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import {
  ActivityType,
  CustomerStatus,
  LeadStatus,
  Prisma,
  PrismaClient,
  Priority,
  RecordSource,
  Role,
  TaskStatus,
} from '@prisma/client';
import { createWorkspaceWithDefaults } from '../src/modules/workspaces/workspace-factory';

const prisma = new PrismaClient();
const DEMO_SLUG = 'northwind-traders';
const DAY = 86_400_000;

/* Deterministic PRNG so every seed run produces the same shape of data. */
let state = 20261030;
function rand(): number {
  state = (state * 1664525 + 1013904223) % 4294967296;
  return state / 4294967296;
}
const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)] as T;
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const daysAgo = (days: number, hour = int(8, 17)) => {
  const d = new Date(Date.now() - days * DAY);
  d.setUTCHours(hour, int(0, 59), 0, 0);
  return d;
};

const FIRST = ['Thandi', 'Liam', 'Aisha', 'Noah', 'Zanele', 'Ethan', 'Priya', 'Lucas', 'Naledi', 'Mia', 'Sipho', 'Olivia', 'Kagiso', 'Emma', 'Ravi', 'Chloe', 'Bongani', 'Ava', 'Ahmed', 'Grace', 'Tumi', 'Daniel', 'Fatima', 'James', 'Lerato', 'Sofia', 'Musa', 'Isla', 'Kofi', 'Hannah'];
const LAST = ['Mokoena', 'Smith', 'Naidoo', 'Johnson', 'Dlamini', 'Williams', 'Patel', 'Brown', 'Nkosi', 'Taylor', 'van der Merwe', 'Anderson', 'Khumalo', 'Thomas', 'Pillay', 'Jackson', 'Botha', 'White', 'Mahlangu', 'Harris'];
const COMPANIES = ['Acme Logistics', 'Blue Crane Foods', 'Cape Solar Works', 'Delta Health', 'Everest Mining', 'Fynbos Analytics', 'Granite Insurance', 'Harbour Freight', 'Ivory Retail Group', 'Jacaranda Media', 'Karoo Agritech', 'Lighthouse Legal', 'Mountain Ventures', 'Nova Telecom', 'Orbit Software', 'Protea Hotels Group', 'Quantum Fintech', 'Riverbend Clinics', 'Summit Construction', 'Table Bay Shipping', 'Umoya Energy', 'Vantage Consulting', 'Waterfront Properties', 'Xcel Manufacturing', 'Yellowwood Education', 'Zenith Automotive'];
const INDUSTRIES = ['Logistics', 'Food & Beverage', 'Energy', 'Healthcare', 'Mining', 'Technology', 'Financial Services', 'Retail', 'Media', 'Agriculture', 'Legal', 'Hospitality', 'Construction', 'Education', 'Manufacturing'];
const CITIES = ['Johannesburg', 'Cape Town', 'Durban', 'Pretoria', 'Gqeberha', 'Bloemfontein', 'London', 'Nairobi', 'Lagos', 'Amsterdam'];
const SOURCES: RecordSource[] = ['WEBSITE', 'REFERRAL', 'EVENT', 'COLD_OUTREACH', 'SOCIAL_MEDIA', 'PARTNER', 'ADVERTISING'];
const TITLES = ['Head of Operations', 'CFO', 'Procurement Manager', 'CTO', 'Managing Director', 'Sales Director', 'IT Manager', 'COO'];
const DEAL_KINDS = ['Annual licence', 'Implementation project', 'Support renewal', 'Expansion seats', 'Pilot programme', 'Enterprise upgrade', 'Consulting retainer', 'Data migration'];
const TASK_TITLES = ['Send proposal', 'Follow up on pricing questions', 'Schedule product demo', 'Prepare contract draft', 'Confirm technical requirements', 'Book onsite workshop', 'Share case study', 'Call to discuss renewal', 'Update forecast notes', 'Introduce solutions engineer'];
const ACTIVITY_SUBJECTS: Record<ActivityType, string[]> = {
  CALL: ['Discovery call', 'Pricing discussion', 'Check-in call', 'Renewal call'],
  EMAIL: ['Sent proposal', 'Shared onboarding guide', 'Answered security questionnaire', 'Sent meeting recap'],
  MEETING: ['Product demo', 'Quarterly business review', 'Onsite workshop', 'Executive briefing'],
  NOTE: ['Budget confirmed for Q1', 'Decision maker identified', 'Competitor evaluation in progress'],
  FOLLOW_UP: ['Followed up on proposal', 'Reminder about contract', 'Chased signature'],
};

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed demo data in production.');
  }
  if (await prisma.workspace.findUnique({ where: { slug: DEMO_SLUG } })) {
    console.warn(`Demo workspace "${DEMO_SLUG}" already exists - skipping seed. Delete it first to reseed.`);
    return;
  }

  const password = process.env.SEED_PASSWORD || `${randomBytes(9).toString('base64url')}9a`;
  const passwordHash = await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 });

  const people: { key: string; name: string; email: string; role: Role; title: string }[] = [
    { key: 'owner', name: 'Alex Morgan', email: 'owner@demo.crm.local', role: 'OWNER', title: 'Chief Revenue Officer' },
    { key: 'admin', name: 'Jordan Lee', email: 'admin@demo.crm.local', role: 'ADMIN', title: 'Revenue Operations Lead' },
    { key: 'manager', name: 'Sam Patel', email: 'manager@demo.crm.local', role: 'MANAGER', title: 'Sales Manager' },
    { key: 'rep1', name: 'Taylor Nkosi', email: 'rep1@demo.crm.local', role: 'SALES_REPRESENTATIVE', title: 'Account Executive' },
    { key: 'rep2', name: 'Casey Botha', email: 'rep2@demo.crm.local', role: 'SALES_REPRESENTATIVE', title: 'Account Executive' },
    { key: 'viewer', name: 'Riley Adams', email: 'viewer@demo.crm.local', role: 'VIEWER', title: 'Finance Analyst' },
  ];

  const users = new Map<string, string>();
  for (const person of people) {
    const user = await prisma.user.upsert({
      where: { email: person.email },
      update: {},
      create: { email: person.email, name: person.name, passwordHash, jobTitle: person.title, emailVerifiedAt: new Date(), timezone: 'Africa/Johannesburg' },
    });
    users.set(person.key, user.id);
  }
  const id = (key: string) => users.get(key) as string;

  const workspace = await prisma.$transaction((tx) =>
    createWorkspaceWithDefaults(tx, id('owner'), 'Northwind Traders', { plan: 'GROWTH', currency: 'USD' }),
  );
  await prisma.workspace.update({
    where: { id: workspace.id },
    data: { industry: 'B2B Software', timezone: 'Africa/Johannesburg', currentPeriodEnd: new Date(Date.now() + 21 * DAY) },
  });
  await prisma.membership.createMany({
    data: people.filter((p) => p.role !== 'OWNER').map((p) => ({ workspaceId: workspace.id, userId: id(p.key), role: p.role })),
  });

  const ws = workspace.id;
  const sellers = [id('manager'), id('rep1'), id('rep2'), id('admin')];
  const pipeline = await prisma.pipeline.findFirstOrThrow({ where: { workspaceId: ws }, include: { stages: { orderBy: { position: 'asc' } } } });

  /* Customers */
  const customers: Prisma.CustomerCreateManyInput[] = [];
  const statuses: CustomerStatus[] = ['ACTIVE', 'ACTIVE', 'ACTIVE', 'PROSPECT', 'PROSPECT', 'INACTIVE', 'CHURNED'];
  for (let i = 0; i < 64; i += 1) {
    const first = FIRST[i % FIRST.length] as string;
    const last = pick(LAST);
    const company = COMPANIES[i % COMPANIES.length] as string;
    const created = daysAgo(int(1, 200));
    customers.push({
      id: randomUUID(),
      workspaceId: ws,
      fullName: `${first} ${last}`,
      company: i % 9 === 0 ? null : company,
      email: `${first}.${last}.${i}`.toLowerCase().replace(/[^a-z0-9.]/g, '') + '@example.com',
      phone: `+27 ${int(10, 87)} ${int(100, 999)} ${int(1000, 9999)}`,
      address: `${int(1, 250)} ${pick(['Main', 'Long', 'Church', 'Oxford', 'Jan Smuts'])} Street, ${pick(CITIES)}`,
      industry: pick(INDUSTRIES),
      type: i % 9 === 0 ? 'INDIVIDUAL' : 'BUSINESS',
      status: pick(statuses),
      source: pick(SOURCES),
      assignedToId: pick(sellers),
      createdById: pick(sellers),
      createdAt: created,
      updatedAt: created,
    });
  }
  // Intentional potential duplicate (same phone) to demonstrate duplicate detection.
  customers.push({ ...customers[3]!, id: randomUUID(), email: 'accounts@' + 'blue-crane.example.com', fullName: customers[3]!.fullName });
  await prisma.customer.createMany({ data: customers });

  /* Leads */
  const leadStatuses: LeadStatus[] = ['NEW', 'NEW', 'CONTACTED', 'CONTACTED', 'QUALIFIED', 'QUALIFIED', 'UNQUALIFIED'];
  const priorities: Priority[] = ['LOW', 'MEDIUM', 'MEDIUM', 'HIGH', 'URGENT'];
  const leads: Prisma.LeadCreateManyInput[] = [];
  for (let i = 0; i < 42; i += 1) {
    const first = pick(FIRST);
    const last = pick(LAST);
    const created = daysAgo(int(0, 120));
    const status = pick(leadStatuses);
    leads.push({
      id: randomUUID(),
      workspaceId: ws,
      fullName: `${first} ${last}`,
      company: `${pick(['Bright', 'Silver', 'True', 'North', 'Peak', 'Prime'])} ${pick(['Systems', 'Holdings', 'Labs', 'Partners', 'Group'])}`,
      email: `${first}.${last}.lead${i}`.toLowerCase().replace(/[^a-z0-9.]/g, '') + '@example.org',
      phone: `+27 ${int(10, 87)} ${int(100, 999)} ${int(1000, 9999)}`,
      jobTitle: pick(TITLES),
      source: pick(SOURCES),
      status,
      priority: pick(priorities),
      estimatedValue: int(5, 120) * 1000,
      nextFollowUpAt: status === 'UNQUALIFIED' ? null : new Date(Date.now() + int(-5, 14) * DAY),
      assignedToId: pick(sellers),
      createdById: pick(sellers),
      createdAt: created,
      updatedAt: created,
    });
  }
  await prisma.lead.createMany({ data: leads });

  // Convert a handful of leads with proper links (status + convertedAt + customer).
  for (let i = 0; i < 8; i += 1) {
    const lead = leads[i]!;
    const customerId = randomUUID();
    const convertedAt = daysAgo(int(1, 90));
    await prisma.customer.create({
      data: {
        id: customerId,
        workspaceId: ws,
        fullName: lead.fullName,
        company: lead.company,
        email: lead.email,
        phone: lead.phone,
        type: 'BUSINESS',
        status: 'ACTIVE',
        source: 'LEAD_CONVERSION',
        assignedToId: lead.assignedToId,
        createdById: lead.assignedToId,
        createdAt: convertedAt,
        lastInteractionAt: convertedAt,
      },
    });
    await prisma.lead.update({
      where: { id: lead.id as string },
      data: { status: 'CONVERTED', convertedAt, convertedById: lead.assignedToId, convertedCustomerId: customerId, createdAt: new Date(convertedAt.getTime() - int(3, 30) * DAY) },
    });
    customers.push({ id: customerId, workspaceId: ws, fullName: lead.fullName, assignedToId: lead.assignedToId });
  }

  /* Deals: open deals across stages + won/lost history over ~6 months */
  const deals: Prisma.DealCreateManyInput[] = [];
  const positions = new Map<string, number>();
  const nextPosition = (stageId: string) => {
    const p = positions.get(stageId) ?? 0;
    positions.set(stageId, p + 1);
    return p;
  };
  const businessCustomers = customers.filter((c) => c.company !== null);
  for (let i = 0; i < 48; i += 1) {
    const stage = i < 26 ? pipeline.stages[i % 4]! : i < 40 ? pipeline.stages[4]! : pipeline.stages[5]!;
    const customer = pick(businessCustomers);
    const created = daysAgo(int(10, 190));
    const closed = stage.type === 'OPEN' ? null : new Date(Math.min(Date.now() - DAY, created.getTime() + int(7, 60) * DAY));
    deals.push({
      id: randomUUID(),
      workspaceId: ws,
      pipelineId: pipeline.id,
      stageId: stage.id,
      title: `${customer.company ?? customer.fullName} - ${pick(DEAL_KINDS)}`,
      value: int(4, 150) * 1000,
      probability: stage.type === 'OPEN' && i % 5 === 0 ? int(20, 90) : null,
      status: stage.type,
      position: nextPosition(stage.id),
      expectedCloseDate: stage.type === 'OPEN' ? new Date(Date.now() + int(5, 90) * DAY) : closed,
      closedAt: closed,
      lostReason: stage.type === 'LOST' ? pick(['Budget cut', 'Chose competitor', 'No decision', 'Timing']) : null,
      customerId: customer.id as string,
      assignedToId: (customer.assignedToId as string | null) ?? pick(sellers),
      createdById: pick(sellers),
      createdAt: created,
      updatedAt: closed ?? created,
    });
  }
  await prisma.deal.createMany({ data: deals });

  /* Tasks: mix of overdue, due soon, completed */
  const tasks: Prisma.TaskCreateManyInput[] = [];
  const taskStatuses: TaskStatus[] = ['TODO', 'TODO', 'IN_PROGRESS', 'COMPLETED', 'COMPLETED'];
  for (let i = 0; i < 36; i += 1) {
    const status = pick(taskStatuses);
    const deal = rand() > 0.4 ? pick(deals) : null;
    const created = daysAgo(int(1, 60));
    const dueOffset = i % 6 === 0 ? -int(1, 10) : int(0, 21);
    tasks.push({
      id: randomUUID(),
      workspaceId: ws,
      title: pick(TASK_TITLES),
      description: rand() > 0.5 ? 'Keep the customer updated and log the outcome as an activity.' : null,
      status,
      priority: pick(priorities),
      dueAt: i % 11 === 0 ? null : new Date(Date.now() + dueOffset * DAY),
      completedAt: status === 'COMPLETED' ? daysAgo(int(0, 25)) : null,
      assignedToId: pick(sellers),
      createdById: id('manager'),
      dealId: deal?.id as string | undefined,
      customerId: (deal?.customerId as string | undefined) ?? (rand() > 0.5 ? (pick(customers).id as string) : undefined),
      createdAt: created,
      updatedAt: created,
    });
  }
  await prisma.task.createMany({ data: tasks });

  /* Activities linked to customers (and deals), plus notes */
  const activities: Prisma.ActivityCreateManyInput[] = [];
  const lastTouch = new Map<string, Date>();
  const types: ActivityType[] = ['CALL', 'EMAIL', 'MEETING', 'NOTE', 'FOLLOW_UP'];
  for (let i = 0; i < 170; i += 1) {
    const type = pick(types);
    const deal = rand() > 0.5 ? pick(deals) : null;
    const customerId = (deal?.customerId as string | undefined) ?? (pick(customers).id as string);
    const occurredAt = daysAgo(int(0, 150));
    activities.push({
      workspaceId: ws,
      type,
      subject: pick(ACTIVITY_SUBJECTS[type]),
      description: rand() > 0.6 ? 'Positive conversation; next steps agreed with the customer.' : null,
      occurredAt,
      durationMinutes: type === 'CALL' || type === 'MEETING' ? int(10, 90) : null,
      outcome: type === 'CALL' ? pick(['Connected', 'Left voicemail', 'Scheduled follow-up']) : null,
      userId: pick(sellers),
      customerId,
      dealId: deal?.id as string | undefined,
      createdAt: occurredAt,
    });
    if (!lastTouch.has(customerId) || (lastTouch.get(customerId) as Date) < occurredAt) lastTouch.set(customerId, occurredAt);
  }
  await prisma.activity.createMany({ data: activities });
  for (const [customerId, at] of lastTouch) {
    await prisma.customer.update({ where: { id: customerId }, data: { lastInteractionAt: at } });
  }
  await prisma.note.createMany({
    data: customers.slice(0, 20).map((c) => ({
      workspaceId: ws,
      authorId: pick(sellers),
      customerId: c.id as string,
      body: pick(['Prefers communication via email.', 'Renewal is due next quarter.', 'Interested in the analytics add-on.', 'Requested a security review before signing.']),
      createdAt: daysAgo(int(0, 60)),
    })),
  });

  /* Notifications so the notification centre is not empty */
  await prisma.notification.createMany({
    data: [
      { userId: id('owner'), workspaceId: ws, type: 'DEAL_UPDATED', title: 'Deal moved to Negotiation', body: 'Orbit Software - Enterprise upgrade', link: `/w/${workspace.slug}/pipeline` },
      { userId: id('owner'), workspaceId: ws, type: 'MEMBER_JOINED', title: 'Riley Adams joined Northwind Traders', link: `/w/${workspace.slug}/settings/team` },
      { userId: id('rep1'), workspaceId: ws, type: 'TASK_ASSIGNED', title: 'New task: Send proposal', link: `/w/${workspace.slug}/tasks` },
    ],
  });

  /* Second workspace (Free plan) for workspace switching */
  const second = await prisma.$transaction((tx) => createWorkspaceWithDefaults(tx, id('owner'), 'Contoso Labs', { plan: 'FREE' }));
  await prisma.customer.createMany({
    data: ['Ada Okafor', 'Ben Carter', 'Chen Wei'].map((name, i) => ({
      workspaceId: second.id,
      fullName: name,
      company: 'Contoso Partner ' + (i + 1),
      email: `contoso.${i}@example.net`,
      status: 'ACTIVE' as CustomerStatus,
      source: 'REFERRAL' as RecordSource,
      assignedToId: id('owner'),
      createdById: id('owner'),
    })),
  });

  console.warn('\nSeed complete.');
  console.warn('Demo workspaces: "Northwind Traders" (Growth plan) and "Contoso Labs" (Free plan).');
  console.warn('Accounts (all share one password):');
  for (const person of people) console.warn(`  ${person.role.padEnd(22)} ${person.email}`);
  if (process.env.SEED_PASSWORD) console.warn('Password: the value of SEED_PASSWORD.');
  else console.warn(`Generated password (shown once, store it privately): ${password}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
