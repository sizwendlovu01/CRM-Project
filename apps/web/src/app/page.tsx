import Link from 'next/link';
import { ArrowRight, BarChart3, Bell, Building2, CheckCircle2, KanbanSquare, Lock, ShieldCheck, Upload, Users } from 'lucide-react';
import { PLAN_DEFINITIONS, PLANS } from '@crm/shared';
import { Logo, ThemeToggle } from '@/components/common';
import { FadeIn } from '@/components/motion';
import { Button } from '@/components/ui/button';
import { IconTile } from '@/components/ui/misc';

const FEATURES = [
  { icon: Building2, tone: 'green' as const, title: 'Customer 360', body: 'Every customer with notes, activities, deals and tasks on one chronological timeline.' },
  { icon: KanbanSquare, tone: 'primary' as const, title: 'Visual pipelines', body: 'Drag deals across stages, with live pipeline and probability-weighted forecasts.' },
  { icon: Users, tone: 'blue' as const, title: 'Built for teams', body: 'Invite your team with five roles, from owner to read-only viewer, enforced on the server.' },
  { icon: BarChart3, tone: 'amber' as const, title: 'Real-time analytics', body: 'Revenue, conversion, win rate and rep performance calculated from your live data.' },
  { icon: Bell, tone: 'red' as const, title: 'Smart notifications', body: 'Assignments, deal changes and due-date reminders in-app and by email.' },
  { icon: Upload, tone: 'slate' as const, title: 'CSV import & export', body: 'Bring your data in with duplicate detection and take it anywhere, any time.' },
];

const PANELS = [
  { eyebrow: 'Capture', title: 'Leads that never slip through', body: 'Track source, priority and follow-ups, then convert to a customer and deal in one safe step.', className: 'bg-[#3b2fc9] text-white' },
  { eyebrow: 'Forecast', title: 'A pipeline you can trust', body: 'Weighted forecasts, stage probabilities and outcomes update the moment a deal moves.', className: 'bg-[#0b6bcb] text-white' },
  { eyebrow: 'Win', title: 'Every interaction in context', body: 'Calls, meetings, notes and tasks on one timeline, so nothing is lost between handovers.', className: 'bg-[#067a52] text-white' },
];

const SECURITY = [
  'Strict workspace isolation verified by automated tests',
  'Argon2id password hashing and server-side sessions',
  'CSRF protection, rate limiting and account lockout',
  'Full audit log of administrative actions',
];

const PREVIEW = [
  { name: 'Lead In', color: 'bg-status-slate' },
  { name: 'Qualified', color: 'bg-status-blue' },
  { name: 'Proposal', color: 'bg-status-violet' },
  { name: 'Negotiation', color: 'bg-status-amber' },
  { name: 'Closed Won', color: 'bg-status-green' },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Logo />
          <nav aria-label="Primary" className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <a href="#security" className="transition-colors hover:text-foreground">Security</a>
            <a href="#pricing" className="transition-colors hover:text-foreground">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild className="hidden rounded-full sm:inline-flex">
              <Link href="/register">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main id="main">
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-40 mx-auto h-[520px] max-w-5xl rounded-full bg-[image:var(--hero-gradient)] opacity-90 blur-3xl" />
          <FadeIn className="relative mx-auto max-w-6xl px-4 pb-16 pt-20 text-center md:pt-28">
            <p className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border bg-card px-3.5 py-1.5 text-xs font-semibold text-muted-foreground shadow-xs">
              <ShieldCheck className="h-3.5 w-3.5 text-success" /> Multi-tenant and secure by default
            </p>
            <h1 className="mx-auto max-w-4xl text-4xl font-extrabold leading-[1.05] tracking-tight text-balance md:text-6xl lg:text-7xl">
              The CRM your sales team will <span className="text-gradient">actually enjoy</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground text-balance">
              Manage customers, convert leads, forecast your pipeline and coordinate your team - in one fast, focused workspace.
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Button size="lg" className="rounded-full" asChild>
                <Link href="/register">
                  Start for free <ArrowRight />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="rounded-full" asChild>
                <Link href="/login">Sign in to your workspace</Link>
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Free plan forever. No credit card required.</p>

            <div className="mx-auto mt-16 max-w-5xl rounded-[28px] border bg-card/70 p-2.5 shadow-xl backdrop-blur" aria-hidden>
              <div className="rounded-[20px] bg-canvas p-4 text-left">
                <div className="mb-4 flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-status-red/70" />
                  <span className="h-3 w-3 rounded-full bg-status-amber/70" />
                  <span className="h-3 w-3 rounded-full bg-status-green/70" />
                  <span className="ml-4 h-2.5 w-40 rounded-full bg-border" />
                </div>
                <div className="flex gap-3 overflow-hidden">
                  {PREVIEW.map((stage, i) => (
                    <div key={stage.name} className="min-w-40 flex-1 overflow-hidden rounded-xl border bg-card">
                      <div className={`h-1 ${stage.color}`} />
                      <p className="px-3 pt-2.5 text-xs font-bold">{stage.name}</p>
                      <div className="space-y-2 p-2.5">
                        {Array.from({ length: 3 - (i % 2) }, (_, j) => (
                          <div key={j} className="rounded-lg border bg-background p-2.5 shadow-xs">
                            <div className="h-2 w-3/4 rounded-full bg-muted" />
                            <div className="mt-2 flex items-center justify-between">
                              <div className="h-2 w-1/3 rounded-full bg-accent" />
                              <span className="h-5 w-5 rounded-full bg-muted" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </FadeIn>
        </section>

        <section className="py-16">
          <div className="mx-auto grid max-w-6xl gap-4 px-4 md:grid-cols-3">
            {PANELS.map((panel) => (
              <article key={panel.title} className={`hover-lift rounded-3xl p-7 shadow-lg ${panel.className}`}>
                <p className="inline-flex rounded-lg bg-white/15 px-2.5 py-1 text-xs font-semibold">{panel.eyebrow}</p>
                <h2 className="mt-5 text-2xl font-extrabold leading-tight">{panel.title}</h2>
                <p className="mt-3 text-sm text-white/85">{panel.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="features" className="border-t bg-canvas py-20">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-center text-3xl font-extrabold tracking-tight md:text-4xl">Everything you need to run sales</h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">From the first touchpoint to closed-won, without spreadsheets.</p>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon, tone, title, body }) => (
                <div key={title} className="hover-lift rounded-2xl border bg-card p-6 shadow-sm">
                  <IconTile icon={icon} tone={tone} size="lg" />
                  <h3 className="mt-5 text-lg font-bold">{title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="security" className="py-20">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 md:grid-cols-2">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">Enterprise-grade security</h2>
              <p className="mt-3 text-muted-foreground">Every request is authenticated, authorised and scoped to your workspace on the server. Your data is never visible to other organisations.</p>
            </div>
            <ul className="space-y-3">
              {SECURITY.map((item) => (
                <li key={item} className="flex items-start gap-3 rounded-xl border bg-card p-4 text-sm font-medium shadow-xs">
                  <Lock className="mt-0.5 h-4 w-4 text-primary" /> {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="pricing" className="border-t bg-canvas py-20">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-center text-3xl font-extrabold tracking-tight md:text-4xl">Simple plans that grow with you</h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-sm text-muted-foreground">
              Billing in this edition is simulated for evaluation - no payment details are ever collected.
            </p>
            <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {PLANS.map((id) => {
                const plan = PLAN_DEFINITIONS[id];
                const featured = id === 'GROWTH';
                return (
                  <div key={id} className={`relative flex flex-col rounded-2xl border bg-card p-6 shadow-sm ${featured ? 'ring-2 ring-primary' : ''}`}>
                    {featured && <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">Most popular</span>}
                    <h3 className="text-lg font-bold">{plan.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                    <p className="mt-5 font-[family-name:var(--font-jakarta)] text-4xl font-extrabold">
                      ${plan.monthlyPriceUsd}
                      <span className="text-sm font-medium text-muted-foreground">/month</span>
                    </p>
                    <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                      {plan.highlights.map((h) => (
                        <li key={h} className="flex gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {h}
                        </li>
                      ))}
                    </ul>
                    <Button className="mt-6 rounded-full" variant={featured ? 'default' : 'outline'} asChild>
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
