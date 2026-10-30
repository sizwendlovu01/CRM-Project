'use client';

import { humanize } from '@crm/shared';
import { ErrorState, PageHeader } from '@/components/common';
import { Card, Skeleton } from '@/components/ui/misc';
import { CategoryBarChart, ConversionChart, CountTrendChart, PipelineStageChart, RangeControls, RevenueChart, TeamRevenueChart, useAnalytics } from '@/features/analytics/charts';
import { buildKpis, KpiGrid, TeamPerformanceTable } from '@/features/analytics/kpis';
import { useWorkspace } from '@/hooks/use-workspace';

export default function AnalyticsPage() {
  const { workspace } = useWorkspace();
  const analytics = useAnalytics();
  const { query } = analytics;
  const data = query.data;

  return (
    <>
      <PageHeader
        title="Analytics"
        description={`Live business intelligence computed from your CRM records${workspace.role === 'SALES_REPRESENTATIVE' ? ' (scoped to your records)' : ''}. Periods are grouped in UTC.`}
        actions={<RangeControls {...analytics} />}
      />
      {query.isError ? (
        <Card><ErrorState error={query.error} onRetry={() => void query.refetch()} /></Card>
      ) : !data ? (
        <div className="space-y-6">
          <KpiGrid loading />
          <div className="grid gap-6 lg:grid-cols-2">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-80 rounded-xl" />)}</div>
        </div>
      ) : (
        <div className="space-y-6">
          <KpiGrid kpis={buildKpis(data)} />
          <div className="grid gap-6 lg:grid-cols-2">
            <RevenueChart data={data.revenueByPeriod} currency={data.currency} />
            <ConversionChart data={data.leadConversionByPeriod} />
            <PipelineStageChart data={data.pipelineByStage} currency={data.currency} />
            <CountTrendChart title="Customer acquisition" description="New customers per period" data={data.customersByPeriod} name="New customers" />
            <CategoryBarChart title="Leads by status" description="All active leads" data={data.leadsByStatus.map((l) => ({ label: humanize(l.status), count: l.count }))} />
            <CategoryBarChart title="Activities by type" description="Logged in the selected period" data={data.activitiesByType.map((a) => ({ label: humanize(a.type), count: a.count }))} color="var(--chart-2)" />
            <CountTrendChart title="Activity volume" description="Activities logged per period" data={data.activitiesByPeriod} name="Activities" color="var(--chart-1)" />
            {data.teamPerformance && <TeamRevenueChart data={data.teamPerformance} currency={data.currency} />}
          </div>
          <TeamPerformanceTable data={data.teamPerformance} currency={data.currency} />
        </div>
      )}
    </>
  );
}
