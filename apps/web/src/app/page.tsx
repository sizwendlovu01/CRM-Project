import Link from 'next/link';
import { ArrowRight, BarChart3, Bell, Building2, CheckCircle2, KanbanSquare, Lock, ShieldCheck, Upload, Users } from 'lucide-react';
import { PLAN_DEFINITIONS, PLANS } from '@crm/shared';
import { Logo, ThemeToggle } from '@/components/common';
import { Button } from '@/components/ui/button';

const FEATURES = [
  { icon: Building2, title: 'Customer 360', body: 'Every customer with notes, activities, deals and tasks on one chronological timeline.' },
  { icon: KanbanSquare, title: 'Visual pipelines', body: 'Drag deals across stages, with live pipeline and probability-weighted forecasts.' },
  { icon: Users, title: 'Built for teams', body: 'Invite your team with five roles, from owner to read-only viewer, enforced on the server.' },
  { icon: BarChart3, title: 'Real-time analytics', body: 'Revenue, conversion, win rate and rep performance calculated from your live data.' },
  { icon: Bell, title: 'Smart notifications', body: 'Assignments, deal changes and due-date reminders in-app and by email.' },
  { icon: Upload, title: 'CSV import & export', body: 'Bring your data in with duplicate detection and take it anywhere, any time.' },
];

const SECURITY = [
  'Strict workspace isolation verified by automated tests',
  'Argon2id password hashing and server-side sessions',
  'CSRF protection, rate limiting and account lockout',
  'Full audit log of administrative actions',
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Logo />
          <nav aria-label="Primary" className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#security" className="hover:text-foreground">Security</a>
            <a href="#pricing" className="hover:text-foreground">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild className="hidden sm:inline-flex">
              <Link href="/register">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main id="main">
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-40 mx-auto h-[480px] max-w-4xl rounded-full bg-primary/10 blur-3xl" />
          <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-20 text-center md:pt-28">
            <p className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-success" /> Multi-tenant, secure by default
            </p>
            <h1 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight text-balance md:text-6xl">
              The CRM your sales team will actually <span className="text-primary">enjoy using</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground text-balance">
              Manage customers, convert leads, forecast your pipeline and coordinate your team - in one fast, focused workspace.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/register">
                  Start for free <ArrowRight />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/login">Sign in to your workspace</Link>
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Free plan forever. No credit card required.</p>

            <div className="mx-auto mt-16 max-w-5xl rounded-2xl border bg-card p-2 shadow-2xl shadow-primary/5">
              <div className="grid gap-3 rounded-xl bg-muted/40 p-4 text-left sm:grid-cols-4">
                {[
                  ['Pipeline value', '$1.24M', '+12.4%'],
                  ['Weighted forecast', '$486K', '+8.1%'],
                  ['Win rate', '38.5%', '+3.2 pts'],
                  ['Overdue tasks', '4', '-6'],
                ].map(([label, value, delta]) => (
                  <div key={label} className="rounded-lg border bg-card p-4">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="mt-1 text-xl font-semibold">{value}</p>
                    <p className="text-xs text-success">{delta}</p>
                  </div>
                ))}
                <div className="rounded-lg border bg-card p-4 sm:col-span-4">
                  <div className="flex gap-3 overflow-hidden">
                    {['Lead In', 'Qualified', 'Proposal', 'Negotiation'].map((stage, i) => (
                      <div key={stage} className="min-w-36 flex-1 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">{stage}</p>
                        {Array.from({ length: 3 - (i % 2) }, (_, j) => (
                          <div key={j} className="rounded-md border bg-background p-2.5">
                            <div className="h-2 w-3/4 rounded bg-muted" />
                            <div className="mt-2 h-2 w-1/3 rounded bg-primary/30" />
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Illustrative preview</p>
          </div>
        </section>

        <section id="features" className="border-t bg-muted/30 py-20">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-center text-3xl font-semibold tracking-tight">Everything you need to run sales</h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">From the first touchpoint to closed-won, without spreadsheets.</p>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <div key={title} className="rounded-xl border bg-card p-6">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                    <Icon className="h-5 w-5 text-accent-foreground" />
                  </div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="security" className="py-20">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 md:grid-cols-2">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">Enterprise-grade security</h2>
              <p className="mt-3 text-muted-foreground">Every request is authenticated, authorised and scoped to your workspace on the server. Your data is never visible to other organisations.</p>
            </div>
            <ul className="space-y-3">
              {SECURITY.map((item) => (
                <li key={item} className="flex items-start gap-3 rounded-lg border bg-card p-4 text-sm">
                  <Lock className="mt-0.5 h-4 w-4 text-primary" /> {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="pricing" className="border-t bg-muted/30 py-20">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-center text-3xl font-semibold tracking-tight">Simple plans that grow with you</h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-sm text-muted-foreground">
              Billing in this edition is simulated for evaluation - no payment details are ever collected.
            </p>
            <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {PLANS.map((id) => {
                const plan = PLAN_DEFINITIONS[id];
                const featured = id === 'GROWTH';
                return (
                  <div key={id} className={`flex flex-col rounded-xl border bg-card p-6 ${featured ? 'ring-2 ring-primary' : ''}`}>
                    <h3 className="font-semibold">{plan.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                    <p className="mt-4 text-3xl font-semibold">
                      ${plan.monthlyPriceUsd}
                      <span className="text-sm font-normal text-muted-foreground">/month</span>
                    </p>
                    <ul className="mt-5 flex-1 space-y-2 text-sm">
                      {plan.highlights.map((h) => (
                        <li key={h} className="flex gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {h}
                        </li>
                      ))}
                    </ul>
                    <Button className="mt-6" variant={featured ? 'default' : 'outline'} asChild>
                      <Link href="/register">Get started</Link>
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-sm text-muted-foreground sm:flex-row">
          <Logo className="text-foreground" />
          <p>Open-source CRM platform. Self-hosted, zero vendor lock-in.</p>
        </div>
      </footer>
    </div>
  );
}
