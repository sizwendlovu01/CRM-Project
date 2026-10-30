'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog } from 'radix-ui';
import { motion } from 'motion/react';
import {
  Activity,
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  Check,
  ChevronsLeft,
  ChevronsRight,
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
import { FadeIn } from './motion';
import { Button } from './ui/button';
import { Avatar, Badge, Kbd } from './ui/misc';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from './ui/overlays';

type NavIcon = React.ComponentType<{ className?: string }>;
interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
  /** Icon colour gives each area a recognisable identity in the sidebar. */
  color: string;
}

const NAV: { label: string; items: NavItem[] }[] = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, color: 'text-primary' },
      { href: '/analytics', label: 'Analytics', icon: BarChart3, color: 'text-status-blue' },
    ],
  },
  {
    label: 'Sales',
    items: [
      { href: '/customers', label: 'Customers', icon: Building2, color: 'text-status-teal' },
      { href: '/leads', label: 'Leads', icon: Target, color: 'text-status-pink' },
      { href: '/pipeline', label: 'Pipeline', icon: KanbanSquare, color: 'text-status-violet' },
      { href: '/deals', label: 'Deals', icon: CircleDollarSign, color: 'text-status-green' },
    ],
  },
  {
    label: 'Work',
    items: [
      { href: '/tasks', label: 'Tasks', icon: ListTodo, color: 'text-status-amber' },
      { href: '/activities', label: 'Activities', icon: Activity, color: 'text-status-red' },
    ],
  },
];

const FOOTER_NAV: NavItem[] = [
  { href: '/notifications', label: 'Notifications', icon: Bell, color: 'text-muted-foreground' },
  { href: '/settings', label: 'Settings', icon: Settings, color: 'text-muted-foreground' },
];

const COLLAPSE_KEY = 'crm:sidebar-collapsed';

function WorkspaceSwitcher({ collapsed }: { collapsed?: boolean }) {
  const { me, workspace, slug } = useWorkspace();
  const router = useRouter();
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'group flex w-full items-center gap-2.5 rounded-xl border bg-subtle p-2 text-left text-sm transition-colors hover:border-primary/30 hover:bg-accent/50',
            collapsed && 'justify-center p-1.5',
          )}
          aria-label={`Current workspace ${workspace.name}. Switch workspace`}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[image:var(--brand-gradient)] text-sm font-bold text-white shadow-sm">
            {workspace.name.slice(0, 1).toUpperCase()}
          </span>
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{workspace.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {humanize(workspace.plan)} · {humanize(workspace.role)}
                </span>
              </span>
              <ChevronsUpDown className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
            </>
          )}
        </button>
      </MenuTrigger>
      <MenuContent align="start" className="w-64">
        <MenuLabel>Workspaces</MenuLabel>
        {me.memberships.map((m) => (
          <MenuItem key={m.workspace.id} onSelect={() => router.push(`/w/${m.workspace.slug}/dashboard`)}>
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-[11px] font-bold">{m.workspace.name.slice(0, 1)}</span>
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

function SidebarNav({ onNavigate, collapsed, layoutGroup }: { onNavigate?: () => void; collapsed?: boolean; layoutGroup: string }) {
  const pathname = usePathname();
  const { href } = useWorkspace();
  const link = (item: NavItem) => {
    const target = href(item.href);
    const active = pathname === target || pathname.startsWith(`${target}/`);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={target}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        aria-label={collapsed ? item.label : undefined}
        title={collapsed ? item.label : undefined}
        className={cn(
          'relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors duration-150',
          collapsed && 'justify-center px-0',
          active ? 'bg-accent text-accent-foreground' : 'text-sidebar-foreground hover:bg-muted hover:text-foreground',
        )}
      >
        {active && (
          <motion.span
            layoutId={`nav-indicator-${layoutGroup}`}
            className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-primary"
            transition={{ type: 'spring', stiffness: 500, damping: 38 }}
          />
        )}
        <Icon className={cn('h-[18px] w-[18px] shrink-0', active ? 'text-primary' : item.color)} />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </Link>
    );
  };
  return (
    <nav aria-label="Main" className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
      {NAV.map((group) => (
        <div key={group.label} className="space-y-0.5">
          {collapsed ? (
            <div className="mx-auto mb-2 h-px w-6 bg-border" aria-hidden />
          ) : (
            <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/80">{group.label}</p>
          )}
          {group.items.map(link)}
        </div>
      ))}
      <div className="mt-auto space-y-0.5 border-t pt-4">{FOOTER_NAV.map(link)}</div>
    </nav>
  );
}

function SidebarContent({ onNavigate, collapsed, onToggle, layoutGroup }: { onNavigate?: () => void; collapsed?: boolean; onToggle?: () => void; layoutGroup: string }) {
  return (
    <div className="flex h-full flex-col">
      <div className={cn('flex h-16 items-center justify-between px-4', collapsed && 'justify-center px-2')}>
        <Logo withText={!collapsed} />
        {onToggle && !collapsed && (
          <Button variant="ghost" size="icon-sm" onClick={onToggle} aria-label="Collapse sidebar" className="text-muted-foreground">
            <ChevronsLeft />
          </Button>
        )}
      </div>
      <div className={cn('px-3', collapsed && 'px-2')}>
        <WorkspaceSwitcher collapsed={collapsed} />
      </div>
      <SidebarNav onNavigate={onNavigate} collapsed={collapsed} layoutGroup={layoutGroup} />
      {onToggle && collapsed && (
        <div className="flex justify-center pb-4">
          <Button variant="ghost" size="icon-sm" onClick={onToggle} aria-label="Expand sidebar" className="text-muted-foreground">
            <ChevronsRight />
          </Button>
        </div>
      )}
    </div>
  );
}

/** Global "New" menu: opens the create form on the relevant page (?create=1). */
function QuickCreate() {
  const { can, href } = useWorkspace();
  const router = useRouter();
  if (!can('records:create')) return null;
  const items = [
    { label: 'Customer', path: '/customers', icon: Building2 },
    { label: 'Lead', path: '/leads', icon: Target },
    { label: 'Deal', path: '/deals', icon: CircleDollarSign },
    { label: 'Task', path: '/tasks', icon: ListTodo },
  ];
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button size="sm" className="h-9 gap-1.5 rounded-lg px-3" aria-label="Create new record">
          <Plus /> <span className="hidden sm:inline">New</span>
        </Button>
      </MenuTrigger>
      <MenuContent className="w-52">
        <MenuLabel>Create new</MenuLabel>
        {items.map(({ label, path, icon: Icon }) => (
          <MenuItem key={label} onSelect={() => router.push(`${href(path)}?create=1`)}>
            <Icon /> {label}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
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
          className="flex h-10 w-full max-w-lg items-center gap-2.5 rounded-xl border bg-subtle px-3.5 text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:bg-card"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-left">
            <span className="sm:hidden">Search…</span>
            <span className="hidden sm:inline">Search customers, leads, deals…</span>
          </span>
          <span className="hidden sm:inline">
            <Kbd>Ctrl K</Kbd>
          </span>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-[3px] data-[state=open]:animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border bg-popover shadow-xl data-[state=open]:animate-pop-in">
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
      <button type="button" onClick={onSelect} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent focus-visible:bg-accent">
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
    <div className="flex items-center gap-3 border-b bg-warning-soft px-4 py-2 text-sm font-medium text-warning">
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
  const [collapsed, setCollapsed] = React.useState(false);
  const { workspace } = useWorkspace();
  const pathname = usePathname();

  React.useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1');
    } catch {
      /* storage unavailable */
    }
  }, []);
  const toggle = () =>
    setCollapsed((value) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, value ? '0' : '1');
      } catch {
        /* storage unavailable */
      }
      return !value;
    });

  return (
    <div className="flex min-h-dvh bg-canvas">
      <aside className={cn('sticky top-0 hidden h-dvh shrink-0 border-r bg-sidebar transition-[width] duration-200 ease-out lg:block', collapsed ? 'w-[76px]' : 'w-64')}>
        <SidebarContent collapsed={collapsed} onToggle={toggle} layoutGroup="desktop" />
      </aside>

      <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/45 data-[state=open]:animate-fade-in lg:hidden" />
          <Dialog.Content className="fixed inset-y-0 left-0 z-50 w-72 border-r bg-sidebar shadow-xl data-[state=open]:animate-drawer-in lg:hidden">
            <Dialog.Title className="sr-only">Navigation</Dialog.Title>
            <Dialog.Description className="sr-only">Main navigation menu</Dialog.Description>
            <SidebarContent onNavigate={() => setMobileOpen(false)} layoutGroup="mobile" />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <div className="flex min-w-0 flex-1 flex-col">
        <VerifyEmailBanner />
        <header className="sticky top-0 z-40 flex h-16 items-center gap-2 border-b bg-card/80 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-card/70 sm:gap-3 lg:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation" onClick={() => setMobileOpen(true)}>
            <MenuIcon />
          </Button>
          <div className="min-w-0 flex-1">
            <GlobalSearch />
          </div>
          {workspace.subscriptionStatus !== 'ACTIVE' && <Badge tone="warning">{humanize(workspace.subscriptionStatus)}</Badge>}
          <QuickCreate />
          <ThemeToggle />
          <NotificationBell />
          <UserMenu />
        </header>
        <main id="main" className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <FadeIn key={pathname}>{children}</FadeIn>
        </main>
      </div>
    </div>
  );
}
