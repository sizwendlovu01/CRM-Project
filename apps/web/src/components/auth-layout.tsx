import Link from 'next/link';
import { Check } from 'lucide-react';
import { Logo, ThemeToggle } from './common';
import { FadeIn } from './motion';

const POINTS = [
  'Customers, leads and deals in one place',
  'Drag-and-drop pipeline with weighted forecasts',
  'Roles and permissions checked on every request',
  'Analytics computed from your own records',
];

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
            {/* Touch-size controls on the sign-in screens. */}
            <div className="mt-8 [&_button[type=submit]]:h-11 [&_input]:h-11">{children}</div>
            {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
          </FadeIn>
        </main>
        <p className="text-center text-xs text-muted-foreground">Secured with server-side sessions, CSRF protection and Argon2id.</p>
      </div>
      <aside className="hidden bg-brand-deep text-white lg:flex lg:flex-col lg:justify-center lg:px-16">
        <div className="max-w-lg">
          <p className="text-sm font-semibold text-white/80">Enterprise CRM</p>
          <h2 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight">A pipeline your whole team trusts.</h2>
          <ul className="mt-10 space-y-4 text-[15px]">
            {POINTS.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-brand-deep">
                  <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
