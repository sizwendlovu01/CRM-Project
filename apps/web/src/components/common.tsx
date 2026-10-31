'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Inbox, Monitor, Moon, Search, Sun, X } from 'lucide-react';
import type { PaginationMeta } from '@crm/shared';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Menu, MenuContent, MenuItem, MenuTrigger } from './ui/overlays';
import { IconTile, Skeleton, type IconTone } from './ui/misc';

export function Logo({ className, withText = true }: { className?: string; withText?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-semibold tracking-tight', className)}>
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground" aria-hidden>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M4 17 L9 11 L13 14 L20 6" />
          <circle cx="20" cy="6" r="1.2" fill="currentColor" />
        </svg>
      </span>
      {withText && <span className="font-[family-name:var(--font-jakarta)] text-[15px] font-extrabold">Enterprise<span className="text-primary"> CRM</span></span>}
    </span>
  );
}

interface Crumb {
  label: string;
  href?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  icon,
  iconTone = 'primary',
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbs?: Crumb[];
  icon?: React.ComponentType<{ className?: string }>;
  iconTone?: IconTone;
}) {
  return (
    <div className="mb-6 space-y-3">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            {breadcrumbs.map((crumb, index) => (
              <li key={crumb.label} className="flex items-center gap-1">
                {index > 0 && <ChevronRight className="h-3 w-3" aria-hidden />}
                {crumb.href ? (
                  <Link href={crumb.href} className="hover:text-foreground">
                    {crumb.label}
                  </Link>
                ) : (
                  <span aria-current="page">{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {icon && <IconTile icon={icon} tone={iconTone} size="lg" className="hidden sm:inline-flex" />}
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-extrabold tracking-tight sm:text-[26px]">{title}</h1>
            {description && <div className="mt-1 text-sm text-muted-foreground">{description}</div>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <div className="relative mb-5" aria-hidden>
        <div className="absolute inset-0 -m-3 rounded-3xl bg-accent/60 blur-md" />
        <div className="relative flex h-14 w-14 rotate-3 items-center justify-center rounded-2xl border bg-card shadow-md">
          <Icon className="h-6 w-6 text-primary" />
        </div>
      </div>
      <h3 className="text-base font-bold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-danger-soft">
        <AlertTriangle className="h-5 w-5 text-destructive" />
      </div>
      <h3 className="text-base font-bold">We couldn&apos;t load this</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="divide-y" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-4">
          {Array.from({ length: columns }, (_, c) => (
            <Skeleton key={c} className={cn('h-4 rounded-full', c === 0 ? 'w-1/4' : 'w-1/6')} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function Pagination({ meta, onPageChange }: { meta: PaginationMeta; onPageChange: (page: number) => void }) {
  const from = meta.total === 0 ? 0 : (meta.page - 1) * meta.pageSize + 1;
  const to = Math.min(meta.page * meta.pageSize, meta.total);
  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t bg-subtle/60 px-4 py-3 text-sm sm:flex-row">
      <p className="text-muted-foreground" aria-live="polite">
        Showing <span className="font-medium text-foreground">{from}</span> to <span className="font-medium text-foreground">{to}</span> of{' '}
        <span className="font-medium text-foreground">{meta.total}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={meta.page <= 1} onClick={() => onPageChange(meta.page - 1)} aria-label="Previous page">
          <ChevronLeft /> Previous
        </Button>
        <span className="rounded-md bg-card px-2 py-1 text-xs font-semibold text-muted-foreground ring-1 ring-border">
          {meta.page} / {meta.totalPages}
        </span>
        <Button variant="outline" size="sm" disabled={meta.page >= meta.totalPages} onClick={() => onPageChange(meta.page + 1)} aria-label="Next page">
          Next <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className, label = 'Search' }: { value: string; onChange: (value: string) => void; placeholder?: string; className?: string; label?: string }) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input type="search" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="bg-subtle pl-9 pr-8 focus-visible:bg-card" />
      {value && (
        <button type="button" onClick={() => onChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground" aria-label="Clear search">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Change theme">
          {resolvedTheme === 'dark' ? <Moon /> : <Sun />}
        </Button>
      </MenuTrigger>
      <MenuContent>
        <MenuItem onSelect={() => setTheme('light')}>
          <Sun /> Light
        </MenuItem>
        <MenuItem onSelect={() => setTheme('dark')}>
          <Moon /> Dark
        </MenuItem>
        <MenuItem onSelect={() => setTheme('system')}>
          <Monitor /> System
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

export function FullPageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3" role="status" aria-live="polite">
      <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-accent border-t-primary" aria-hidden />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

/** Sortable column header button with aria-sort on the parent <th>. */
export function SortButton({ label, active, direction, onClick }: { label: string; active: boolean; direction: 'asc' | 'desc'; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn('inline-flex items-center gap-1 transition-colors hover:text-foreground', active && 'text-primary')}>
      {label}
      {active ? (
        direction === 'asc' ? <ArrowUp aria-hidden className="h-3 w-3" /> : <ArrowDown aria-hidden className="h-3 w-3" />
      ) : (
        <ArrowUpDown aria-hidden className="h-3 w-3 opacity-60" />
      )}
    </button>
  );
}
