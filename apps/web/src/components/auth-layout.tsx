import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { Logo, ThemeToggle } from './common';
import { FadeIn } from './motion';

const STAGES = [
  { name: 'New', color: 'bg-status-blue' },
  { name: 'Qualified', color: 'bg-status-violet' },
  { name: 'Proposal', color: 'bg-status-amber' },
  { name: 'Won', color: 'bg-status-green' },
];

/** Decorative product preview (abstract shapes only - no invented figures). */
function ProductPreview() {
  return (
    <div aria-hidden className="relative mt-10 w-full max-w-md">
      <div className="rounded-2xl border border-white/25 bg-white/12 p-4 shadow-2xl backdrop-blur-md">
        <div className="mb-3 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-white/50" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/35" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
          <span className="ml-3 h-2 w-28 rounded-full bg-white/30" />
        </div>
        <div className="grid grid-cols-4 gap-2">
          {STAGES.map((stage, column) => (
            <div key={stage.name} className="space-y-2 rounded-xl bg-white/10 p-2">
              <span className={`block rounded-md px-1.5 py-1 text-center text-[10px] font-bold text-white ${stage.color}`}>{stage.name}</span>
              {Array.from({ length: 3 - (column % 2) }, (_, i) => (
                <div key={i} className="rounded-lg bg-white/85 p-1.5 shadow-sm">
                  <div className="h-1.5 w-4/5 rounded-full bg-slate-300" />
                  <div className="mt-1.5 h-1.5 w-2/5 rounded-full bg-indigo-300" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="absolute -bottom-6 -left-6 rounded-xl bg-white px-3 py-2 shadow-xl">
        <span className="flex items-center gap-2 text-xs font-semibold text-slate-800">
          <span className="rounded-md bg-status-green px-2 py-0.5 text-[10px] font-bold text-white">Won</span> Deal moved to Closed Won
        </span>
      </div>
    </div>
  );
}

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col bg-background px-4 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Link href="/" aria-label="Home">
            <Logo />
          </Link>
          <ThemeToggle />
        </div>
        <main id="main" className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <FadeIn>
            <h1 className="text-[28px] font-extrabold tracking-tight">{title}</h1>
            {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
          </FadeIn>
        </main>
        <p className="text-center text-xs text-muted-foreground">Secured with server-side sessions, CSRF protection and Argon2id.</p>
      </div>
      <aside className="relative hidden overflow-hidden bg-[image:var(--brand-gradient)] text-white lg:flex lg:flex-col lg:justify-center lg:px-16">
        <div aria-hidden className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/15 blur-3xl" />
        <div aria-hidden className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-sky-300/25 blur-3xl" />
        <div className="relative max-w-lg">
          <p className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold ring-1 ring-white/25">Enterprise CRM</p>
          <h2 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight">Close more deals with a pipeline your whole team trusts.</h2>
          <ul className="mt-8 space-y-3.5 text-sm text-white/90">
            {['Customers, leads and deals in one place', 'Drag-and-drop pipeline with weighted forecasts', 'Roles and permissions enforced on every request', 'Analytics computed from your real data'].map((item) => (
              <li key={item} className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-200" /> {item}
              </li>
            ))}
          </ul>
          <ProductPreview />
        </div>
      </aside>
    </div>
  );
}
