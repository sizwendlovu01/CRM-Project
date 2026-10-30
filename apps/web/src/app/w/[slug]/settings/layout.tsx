'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
      <PageHeader title="Settings" description="Manage your profile, workspace, team and plan." />
      <nav aria-label="Settings" className="-mx-4 mb-6 overflow-x-auto border-b px-4 lg:mx-0 lg:px-0">
        <ul className="flex gap-1">
          {tabs.map((tab) => {
            const target = href(tab.path);
            const active = pathname === target;
            return (
              <li key={tab.path}>
                <Link
                  href={target}
                  aria-current={active ? 'page' : undefined}
                  className={cn('inline-flex whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors', active ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}
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
