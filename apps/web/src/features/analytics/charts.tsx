'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import { BarChart3, Table2 } from 'lucide-react';
import type { AnalyticsOverview } from '@crm/shared';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { formatCurrency, formatNumber } from '@/lib/format';
import { useWorkspace, wsKey } from '@/hooks/use-workspace';

/* ------------------------------ Date range ------------------------------ */

export const RANGE_PRESETS = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last 12 months' },
  { value: 'custom', label: 'Custom range' },
] as const;

export function useAnalytics() {
  const { base, workspaceId } = useWorkspace();
  const [preset, setPreset] = useState<string>('30');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const range =
    preset === 'custom'
      ? { from: custom.from || undefined, to: custom.to ? `${custom.to}T23:59:59.999Z` : undefined }
      : { from: new Date(Date.now() - Number(preset) * 86_400_000).toISOString().slice(0, 10), to: undefined };
  const query = useQuery({
    queryKey: wsKey(workspaceId, 'analytics', preset, range.from, range.to),
    queryFn: () => api<AnalyticsOverview>(`${base}/analytics/overview`, { query: range }),
    enabled: preset !== 'custom' || Boolean(custom.from && custom.to),
    refetchInterval: 5 * 60_000,
  });
  return { preset, setPreset, custom, setCustom, query };
}

export function RangeControls({ preset, setPreset, custom, setCustom }: Pick<ReturnType<typeof useAnalytics>, 'preset' | 'setPreset' | 'custom' | 'setCustom'>) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select aria-label="Date range" value={preset} onChange={(e) => setPreset(e.target.value)} className="w-40">
        {RANGE_PRESETS.map((p) => (
          <option key={p.value} value={p.value}>{p.label}</option>
        ))}
      </Select>
      {preset === 'custom' && (
        <>
          <Input type="date" aria-label="From date" value={custom.from} max={custom.to || undefined} onChange={(e) => setCustom({ ...custom, from: e.target.value })} className="w-40" />
          <Input type="date" aria-label="To date" value={custom.to} min={custom.from || undefined} onChange={(e) => setCustom({ ...custom, to: e.target.value })} className="w-40" />
        </>
      )}
    </div>
  );
}

/* ------------------------------- Chart shell ------------------------------- */

const AXIS = { stroke: 'var(--muted-foreground)', fontSize: 11, tickLine: false, axisLine: false } as const;

export function shortPeriod(period: string): string {
  const date = new Date(`${period}T00:00:00Z`);
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date);
}

function ChartTooltip({ active, payload, label, valueFormatter }: Partial<TooltipContentProps<number, string>> & { valueFormatter: (v: number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-foreground">{typeof label === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(label) ? shortPeriod(label) : label}</p>
      {payload.map((item) => (
        <p key={String(item.dataKey)} className="flex items-center gap-2 text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ background: item.color }} aria-hidden />
          {item.name}: <span className="font-medium text-foreground">{valueFormatter(Number(item.value))}</span>
        </p>
      ))}
    </div>
  );
}

interface TableColumn<T> {
  key: keyof T;
  label: string;
  format?: (value: unknown) => string;
}

/** Card with a chart and an accessible table alternative. */
export function ChartCard<T extends object>({ title, description, rows, columns, height = 260, children, empty }: { title: string; description?: string; rows: T[]; columns: TableColumn<T>[]; height?: number; children: React.ReactNode; empty?: boolean }) {
  const [table, setTable] = useState(false);
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        <Button variant="ghost" size="icon-sm" onClick={() => setTable((t) => !t)} aria-pressed={table} aria-label={table ? `Show ${title} as chart` : `Show ${title} as table`}>
          {table ? <BarChart3 /> : <Table2 />}
        </Button>
      </CardHeader>
      <div className="px-3 pb-4">
        {empty ? (
          <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height }}>No data for this period</div>
        ) : table ? (
          <div className="max-h-[260px] overflow-auto px-2">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>{columns.map((c) => <th key={String(c.key)} className="py-1.5 pr-3 font-medium">{c.label}</th>)}</tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row, i) => (
                  <tr key={i}>{columns.map((c) => <td key={String(c.key)} className="py-1.5 pr-3">{c.format ? c.format(row[c.key]) : String(row[c.key] as unknown)}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ height }} role="img" aria-label={`${title} chart. Use the table toggle for exact values.`}>
            <ResponsiveContainer width="100%" height="100%">{children as React.ReactElement}</ResponsiveContainer>
          </div>
        )}
      </div>
    </Card>
  );
}

/* --------------------------------- Charts --------------------------------- */

export function RevenueChart({ data, currency }: { data: AnalyticsOverview['revenueByPeriod']; currency: string }) {
  const money = (v: number) => formatCurrency(v, currency);
  return (
    <ChartCard title="Revenue from closed deals" description="Won deal value by close date" rows={data} columns={[{ key: 'period', label: 'Period', format: (v) => shortPeriod(String(v)) }, { key: 'value', label: 'Revenue', format: (v) => money(Number(v)) }]} empty={data.every((d) => d.value === 0)}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
        <XAxis dataKey="period" tickFormatter={shortPeriod} minTickGap={24} {...AXIS} />
        <YAxis tickFormatter={(v: number) => formatCurrency(v, currency, { compact: true })} width={56} {...AXIS} />
        <Tooltip content={<ChartTooltip valueFormatter={money} />} cursor={{ stroke: 'var(--border)' }} />
        <Area type="monotone" dataKey="value" name="Revenue" stroke="var(--chart-1)" strokeWidth={2} fill="url(#revenueFill)" activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--card)' }} />
      </AreaChart>
    </ChartCard>
  );
}

export function CountTrendChart({ title, description, data, name, color = 'var(--chart-2)' }: { title: string; description: string; data: AnalyticsOverview['customersByPeriod']; name: string; color?: string }) {
  return (
    <ChartCard title={title} description={description} rows={data} columns={[{ key: 'period', label: 'Period', format: (v) => shortPeriod(String(v)) }, { key: 'value', label: name }]} empty={data.every((d) => d.value === 0)}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
        <XAxis dataKey="period" tickFormatter={shortPeriod} minTickGap={24} {...AXIS} />
        <YAxis allowDecimals={false} width={32} {...AXIS} />
        <Tooltip content={<ChartTooltip valueFormatter={formatNumber} />} cursor={{ fill: 'var(--muted)' }} />
        <Bar dataKey="value" name={name} fill={color} radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ChartCard>
  );
}

export function PipelineStageChart({ data, currency }: { data: AnalyticsOverview['pipelineByStage']; currency: string }) {
  const money = (v: number) => formatCurrency(v, currency);
  return (
    <ChartCard
      title="Pipeline by stage"
      description="Total and probability-weighted value (default pipeline)"
      rows={data}
      columns={[{ key: 'stage', label: 'Stage' }, { key: 'count', label: 'Deals' }, { key: 'value', label: 'Value', format: (v) => money(Number(v)) }, { key: 'weightedValue', label: 'Weighted', format: (v) => money(Number(v)) }]}
      empty={data.every((d) => d.count === 0)}
    >
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2}>
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
        <XAxis dataKey="stage" interval={0} tick={{ fontSize: 11 }} {...AXIS} />
        <YAxis tickFormatter={(v: number) => formatCurrency(v, currency, { compact: true })} width={56} {...AXIS} />
        <Tooltip content={<ChartTooltip valueFormatter={money} />} cursor={{ fill: 'var(--muted)' }} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: 'var(--muted-foreground)' }} />
        <Bar dataKey="value" name="Total value" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={32} />
        <Bar dataKey="weightedValue" name="Weighted value" fill="var(--chart-2)" radius={[4, 4, 0, 0]} maxBarSize={32} />
      </BarChart>
    </ChartCard>
  );
}

export function ConversionChart({ data }: { data: AnalyticsOverview['leadConversionByPeriod'] }) {
  return (
    <ChartCard
      title="Lead conversion"
      description="Leads created vs. converted"
      rows={data}
      columns={[{ key: 'period', label: 'Period', format: (v) => shortPeriod(String(v)) }, { key: 'created', label: 'Created' }, { key: 'converted', label: 'Converted' }]}
      empty={data.every((d) => d.created === 0 && d.converted === 0)}
    >
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
        <XAxis dataKey="period" tickFormatter={shortPeriod} minTickGap={24} {...AXIS} />
        <YAxis allowDecimals={false} width={32} {...AXIS} />
        <Tooltip content={<ChartTooltip valueFormatter={formatNumber} />} cursor={{ stroke: 'var(--border)' }} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: 'var(--muted-foreground)' }} />
        <Line type="monotone" dataKey="created" name="Created" stroke="var(--chart-1)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        <Line type="monotone" dataKey="converted" name="Converted" stroke="var(--chart-3)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
      </LineChart>
    </ChartCard>
  );
}

/** Horizontal bars for categorical breakdowns (better than pies for comparing magnitudes). */
export function CategoryBarChart({ title, description, data, color = 'var(--chart-1)' }: { title: string; description: string; data: { label: string; count: number }[]; color?: string }) {
  return (
    <ChartCard title={title} description={description} rows={data} columns={[{ key: 'label', label: 'Category' }, { key: 'count', label: 'Count' }]} empty={data.every((d) => d.count === 0)} height={Math.max(160, data.length * 40)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 0 }}>
        <CartesianGrid horizontal={false} stroke="var(--chart-grid)" />
        <XAxis type="number" allowDecimals={false} {...AXIS} />
        <YAxis type="category" dataKey="label" width={96} {...AXIS} />
        <Tooltip content={<ChartTooltip valueFormatter={formatNumber} />} cursor={{ fill: 'var(--muted)' }} />
        <Bar dataKey="count" name="Count" fill={color} radius={[0, 4, 4, 0]} maxBarSize={22} label={{ position: 'right', fontSize: 11, fill: 'var(--muted-foreground)' }} />
      </BarChart>
    </ChartCard>
  );
}

export function TeamRevenueChart({ data, currency }: { data: NonNullable<AnalyticsOverview['teamPerformance']>; currency: string }) {
  const money = (v: number) => formatCurrency(v, currency);
  const rows = data.map((r) => ({ name: r.user.name, revenue: r.revenue, openPipeline: r.openPipeline }));
  return (
    <ChartCard title="Team comparison" description="Closed revenue and open pipeline per member" rows={rows} columns={[{ key: 'name', label: 'Member' }, { key: 'revenue', label: 'Revenue', format: (v) => money(Number(v)) }, { key: 'openPipeline', label: 'Open pipeline', format: (v) => money(Number(v)) }]} empty={rows.every((r) => r.revenue === 0 && r.openPipeline === 0)}>
      <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2}>
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
        <XAxis dataKey="name" interval={0} tick={{ fontSize: 11 }} {...AXIS} />
        <YAxis tickFormatter={(v: number) => formatCurrency(v, currency, { compact: true })} width={56} {...AXIS} />
        <Tooltip content={<ChartTooltip valueFormatter={money} />} cursor={{ fill: 'var(--muted)' }} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: 'var(--muted-foreground)' }} />
        <Bar dataKey="revenue" name="Revenue" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={32} />
        <Bar dataKey="openPipeline" name="Open pipeline" fill="var(--chart-2)" radius={[4, 4, 0, 0]} maxBarSize={32} />
      </BarChart>
    </ChartCard>
  );
}
