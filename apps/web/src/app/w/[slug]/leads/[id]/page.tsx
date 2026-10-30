'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowRightLeft, Pencil, Plus } from 'lucide-react';
import { humanize, type Activity, type Lead, type Note, type Paginated } from '@crm/shared';
import { EmptyState, ErrorState, FullPageLoader, PageHeader } from '@/components/common';
import { PriorityBadge, StatusBadge } from '@/components/labels';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/misc';
import { ActivityFormDialog } from '@/features/activities/activity-form';
import { ACTIVITY_ICONS, NoteComposer } from '@/features/activities/timeline';
import { ConvertLeadDialog, LeadFormDialog } from '@/features/leads/lead-forms';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, formatRelative } from '@/lib/format';
import { useWorkspace, wsKey } from '@/hooks/use-workspace';

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { base, workspaceId, href, can, me, workspace } = useWorkspace();
  const [editOpen, setEditOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);

  const lead = useQuery({ queryKey: wsKey(workspaceId, 'leads', 'detail', id), queryFn: () => api<Lead>(`${base}/leads/${id}`) });
  const notes = useQuery({ queryKey: wsKey(workspaceId, 'notes', 'lead', id), queryFn: () => api<Note[]>(`${base}/notes`, { query: { leadId: id } }) });
  const activities = useQuery({ queryKey: wsKey(workspaceId, 'activities', 'lead', id), queryFn: () => api<Paginated<Activity>>(`${base}/activities`, { query: { leadId: id, pageSize: 50 } }) });

  if (lead.isPending) return <FullPageLoader />;
  if (lead.isError) return <ErrorState error={lead.error} onRetry={() => void lead.refetch()} />;
  const l = lead.data;
  const canEdit = can('records:update_any') || (can('records:update_own') && (l.assignedTo?.id === me.id || l.createdBy?.id === me.id));
  const converted = l.status === 'CONVERTED';

  const details: [string, React.ReactNode][] = [
    ['Company', l.company ?? '—'],
    ['Job title', l.jobTitle ?? '—'],
    ['Email', l.email ? <a href={`mailto:${l.email}`} className="hover:text-primary">{l.email}</a> : '—'],
    ['Phone', l.phone ?? '—'],
    ['Source', humanize(l.source)],
    ['Estimated value', l.estimatedValue !== null ? formatCurrency(l.estimatedValue, workspace.currency) : '—'],
    ['Next follow-up', formatDate(l.nextFollowUpAt)],
    ['Owner', l.assignedTo?.name ?? 'Unassigned'],
    ['Created', formatDate(l.createdAt)],
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Leads', href: href('/leads') }, { label: l.fullName }]}
        title={l.fullName}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge kind="lead" value={l.status} /> <PriorityBadge value={l.priority} />
          </span>
        }
        actions={
          <>
            {can('records:create') && (
              <Button variant="outline" onClick={() => setActivityOpen(true)}>
                <Plus /> Log activity
              </Button>
            )}
            {canEdit && !converted && (
              <>
                <Button variant="outline" onClick={() => setEditOpen(true)}>
                  <Pencil /> Edit
                </Button>
                <Button onClick={() => setConvertOpen(true)}>
                  <ArrowRightLeft /> Convert
                </Button>
              </>
            )}
          </>
        }
      />
      {converted && l.convertedCustomerId && (
        <div className="mb-6 rounded-lg border bg-success-soft px-4 py-3 text-sm text-success">
          Converted {formatRelative(l.convertedAt)}.{' '}
          <Link href={href(`/customers/${l.convertedCustomerId}`)} className="font-medium underline">
            Open customer record
          </Link>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Lead details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              {details.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>
            {l.description && <p className="mt-4 whitespace-pre-line border-t pt-4 text-sm text-muted-foreground">{l.description}</p>}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Notes &amp; activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <NoteComposer link={{ leadId: id }} />
            {notes.isError || activities.isError ? (
              <ErrorState error={notes.error ?? activities.error} />
            ) : (notes.data?.length ?? 0) + (activities.data?.data.length ?? 0) === 0 ? (
              <EmptyState title="Nothing logged yet" description="Add a note or log an activity." />
            ) : (
              <ul className="space-y-4">
                {[
                  ...(notes.data ?? []).map((n) => ({ key: `n-${n.id}`, at: n.createdAt, node: <p className="whitespace-pre-line rounded-lg border bg-muted/30 px-3 py-2 text-sm">{n.body}</p>, by: n.author?.name, icon: null })),
                  ...(activities.data?.data ?? []).map((a) => {
                    const Icon = ACTIVITY_ICONS[a.type];
                    return { key: `a-${a.id}`, at: a.occurredAt, node: <p className="text-sm"><span className="font-medium">{a.subject}</span> <span className="text-muted-foreground">· {humanize(a.type)}</span></p>, by: a.user?.name, icon: <Icon className="h-4 w-4 text-muted-foreground" /> };
                  }),
                ]
                  .sort((a, b) => b.at.localeCompare(a.at))
                  .map((item) => (
                    <li key={item.key} className="flex gap-3">
                      <span className="mt-1 w-4">{item.icon}</span>
                      <div className="flex-1">
                        {item.node}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.by ?? 'Former member'} · {formatRelative(item.at)}
                        </p>
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      <LeadFormDialog open={editOpen} onOpenChange={setEditOpen} lead={l} />
      {convertOpen && <ConvertLeadDialog open onOpenChange={setConvertOpen} lead={l} />}
      <ActivityFormDialog open={activityOpen} onOpenChange={setActivityOpen} link={{ leadId: id, label: l.fullName }} />
    </>
  );
}
