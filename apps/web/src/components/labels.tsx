import { humanize, type CustomerStatus, type DealStatus, type LeadStatus, type Priority, type TaskStatus } from '@crm/shared';
import { cn } from '@/lib/utils';
import { StatusPill, type StatusColor } from './ui/misc';

/* Colour language shared across the app: blue = new/open, violet = in conversation,
   amber = in progress, green = positive outcome, red = negative outcome, slate = inactive. */
const CUSTOMER_COLORS: Record<CustomerStatus, StatusColor> = { PROSPECT: 'blue', ACTIVE: 'green', INACTIVE: 'slate', CHURNED: 'red' };
const LEAD_COLORS: Record<LeadStatus, StatusColor> = { NEW: 'blue', CONTACTED: 'violet', QUALIFIED: 'green', UNQUALIFIED: 'slate', CONVERTED: 'teal' };
const DEAL_COLORS: Record<DealStatus, StatusColor> = { OPEN: 'blue', WON: 'green', LOST: 'red' };
const TASK_COLORS: Record<TaskStatus, StatusColor> = { TODO: 'slate', IN_PROGRESS: 'amber', COMPLETED: 'green', CANCELLED: 'slate' };

export function StatusBadge({ kind, value, className }: { kind: 'customer' | 'lead' | 'deal' | 'task'; value: string; className?: string }) {
  const colors: Record<string, StatusColor> =
    kind === 'customer' ? CUSTOMER_COLORS : kind === 'lead' ? LEAD_COLORS : kind === 'deal' ? DEAL_COLORS : TASK_COLORS;
  return (
    <StatusPill color={colors[value] ?? 'slate'} className={className}>
      {humanize(value)}
    </StatusPill>
  );
}

const PRIORITY_STYLES: Record<Priority, { dot: string; text: string; bars: number }> = {
  LOW: { dot: 'bg-status-slate', text: 'text-muted-foreground', bars: 1 },
  MEDIUM: { dot: 'bg-status-blue', text: 'text-info', bars: 2 },
  HIGH: { dot: 'bg-status-amber', text: 'text-warning', bars: 3 },
  URGENT: { dot: 'bg-status-red', text: 'text-destructive', bars: 4 },
};

/** Priority shown with a signal-strength glyph plus text, so it never relies on colour alone. */
export function PriorityBadge({ value }: { value: Priority }) {
  const style = PRIORITY_STYLES[value];
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold', style.text)}>
      <span aria-hidden className="flex h-3 items-end gap-[2px]">
        {[1, 2, 3, 4].map((bar) => (
          <span key={bar} className={cn('w-[3px] rounded-sm', bar <= style.bars ? style.dot : 'bg-border-strong')} style={{ height: `${bar * 3}px` }} />
        ))}
      </span>
      {humanize(value)}
    </span>
  );
}

export function EnumOptions({ values, includeEmpty }: { values: readonly string[]; includeEmpty?: string }) {
  return (
    <>
      {includeEmpty !== undefined && <option value="">{includeEmpty}</option>}
      {values.map((value) => (
        <option key={value} value={value}>
          {humanize(value)}
        </option>
      ))}
    </>
  );
}
