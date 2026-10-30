'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings } from 'lucide-react';
import { PageHeader } from '@/components/common';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/hooks/use-workspace';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { href, can, hasFeature } = useWorkspace();
  const tabs = [
    { path: '/settings/profile', label: 'Profile' },
    { path: '/settings/workspace', label: 'Workspace' },
    { path: '/settings/team', label: 'Team' },
    { path: '/settings/billing', label: 'Plan & usage' },
    { path: '/settings/notifications', label: 'Notifications' },
    ...(can('audit:read') ? [{ path: '/settings/audit-log', label: hasFeature('audit_log') ? 'Audit log' : 'Audit log (Enterprise)' }] : []),
  ];
  return (
    <>
      <PageHeader title="Settings" icon={Settings} iconTone="slate" description="Manage your profile, workspace, team and plan." />
      <nav aria-label="Settings" className="-mx-4 mb-6 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        <ul className="inline-flex gap-1 rounded-xl border bg-card p-1 shadow-xs">
          {tabs.map((tab) => {
            const target = href(tab.path);
            const active = pathname === target;
            return (
              <li key={tab.path}>
                <Link
                  href={target}
                  aria-current={active ? 'page' : undefined}
                  className={cn('inline-flex whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors duration-150', active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}
                >
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {children}
    </>
  );
}
