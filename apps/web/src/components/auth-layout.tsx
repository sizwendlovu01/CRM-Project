import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { Logo, ThemeToggle } from './common';

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-4 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Link href="/" aria-label="Home">
            <Logo />
          </Link>
          <ThemeToggle />
        </div>
        <main id="main" className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
        </main>
      </div>
      <aside className="relative hidden overflow-hidden border-l bg-sidebar lg:flex lg:flex-col lg:justify-center lg:px-16">
        <div aria-hidden className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative max-w-md">
          <p className="text-sm font-medium text-primary">Enterprise CRM</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">Close more deals with a pipeline your whole team trusts.</h2>
          <ul className="mt-8 space-y-4 text-sm text-muted-foreground">
            {['Customers, leads and deals in one place', 'Drag-and-drop pipeline with weighted forecasts', 'Roles and permissions enforced on every request', 'Analytics computed from your real data'].map((item) => (
              <li key={item} className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-success" /> {item}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
