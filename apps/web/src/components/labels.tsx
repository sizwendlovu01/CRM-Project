import { humanize, type CustomerStatus, type DealStatus, type LeadStatus, type Priority, type TaskStatus } from '@crm/shared';
import { Badge } from './ui/misc';

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

const CUSTOMER_TONES: Record<CustomerStatus, Tone> = { PROSPECT: 'info', ACTIVE: 'success', INACTIVE: 'neutral', CHURNED: 'danger' };
const LEAD_TONES: Record<LeadStatus, Tone> = { NEW: 'info', CONTACTED: 'primary', QUALIFIED: 'success', UNQUALIFIED: 'neutral', CONVERTED: 'success' };
const DEAL_TONES: Record<DealStatus, Tone> = { OPEN: 'primary', WON: 'success', LOST: 'danger' };
const TASK_TONES: Record<TaskStatus, Tone> = { TODO: 'neutral', IN_PROGRESS: 'info', COMPLETED: 'success', CANCELLED: 'neutral' };
const PRIORITY_TONES: Record<Priority, Tone> = { LOW: 'neutral', MEDIUM: 'info', HIGH: 'warning', URGENT: 'danger' };

export function StatusBadge({ kind, value }: { kind: 'customer' | 'lead' | 'deal' | 'task'; value: string }) {
  const tones: Record<string, Tone> =
    kind === 'customer' ? CUSTOMER_TONES : kind === 'lead' ? LEAD_TONES : kind === 'deal' ? DEAL_TONES : TASK_TONES;
  return <Badge tone={tones[value] ?? 'neutral'}>{humanize(value)}</Badge>;
}

export function PriorityBadge({ value }: { value: Priority }) {
  return (
    <Badge tone={PRIORITY_TONES[value]}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {humanize(value)}
    </Badge>
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
