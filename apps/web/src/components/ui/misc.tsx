import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn, initials } from '@/lib/utils';

export const badgeVariants = cva('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold', {
  variants: {
    tone: {
      neutral: 'bg-muted text-muted-foreground ring-1 ring-inset ring-border',
      primary: 'bg-accent text-accent-foreground ring-1 ring-inset ring-primary/20',
      success: 'bg-success-soft text-success ring-1 ring-inset ring-success/25',
      warning: 'bg-warning-soft text-warning ring-1 ring-inset ring-warning/25',
      danger: 'bg-danger-soft text-destructive ring-1 ring-inset ring-destructive/25',
      info: 'bg-info-soft text-info ring-1 ring-inset ring-info/25',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export function Badge({ className, tone, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export type StatusColor = 'green' | 'amber' | 'red' | 'blue' | 'violet' | 'slate' | 'teal' | 'pink';

const STATUS_FILL: Record<StatusColor, string> = {
  green: 'bg-status-green',
  amber: 'bg-status-amber',
  red: 'bg-status-red',
  blue: 'bg-status-blue',
  violet: 'bg-status-violet',
  slate: 'bg-status-slate',
  teal: 'bg-status-teal',
  pink: 'bg-status-pink',
};

/** Solid, colour-coded status pill that reads at a glance (white text meets 4.5:1 on every fill). */
export function StatusPill({ color, children, className }: { color: StatusColor; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex min-w-[84px] items-center justify-center rounded-md px-2.5 py-1 text-xs font-semibold text-white shadow-xs', STATUS_FILL[color], className)}>
      {children}
    </span>
  );
}

export function Card({ className, interactive, ...props }: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return <div className={cn('rounded-2xl border bg-card text-card-foreground shadow-sm', interactive && 'hover-lift', className)} {...props} />;
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1 p-5 pb-3', className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-[15px] font-bold text-foreground', className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-xs text-muted-foreground', className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5 pt-0', className)} {...props} />;
}

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn('animate-shimmer rounded-md bg-[length:200%_100%] bg-[linear-gradient(90deg,var(--muted)_0%,var(--subtle)_45%,var(--muted)_90%)]', className)}
      {...props}
    />
  );
}

export function Separator({ className }: { className?: string }) {
  return <div role="separator" className={cn('h-px w-full bg-border', className)} />;
}

const ICON_TONES = {
  primary: 'bg-accent text-accent-foreground',
  green: 'bg-success-soft text-success',
  amber: 'bg-warning-soft text-warning',
  red: 'bg-danger-soft text-destructive',
  blue: 'bg-info-soft text-info',
  slate: 'bg-muted text-muted-foreground',
} as const;
export type IconTone = keyof typeof ICON_TONES;

/** Rounded, tinted icon container used in headers, KPI cards and navigation. */
export function IconTile({ icon: Icon, tone = 'primary', size = 'md', className }: { icon: React.ComponentType<{ className?: string }>; tone?: IconTone; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-xl',
        ICON_TONES[tone],
        size === 'sm' && 'h-7 w-7 rounded-lg [&_svg]:size-3.5',
        size === 'md' && 'h-9 w-9 [&_svg]:size-[18px]',
        size === 'lg' && 'h-11 w-11 [&_svg]:size-5',
        className,
      )}
    >
      <Icon />
    </span>
  );
}

const AVATAR_TONES = ['bg-indigo-100 text-indigo-700', 'bg-teal-100 text-teal-700', 'bg-amber-100 text-amber-800', 'bg-rose-100 text-rose-700', 'bg-sky-100 text-sky-700', 'bg-violet-100 text-violet-700'];
const AVATAR_TONES_DARK = ['dark:bg-indigo-500/20 dark:text-indigo-200', 'dark:bg-teal-500/20 dark:text-teal-200', 'dark:bg-amber-500/20 dark:text-amber-200', 'dark:bg-rose-500/20 dark:text-rose-200', 'dark:bg-sky-500/20 dark:text-sky-200', 'dark:bg-violet-500/20 dark:text-violet-200'];

export function Avatar({ name, size = 'md', className }: { name: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const index = [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % AVATAR_TONES.length;
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-bold ring-2 ring-card',
        AVATAR_TONES[index],
        AVATAR_TONES_DARK[index],
        size === 'sm' && 'h-6 w-6 text-[10px]',
        size === 'md' && 'h-8 w-8 text-xs',
        size === 'lg' && 'h-12 w-12 text-base',
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="relative w-full overflow-x-auto">
      <table className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  );
}
export function THead(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className="border-b bg-subtle text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground" {...props} />;
}
export function TBody(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className="divide-y" {...props} />;
}
export function TR({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('transition-colors duration-150 hover:bg-subtle', className)} {...props} />;
}
export function TH({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th scope="col" className={cn('h-10 whitespace-nowrap px-4 font-semibold', className)} {...props} />;
}
export function TD({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-4 py-3 align-middle', className)} {...props} />;
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded-md border bg-card px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground shadow-xs">{children}</kbd>;
}
