'use client';

import Link from 'next/link';
import {
  BadgeCheck,
  Building2,
  CircleDollarSign,
  ClipboardCheck,
  Gauge,
  Handshake,
  Lock,
  Percent,
  Scale,
  Target,
  TimerOff,
  UserPlus,
} from 'lucide-react';
import type { AnalyticsOverview } from '@crm/shared';
import { Avatar, Card, CardDescription, CardHeader, CardTitle, IconTile, Skeleton, Table, TBody, TD, TH, THead, TR, type IconTone } from '@/components/ui/misc';
import { NumberTicker, Stagger, StaggerItem } from '@/components/motion';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/hooks/use-workspace';

export interface Kpi {
  label: string;
  value: number;
  format: (n: number) => string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  iconTone: IconTone;
  tone?: 'default' | 'danger' | 'success';
  testId?: string;
}

/** All values come straight from the analytics API (live database aggregates). */
export function buildKpis(data: AnalyticsOverview): Kpi[] {
  const k = data.kpis;
  const money = (v: number) => formatCurrency(v, data.currency);
  return [
    { label: 'Total customers', value: k.totalCustomers, format: formatNumber, hint: `${formatNumber(k.newCustomers)} new in period`, icon: Building2, iconTone: 'green', testId: 'kpi-total-customers' },
    { label: 'New customers', value: k.newCustomers, format: formatNumber, hint: 'Created in period', icon: UserPlus, iconTone: 'green' },
    { label: 'Total leads', value: k.totalLeads, format: formatNumber, hint: `${formatNumber(k.newLeads)} new in period`, icon: Target, iconTone: 'red' },
    { label: 'Qualified leads', value: k.qualifiedLeads, format: formatNumber, hint: 'Currently qualified', icon: BadgeCheck, iconTone: 'red' },
    { label: 'Lead conversion', value: k.leadConversionRate, format: formatPercent, hint: `${k.convertedLeads} converted in period`, icon: Percent, iconTone: 'primary' },
    { label: 'Active deals', value: k.activeDeals, format: formatNumber, hint: 'Open opportunities', icon: Handshake, iconTone: 'primary', testId: 'kpi-active-deals' },
    { label: 'Pipeline value', value: k.pipelineValue, format: money, hint: 'Open deal value', icon: Gauge, iconTone: 'blue', testId: 'kpi-pipeline-value' },
    { label: 'Weighted pipeline', value: k.weightedPipelineValue, format: money, hint: 'Value × probability', icon: Scale, iconTone: 'blue' },
    { label: 'Closed deals', value: k.closedWonDeals, format: formatNumber, hint: `${k.closedLostDeals} lost · ${formatPercent(k.winRate)} win rate`, icon: CircleDollarSign, iconTone: 'green' },
    { label: 'Revenue', value: k.revenue, format: money, hint: 'Won deals in period', icon: CircleDollarSign, iconTone: 'green', tone: 'success', testId: 'kpi-revenue' },
    { label: 'Completed tasks', value: k.completedTasks, format: formatNumber, hint: `${k.openTasks} still open`, icon: ClipboardCheck, iconTone: 'amber' },
    { label: 'Overdue tasks', value: k.overdueTasks, format: formatNumber, hint: 'Past due and open', icon: TimerOff, iconTone: k.overdueTasks > 0 ? 'red' : 'slate', tone: k.overdueTasks > 0 ? 'danger' : 'default' },
  ];
}

export function KpiGrid({ kpis, loading }: { kpis?: Kpi[]; loading?: boolean }) {
  if (loading || !kpis) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
        {Array.from({ length: 12 }, (_, i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <Skeleton className="mt-4 h-3 w-20" />
            <Skeleton className="mt-2 h-6 w-16" />
          </Card>
        ))}
      </div>
    );
  }
  return (
    <Stagger className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6" role="list" aria-label="Key metrics">
      {kpis.map((kpi) => (
        <StaggerItem key={kpi.label} role="listitem">
          <Card interactive className="h-full p-4" data-testid={kpi.testId}>
            <div className="flex items-start justify-between gap-2">
              <IconTile icon={kpi.icon} tone={kpi.iconTone} />
            </div>
            <p className="mt-3 text-xs font-semibold text-muted-foreground">{kpi.label}</p>
            <NumberTicker
              value={kpi.value}
              format={kpi.format}
              className={cn('mt-0.5 block truncate font-[family-name:var(--font-jakarta)] text-lg font-extrabold tracking-tight sm:text-[22px]', kpi.tone === 'danger' && 'text-destructive', kpi.tone === 'success' && 'text-success')}
            />
            {kpi.hint && <p className="mt-1 text-xs text-muted-foreground">{kpi.hint}</p>}
          </Card>
        </StaggerItem>
      ))}
    </Stagger>
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
