'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog } from 'radix-ui';
import {
  Activity,
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  Check,
  ChevronsUpDown,
  CircleDollarSign,
  KanbanSquare,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Menu as MenuIcon,
  Plus,
  Search,
  Settings,
  Target,
  User,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { humanize, type NotificationDto, type Paginated, type SearchResults } from '@crm/shared';
import { api } from '@/lib/api';
import { formatCurrency, formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useLogout } from '@/hooks/use-auth';
import { useDebounce } from '@/hooks/use-debounce';
import { useWorkspace, wsKey } from '@/hooks/use-workspace';
import { Logo, ThemeToggle } from './common';
import { Button } from './ui/button';
import { Avatar, Badge, Kbd } from './ui/misc';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from './ui/overlays';

const NAV = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    label: 'Sales',
    items: [
      { href: '/customers', label: 'Customers', icon: Building2 },
      { href: '/leads', label: 'Leads', icon: Target },
      { href: '/pipeline', label: 'Pipeline', icon: KanbanSquare },
      { href: '/deals', label: 'Deals', icon: CircleDollarSign },
    ],
  },
  {
    label: 'Work',
    items: [
      { href: '/tasks', label: 'Tasks', icon: ListTodo },
      { href: '/activities', label: 'Activities', icon: Activity },
    ],
  },
] as const;

function WorkspaceSwitcher() {
  const { me, workspace, slug } = useWorkspace();
  const router = useRouter();
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg border bg-background px-2.5 py-2 text-left text-sm shadow-xs hover:bg-muted"
          aria-label={`Current workspace ${workspace.name}. Switch workspace`}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent text-xs font-semibold text-accent-foreground">
            {workspace.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{workspace.name}</span>
            <span className="block text-xs text-muted-foreground">
              {humanize(workspace.plan)} plan · {humanize(workspace.role)}
            </span>
          </span>
          <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </MenuTrigger>
      <MenuContent align="start" className="w-64">
        <MenuLabel>Workspaces</MenuLabel>
        {me.memberships.map((m) => (
          <MenuItem key={m.workspace.id} onSelect={() => router.push(`/w/${m.workspace.slug}/dashboard`)}>
            <span className="flex h-5 w-5 items-center justify-center rounded bg-muted text-[10px] font-semibold">{m.workspace.name.slice(0, 1)}</span>
            <span className="flex-1 truncate">{m.workspace.name}</span>
            {m.workspace.slug === slug && <Check className="!text-primary" />}
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuItem onSelect={() => router.push('/onboarding')}>
          <Plus /> Create workspace
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { href } = useWorkspace();
  const link = (path: string, label: string, Icon: React.ComponentType<{ className?: string }>) => {
    const target = href(path);
    const active = pathname === target || pathname.startsWith(`${target}/`);
    return (
      <Link
        key={path}
        href={target}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors',
          active ? 'bg-background text-foreground shadow-xs ring-1 ring-border' : 'text-sidebar-foreground hover:bg-background/70 hover:text-foreground',
        )}
      >
        <Icon className={cn('h-4 w-4', active ? 'text-primary' : 'text-muted-foreground')} />
        {label}
      </Link>
    );
  };
  return (
    <nav aria-label="Main" className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
      {NAV.map((group) => (
        <div key={group.label} className="space-y-1">
          <p className="px-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</p>
          {group.items.map((item) => link(item.href, item.label, item.icon))}
        </div>
      ))}
      <div className="mt-auto space-y-1">
        {link('/notifications', 'Notifications', Bell)}
        {link('/settings', 'Settings', Settings)}
      </div>
    </nav>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center px-4">
        <Logo />
      </div>
      <div className="px-3">
        <WorkspaceSwitcher />
      </div>
      <SidebarNav onNavigate={onNavigate} />
    </div>
  );
}

function GlobalSearch() {
  const { base, workspaceId, href } = useWorkspace();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const debounced = useDebounce(query.trim(), 250);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const results = useQuery({
    queryKey: wsKey(workspaceId, 'search', debounced),
    queryFn: () => api<SearchResults>(`${base}/search`, { query: { q: debounced } }),
    enabled: open && debounced.length > 0,
  });

  const go = (path: string) => {
    setOpen(false);
    setQuery('');
    router.push(href(path));
  };
  const total = results.data ? results.data.customers.length + results.data.leads.length + results.data.deals.length : 0;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="flex h-9 w-full max-w-md items-center gap-2 rounded-md border bg-muted/50 px-3 text-sm text-muted-foreground hover:bg-muted"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Search customers, leads, deals…</span>
          <span className="hidden sm:inline">
            <Kbd>Ctrl K</Kbd>
          </span>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border bg-popover shadow-2xl">
          <Dialog.Title className="sr-only">Search</Dialog.Title>
          <Dialog.Description className="sr-only">Search across customers, leads and deals in this workspace</Dialog.Description>
          <div className="flex items-center gap-2 border-b px-4">
            <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type to search…"
              aria-label="Search query"
              className="h-12 flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          <div className="max-h-[50vh] overflow-y-auto p-2">
            {!debounced && <p className="px-3 py-6 text-center text-sm text-muted-foreground">Search by name, company, email or deal title.</p>}
            {debounced && results.isPending && <p className="px-3 py-6 text-center text-sm text-muted-foreground">Searching…</p>}
            {results.isError && <p className="px-3 py-6 text-center text-sm text-destructive">Search failed. Try again.</p>}
            {results.isSuccess && total === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">No results for “{debounced}”.</p>}
            {results.data && total > 0 && (
              <div className="space-y-3">
                {results.data.customers.length > 0 && (
                  <SearchGroup label="Customers">
                    {results.data.customers.map((c) => (
                      <SearchItem key={c.id} icon={Building2} title={c.fullName} subtitle={c.company ?? c.email} onSelect={() => go(`/customers/${c.id}`)} />
                    ))}
                  </SearchGroup>
                )}
                {results.data.leads.length > 0 && (
                  <SearchGroup label="Leads">
                    {results.data.leads.map((l) => (
                      <SearchItem key={l.id} icon={Target} title={l.fullName} subtitle={`${l.company ?? ''} · ${humanize(l.status)}`} onSelect={() => go(`/leads/${l.id}`)} />
                    ))}
                  </SearchGroup>
                )}
                {results.data.deals.length > 0 && (
                  <SearchGroup label="Deals">
                    {results.data.deals.map((d) => (
                      <SearchItem key={d.id} icon={Briefcase} title={d.title} subtitle={`${formatCurrency(d.value)} · ${humanize(d.status)}`} onSelect={() => go(`/deals/${d.id}`)} />
                    ))}
                  </SearchGroup>
                )}
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SearchGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">{label}</p>
      <ul>{children}</ul>
    </div>
  );
}

function SearchItem({ icon: Icon, title, subtitle, onSelect }: { icon: React.ComponentType<{ className?: string }>; title: string; subtitle?: string | null; onSelect: () => void }) {
  return (
    <li>
      <button type="button" onClick={onSelect} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="min-w-0">
          <span className="block truncate font-medium">{title}</span>
          {subtitle && <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>}
        </span>
      </button>
    </li>
  );
}

function NotificationBell() {
  const { workspaceId, href } = useWorkspace();
  const router = useRouter();
  const client = useQueryClient();
  const key = wsKey(workspaceId, 'notifications', 'bell');
  const data = useQuery({
    queryKey: key,
    queryFn: () => api<Paginated<NotificationDto> & { unreadCount: number }>('/notifications', { query: { workspaceId, pageSize: 8 } }),
    refetchInterval: 60_000,
  });
  const markAll = useMutation({
    mutationFn: () => api('/notifications/read-all', { method: 'POST', query: { workspaceId } }),
    onSuccess: () => client.invalidateQueries({ queryKey: wsKey(workspaceId, 'notifications') }),
  });
  const open = useMutation({
    mutationFn: (n: NotificationDto) => api(`/notifications/${n.id}/read`, { method: 'POST' }),
    onSettled: () => client.invalidateQueries({ queryKey: wsKey(workspaceId, 'notifications') }),
  });
  const unread = data.data?.unreadCount ?? 0;

  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
          <Bell />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </MenuTrigger>
      <MenuContent className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <p className="text-sm font-semibold">Notifications</p>
          <Button variant="link" size="sm" disabled={unread === 0} onClick={() => markAll.mutate()}>
            Mark all as read
          </Button>
        </div>
        <div className="max-h-80 overflow-y-auto p-1">
          {data.isPending && <p className="px-3 py-6 text-center text-sm text-muted-foreground">Loading…</p>}
          {data.isError && <p className="px-3 py-6 text-center text-sm text-destructive">Could not load notifications</p>}
          {data.data?.data.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>}
          {data.data?.data.map((n) => (
            <MenuItem
              key={n.id}
              className="items-start py-2"
              onSelect={() => {
                if (!n.readAt) open.mutate(n);
                if (n.link) router.push(n.link);
              }}
            >
              <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.readAt ? 'bg-transparent' : 'bg-primary')} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className={cn('block text-sm', !n.readAt && 'font-medium')}>{n.title}</span>
                {n.body && <span className="block truncate text-xs text-muted-foreground">{n.body}</span>}
                <span className="block text-[11px] text-muted-foreground">{formatRelative(n.createdAt)}</span>
              </span>
            </MenuItem>
          ))}
        </div>
        <div className="border-t p-1">
          <MenuItem onSelect={() => router.push(href('/notifications'))} className="justify-center text-primary">
            View all notifications
          </MenuItem>
        </div>
      </MenuContent>
    </Menu>
  );
}

function UserMenu() {
  const { me, href } = useWorkspace();
  const router = useRouter();
  const logout = useLogout();
  return (
    <Menu>
      <MenuTrigger asChild>
        <button type="button" className="rounded-full focus-visible:outline-2" aria-label="Account menu">
          <Avatar name={me.name} />
        </button>
      </MenuTrigger>
      <MenuContent className="w-56">
        <div className="px-2 py-1.5">
          <p className="truncate text-sm font-medium">{me.name}</p>
          <p className="truncate text-xs text-muted-foreground">{me.email}</p>
        </div>
        <MenuSeparator />
        <MenuItem onSelect={() => router.push(href('/settings/profile'))}>
          <User /> Profile
        </MenuItem>
        <MenuItem onSelect={() => router.push(href('/settings/team'))}>
          <Users /> Team
        </MenuItem>
        <MenuItem onSelect={() => router.push(href('/settings/workspace'))}>
          <Settings /> Workspace settings
        </MenuItem>
        <MenuSeparator />
        <MenuItem onSelect={() => logout.mutate()} disabled={logout.isPending}>
          <LogOut /> Sign out
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

function VerifyEmailBanner() {
  const { me } = useWorkspace();
  const [hidden, setHidden] = React.useState(false);
  const resend = useMutation({
    mutationFn: () => api('/auth/resend-verification', { method: 'POST' }),
    onSuccess: () => toast.success(`Verification email sent to ${me.email}`),
  });
  if (me.emailVerified || hidden) return null;
  return (
    <div className="flex items-center gap-3 border-b bg-warning-soft px-4 py-2 text-sm text-warning">
      <span className="flex-1">Please verify your email address to secure your account.</span>
      <Button size="sm" variant="outline" loading={resend.isPending} onClick={() => resend.mutate()}>
        Resend email
      </Button>
      <Button size="icon-sm" variant="ghost" aria-label="Dismiss" onClick={() => setHidden(true)}>
        <X />
      </Button>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const { workspace } = useWorkspace();
  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 border-r bg-sidebar lg:block">
        <SidebarContent />
      </aside>

      <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/40 lg:hidden" />
          <Dialog.Content className="fixed inset-y-0 left-0 z-50 w-72 border-r bg-sidebar shadow-xl lg:hidden">
            <Dialog.Title className="sr-only">Navigation</Dialog.Title>
            <Dialog.Description className="sr-only">Main navigation menu</Dialog.Description>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <div className="flex min-w-0 flex-1 flex-col">
        <VerifyEmailBanner />
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 lg:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation" onClick={() => setMobileOpen(true)}>
            <MenuIcon />
          </Button>
          <div className="flex-1">
            <GlobalSearch />
          </div>
          {workspace.subscriptionStatus !== 'ACTIVE' && <Badge tone="warning">{humanize(workspace.subscriptionStatus)}</Badge>}
          <ThemeToggle />
          <NotificationBell />
          <UserMenu />
        </header>
        <main id="main" className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
