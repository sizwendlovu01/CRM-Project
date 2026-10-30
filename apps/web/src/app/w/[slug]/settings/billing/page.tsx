'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { humanize, PLAN_DEFINITIONS, PLANS, USAGE_METRICS, type Plan, type UsageSummary } from '@crm/shared';
import { ErrorState, TableSkeleton } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/misc';
import { ConfirmDialog } from '@/components/ui/overlays';
import { api } from '@/lib/api';
import { formatDate, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ME_KEY } from '@/hooks/use-auth';
import { useWorkspace, wsKey } from '@/hooks/use-workspace';

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const pct = limit === null ? 0 : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  const tone = pct >= 100 ? 'bg-destructive' : pct >= 80 ? 'bg-warning' : 'bg-primary';
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {formatNumber(used)} / {limit === null ? 'Unlimited' : formatNumber(limit)}
          {pct >= 100 && <span className="ml-2 font-medium text-destructive">Limit reached</span>}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`${label} usage`} aria-valuemin={0} aria-valuemax={limit ?? used} aria-valuenow={used}>
        <div className={cn('h-full rounded-full transition-all', limit === null ? 'w-0' : tone)} style={limit === null ? undefined : { width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function BillingPage() {
  const { base, workspaceId, can } = useWorkspace();
  const client = useQueryClient();
  const [target, setTarget] = useState<Plan | null>(null);
  const summary = useQuery({ queryKey: wsKey(workspaceId, 'subscription'), queryFn: () => api<UsageSummary>(`${base}/subscription`) });
  const change = useMutation({
    mutationFn: (plan: Plan) => api<UsageSummary>(`${base}/subscription/change-plan`, { method: 'POST', body: { plan } }),
    onSuccess: (s) => {
      toast.success(`Switched to the ${PLAN_DEFINITIONS[s.plan].name} plan (simulated - no charge)`);
      setTarget(null);
      void client.invalidateQueries({ queryKey: wsKey(workspaceId) });
      void client.invalidateQueries({ queryKey: ME_KEY });
    },
  });

  if (summary.isPending) return <TableSkeleton />;
  if (summary.isError) return <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />;
  const s = summary.data;
  const current = PLAN_DEFINITIONS[s.plan];

  return (
    <div className="space-y-6">
      <div role="note" className="flex gap-3 rounded-lg border bg-info-soft px-4 py-3 text-sm text-info">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>Billing in this edition is <strong>simulated</strong>. Changing plans takes effect immediately for evaluation and never collects payment details or charges you.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Current plan</CardDescription>
            <CardTitle className="text-2xl">{current.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="flex items-center gap-2">Status <Badge tone={s.subscriptionStatus === 'ACTIVE' ? 'success' : 'warning'}>{humanize(s.subscriptionStatus)}</Badge></p>
            <p className="text-muted-foreground">{s.currentPeriodEnd ? `Simulated period renews ${formatDate(s.currentPeriodEnd)}` : 'Free forever'}</p>
            <p className="text-muted-foreground">List price ${current.monthlyPriceUsd}/month (not charged)</p>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Workspace usage</CardTitle>
            <CardDescription>Counted live from your workspace. Members include pending invitations.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            {USAGE_METRICS.map((metric) => (
              <UsageBar key={metric} label={humanize(metric)} used={s.usage[metric].used} limit={s.usage[metric].limit} />
            ))}
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-base font-semibold">Compare plans</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((id) => {
            const plan = PLAN_DEFINITIONS[id];
            const isCurrent = id === s.plan;
            return (
              <Card key={id} className={cn('flex flex-col p-5', isCurrent && 'ring-2 ring-primary')}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{plan.name}</h3>
                  {isCurrent && <Badge tone="primary">Current</Badge>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                <p className="mt-3 text-2xl font-semibold">${plan.monthlyPriceUsd}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                <ul className="mt-4 flex-1 space-y-2 text-sm">
                  {plan.highlights.map((h) => <li key={h} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />{h}</li>)}
                </ul>
                {can('billing:manage') ? (
                  <Button className="mt-5" variant={isCurrent ? 'outline' : 'default'} disabled={isCurrent} onClick={() => setTarget(id)}>
                    {isCurrent ? 'Current plan' : PLANS.indexOf(id) > PLANS.indexOf(s.plan) ? `Upgrade to ${plan.name}` : `Switch to ${plan.name}`}
                  </Button>
                ) : (
                  <p className="mt-5 text-xs text-muted-foreground">Only the workspace owner can change plans.</p>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(target)}
        onOpenChange={(o) => !o && setTarget(null)}
        title={target ? `Switch to ${PLAN_DEFINITIONS[target].name}?` : ''}
        description="This is a simulated plan change for evaluation. No payment is taken. Downgrades are blocked if current usage exceeds the new plan's limits."
        destructive={false}
        confirmLabel="Confirm plan change"
        loading={change.isPending}
        onConfirm={() => target && change.mutate(target)}
      />
    </div>
  );
}
