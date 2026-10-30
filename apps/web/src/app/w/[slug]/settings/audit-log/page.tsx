'use client';

import { useState } from 'react';
import Link from 'next/link';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ScrollText } from 'lucide-react';
import type { AuditLogEntry, Paginated } from '@crm/shared';
import { EmptyState, ErrorState, Pagination, TableSkeleton } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { Card, Table, TBody, TD, TH, THead, TR } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useWorkspace, wsKey } from '@/hooks/use-workspace';

const ENTITY_TYPES = ['customer', 'lead', 'deal', 'task', 'pipeline', 'stage', 'membership', 'invitation', 'workspace'];

export default function AuditLogPage() {
  const { base, workspaceId, hasFeature, can, href } = useWorkspace();
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState('');
  const enabled = hasFeature('audit_log') && can('audit:read');
  const data = useQuery({
    queryKey: wsKey(workspaceId, 'audit', page, entityType),
    queryFn: () => api<Paginated<AuditLogEntry>>(`${base}/audit-logs`, { query: { page, entityType: entityType || undefined } }),
    enabled,
    placeholderData: keepPreviousData,
  });

  if (!enabled) {
    return (
      <Card>
        <EmptyState
          icon={ScrollText}
          title="Audit log is an Enterprise feature"
          description="Every administrative action is already being recorded. Upgrade to Enterprise to review the full history."
          action={can('billing:read') ? <Button asChild><Link href={href('/settings/billing')}>View plans</Link></Button> : undefined}
        />
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-2 border-b p-3">
        <p className="text-sm text-muted-foreground">Security-relevant and administrative actions in this workspace.</p>
        <Select aria-label="Filter by entity" value={entityType} onChange={(e) => { setEntityType(e.target.value); setPage(1); }} className="w-44">
          <option value="">All entities</option>
          {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
      </div>
      {data.isPending ? (
        <TableSkeleton />
      ) : data.isError ? (
        <ErrorState error={data.error} onRetry={() => void data.refetch()} />
      ) : data.data.data.length === 0 ? (
        <EmptyState icon={ScrollText} title="No audit events" />
      ) : (
        <>
          <Table aria-label="Audit log">
            <THead>
              <tr>
                <TH>When</TH>
                <TH>Actor</TH>
                <TH>Action</TH>
                <TH className="hidden md:table-cell">Details</TH>
                <TH className="hidden lg:table-cell">IP</TH>
              </tr>
            </THead>
            <TBody>
              {data.data.data.map((e) => (
                <TR key={e.id}>
                  <TD className="whitespace-nowrap text-muted-foreground">{formatDateTime(e.createdAt)}</TD>
                  <TD>{e.actor?.name ?? 'System'}</TD>
                  <TD><code className="rounded bg-muted px-1.5 py-0.5 text-xs">{e.action}</code></TD>
                  <TD className="hidden max-w-md truncate text-xs text-muted-foreground md:table-cell">{e.metadata ? JSON.stringify(e.metadata) : '—'}</TD>
                  <TD className="hidden text-xs text-muted-foreground lg:table-cell">{e.ipAddress ?? '—'}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <Pagination meta={data.data.meta} onPageChange={setPage} />
        </>
      )}
    </Card>
  );
}
