'use client';

import Link from 'next/link';
import { Lock } from 'lucide-react';
import type { AnalyticsOverview } from '@crm/shared';
import { Avatar, Card, CardDescription, CardHeader, CardTitle, Skeleton, Table, TBody, TD, TH, THead, TR } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/hooks/use-workspace';

export interface Kpi {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'danger' | 'success';
  testId?: string;
}

export function buildKpis(data: AnalyticsOverview): Kpi[] {
  const k = data.kpis;
  const money = (v: number) => formatCurrency(v, data.currency);
  return [
    { label: 'Total customers', value: formatNumber(k.totalCustomers), hint: `${formatNumber(k.newCustomers)} new in period`, testId: 'kpi-total-customers' },
    { label: 'New customers', value: formatNumber(k.newCustomers), hint: 'Created in period' },
    { label: 'Total leads', value: formatNumber(k.totalLeads), hint: `${formatNumber(k.newLeads)} new in period` },
    { label: 'Qualified leads', value: formatNumber(k.qualifiedLeads), hint: 'Currently qualified' },
    { label: 'Lead conversion', value: formatPercent(k.leadConversionRate), hint: `${k.convertedLeads} converted in period` },
    { label: 'Active deals', value: formatNumber(k.activeDeals), hint: 'Open opportunities', testId: 'kpi-active-deals' },
    { label: 'Pipeline value', value: money(k.pipelineValue), hint: 'Open deal value', testId: 'kpi-pipeline-value' },
    { label: 'Weighted pipeline', value: money(k.weightedPipelineValue), hint: 'Value × probability' },
    { label: 'Closed deals', value: formatNumber(k.closedWonDeals), hint: `${k.closedLostDeals} lost · ${formatPercent(k.winRate)} win rate` },
    { label: 'Revenue', value: money(k.revenue), hint: 'Won deals in period', tone: 'success', testId: 'kpi-revenue' },
    { label: 'Completed tasks', value: formatNumber(k.completedTasks), hint: `${k.openTasks} still open` },
    { label: 'Overdue tasks', value: formatNumber(k.overdueTasks), hint: 'Past due and open', tone: k.overdueTasks > 0 ? 'danger' : 'default' },
  ];
}

export function KpiGrid({ kpis, loading }: { kpis?: Kpi[]; loading?: boolean }) {
  if (loading || !kpis) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        {Array.from({ length: 12 }, (_, i) => (
          <Card key={i} className="p-4"><Skeleton className="h-3 w-20" /><Skeleton className="mt-3 h-6 w-16" /><Skeleton className="mt-2 h-3 w-24" /></Card>
        ))}
      </div>
    );
  }
  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
      {kpis.map((kpi) => (
        <Card key={kpi.label} className="p-4" data-testid={kpi.testId}>
          <dt className="text-xs font-medium text-muted-foreground">{kpi.label}</dt>
          <dd className={cn('mt-1.5 text-xl font-semibold tracking-tight', kpi.tone === 'danger' && 'text-destructive', kpi.tone === 'success' && 'text-success')}>{kpi.value}</dd>
          {kpi.hint && <dd className="mt-0.5 text-xs text-muted-foreground">{kpi.hint}</dd>}
        </Card>
      ))}
    </dl>
  );
}

export function TeamPerformanceTable({ data, currency }: { data: AnalyticsOverview['teamPerformance']; currency: string }) {
  const { href, can } = useWorkspace();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sales representative performance</CardTitle>
        <CardDescription>Closed revenue, pipeline and activity per team member for the selected period</CardDescription>
      </CardHeader>
      {data === null ? (
        <div className="flex flex-col items-center gap-2 px-6 pb-8 text-center">
          <Lock className="h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {can('analytics:team') ? 'Team performance is available on the Growth plan and above.' : 'Team performance is visible to managers and administrators.'}
          </p>
          {can('billing:read') && can('analytics:team') && <Button size="sm" variant="outline" asChild><Link href={href('/settings/billing')}>View plans</Link></Button>}
        </div>
      ) : (
        <Table aria-label="Team performance">
          <THead>
            <tr>
              <TH>Member</TH>
              <TH className="text-right">Deals won</TH>
              <TH className="text-right">Revenue</TH>
              <TH className="hidden text-right sm:table-cell">Open pipeline</TH>
              <TH className="hidden text-right md:table-cell">Activities</TH>
              <TH className="hidden text-right md:table-cell">Tasks done</TH>
              <TH className="hidden text-right lg:table-cell">Leads converted</TH>
            </tr>
          </THead>
          <TBody>
            {data.map((row) => (
              <TR key={row.user.id}>
                <TD><span className="flex items-center gap-2"><Avatar name={row.user.name} size="sm" /> {row.user.name}</span></TD>
                <TD className="text-right">{row.dealsWon}</TD>
                <TD className="text-right font-medium">{formatCurrency(row.revenue, currency)}</TD>
                <TD className="hidden text-right sm:table-cell">{formatCurrency(row.openPipeline, currency)}</TD>
                <TD className="hidden text-right md:table-cell">{row.activities}</TD>
                <TD className="hidden text-right md:table-cell">{row.tasksCompleted}</TD>
                <TD className="hidden text-right lg:table-cell">{row.leadsConverted}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  );
}
