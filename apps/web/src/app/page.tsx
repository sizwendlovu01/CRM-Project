import Image from 'next/image';
import Link from 'next/link';
import { Building2, Check, KanbanSquare, Lock, Target, Users } from 'lucide-react';
import { PLAN_DEFINITIONS, PLANS, type Plan } from '@crm/shared';
import { Logo, ThemeToggle } from '@/components/common';
import { FadeIn } from '@/components/motion';
import { Button } from '@/components/ui/button';
import { IconTile } from '@/components/ui/misc';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

const RECORD = [
  { icon: Building2, tone: 'green' as const, title: 'Customers', body: 'Every call, note, task and deal on one timeline.' },
  { icon: Target, tone: 'red' as const, title: 'Leads', body: 'Qualify, then convert to a customer and a deal in one step.' },
  { icon: KanbanSquare, tone: 'primary' as const, title: 'Pipeline', body: 'Drag deals between stages; the forecast updates as they move.' },
  { icon: Users, tone: 'blue' as const, title: 'Team', body: 'Five roles, from owner to viewer, checked on every request.' },
];

const SECURITY = [
  'Each workspace is isolated, and automated tests prove it',
  'Argon2id password hashing and server-side sessions',
  'CSRF protection, rate limiting and account lockout',
  'An audit log of administrative actions',
];

const limit = (plan: Plan, metric: 'members' | 'customers' | 'pipelines') => {
  const value = PLAN_DEFINITIONS[plan].limits[metric];
  return value === null ? 'Unlimited' : formatNumber(value);
};

const ROWS: { label: string; value: (plan: Plan) => string }[] = [
  { label: 'Members', value: (p) => limit(p, 'members') },
  { label: 'Customers and leads', value: (p) => limit(p, 'customers') },
  { label: 'Pipelines', value: (p) => limit(p, 'pipelines') },
  { label: 'CSV import', value: (p) => (PLAN_DEFINITIONS[p].features.includes('csv_import') ? 'Yes' : 'No') },
  { label: 'Team performance', value: (p) => (PLAN_DEFINITIONS[p].features.includes('team_performance') ? 'Yes' : 'No') },
  { label: 'Audit log', value: (p) => (PLAN_DEFINITIONS[p].features.includes('audit_log') ? 'Yes' : 'No') },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Logo />
          <nav aria-label="Primary" className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#record" className="transition-colors hover:text-foreground">Product</a>
            <a href="#security" className="transition-colors hover:text-foreground">Security</a>
            <a href="#pricing" className="transition-colors hover:text-foreground">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </header>

      <main id="main">
        <section className="flex border-b bg-canvas lg:min-h-[calc(100dvh-4rem)] lg:items-center">
          <FadeIn className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:py-20">
            <div className="min-w-0">
              <h1 className="text-5xl font-extrabold leading-[1.02] tracking-tight [overflow-wrap:break-word] md:text-6xl">Sales pipelines your team keeps current</h1>
              <p className="mt-6 max-w-md text-lg text-muted-foreground">Customers, leads, deals and follow-ups in one shared workspace.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button size="lg" asChild>
                  <Link href="/register">Create a free workspace</Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/login">Sign in</Link>
                </Button>
              </div>
            </div>
            <figure className="min-w-0">
              <Image
                src="/product/pipeline.png"
                alt="The pipeline board: deals arranged in stage columns with values, close dates and owners"
                width={1440}
                height={900}
                priority
                sizes="(min-width: 1024px) 640px, 100vw"
                className="h-auto w-full rounded-xl border shadow-lg"
              />
              <figcaption className="mt-3 text-xs text-muted-foreground">The pipeline board, shown with the demo workspace.</figcaption>
            </figure>
          </FadeIn>
        </section>

        <section id="record" className="py-20">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="max-w-2xl text-4xl font-extrabold tracking-tight md:text-5xl">Built around the sales record</h2>
            <dl className="mt-12 grid gap-x-12 gap-y-10 sm:grid-cols-2">
              {RECORD.map(({ icon, tone, title, body }) => (
                <div key={title} className="flex gap-4">
                  <IconTile icon={icon} tone={tone} size="lg" />
                  <div>
                    <dt className="text-lg font-semibold">{title}</dt>
                    <dd className="mt-1 text-muted-foreground">{body}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section id="security" className="border-y bg-canvas py-20">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 md:grid-cols-2 md:items-start">
            <h2 className="text-4xl font-extrabold tracking-tight md:text-5xl">Your data stays in your workspace</h2>
            <ul className="space-y-3">
              {SECURITY.map((item) => (
                <li key={item} className="flex items-start gap-3 rounded-xl border bg-card p-4 text-[15px]">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden /> {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="pricing" className="py-20">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-4xl font-extrabold tracking-tight md:text-5xl">Plans</h2>
            <p className="mt-3 text-muted-foreground">Billing here is simulated: no payment details are collected.</p>
            <div className="relative mt-10 overflow-x-auto rounded-2xl border">
              <table className="w-full min-w-[640px] text-left text-[15px]">
                <caption className="sr-only">Plan comparison</caption>
                <thead>
                  <tr className="border-b bg-subtle">
                    <th scope="col" className="sticky left-0 w-1/4 bg-subtle p-4 font-semibold text-muted-foreground">
                      <span className="sr-only">Feature</span>
                    </th>
                    {PLANS.map((id) => (
                      <th key={id} scope="col" className={cn('p-4 align-bottom', id === 'GROWTH' && 'bg-accent')}>
                        <span className="block text-lg font-extrabold">{PLAN_DEFINITIONS[id].name}</span>
                        <span className="block font-semibold text-muted-foreground">${PLAN_DEFINITIONS[id].monthlyPriceUsd} a month</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {ROWS.map((row) => (
                    <tr key={row.label}>
                      <th scope="row" className="sticky left-0 bg-background p-4 font-semibold">{row.label}</th>
                      {PLANS.map((id) => {
                        const value = row.value(id);
                        return (
                          <td key={id} className={cn('p-4', id === 'GROWTH' && 'bg-accent/50')}>
                            {value === 'Yes' ? <Check className="h-4 w-4 text-success" aria-label="Included" /> : value === 'No' ? <span className="text-muted-foreground">Not included</span> : value}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="bg-brand-deep text-white">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-16 md:flex-row md:items-center">
            <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">Start on the free plan</h2>
            <Button size="lg" variant="secondary" asChild>
              <Link href="/register">Create a free workspace</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-sm text-muted-foreground sm:flex-row">
          <Logo className="text-foreground" />
          <p>Open-source CRM, self-hosted.</p>
        </div>
      </footer>
    </div>
  );
}
