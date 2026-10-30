'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { z } from 'zod';
import { ACTIVITY_TYPES, createActivitySchema, type Activity } from '@crm/shared';
import { EnumOptions } from '@/components/labels';
import { RecordCombobox } from '@/components/pickers';
import { Button } from '@/components/ui/button';
import { Field, fieldA11y, Input, Select, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/overlays';
import { api } from '@/lib/api';
import { toDateTimeInput } from '@/lib/format';
import { useWorkspace, wsKey } from '@/hooks/use-workspace';

type Input = z.input<typeof createActivitySchema>;
type Output = z.output<typeof createActivitySchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-linked record (hides the pickers for that record). */
  link?: { customerId?: string; leadId?: string; dealId?: string; label?: string };
}

export function ActivityFormDialog({ open, onOpenChange, link }: Props) {
  const { base, workspaceId } = useWorkspace();
  const client = useQueryClient();
  const { register, handleSubmit, formState, watch, setValue, reset } = useForm<Input, unknown, Output>({
    resolver: zodResolver(createActivitySchema),
    values: {
      type: 'CALL',
      subject: '',
      description: '',
      occurredAt: toDateTimeInput(new Date().toISOString()),
      durationMinutes: '',
      outcome: '',
      customerId: link?.customerId ?? '',
      leadId: link?.leadId ?? '',
      dealId: link?.dealId ?? '',
    },
  });
  const errors = formState.errors;
  const type = watch('type');

  const save = useMutation({
    mutationFn: (values: Output) => api<Activity>(`${base}/activities`, { method: 'POST', body: values }),
    onSuccess: () => {
      toast.success('Activity recorded');
      void client.invalidateQueries({ queryKey: wsKey(workspaceId) });
      reset();
      onOpenChange(false);
    },
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Log activity"
      description={link?.label ? `For ${link.label}` : 'Record a call, email, meeting, note or follow-up.'}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="activity-form" loading={save.isPending}>
            Save activity
          </Button>
        </>
      }
    >
      <form id="activity-form" noValidate onSubmit={handleSubmit((v) => save.mutate(v))} className="grid gap-4 sm:grid-cols-2">
        <Field label="Type" htmlFor="a-type">
          <Select id="a-type" {...register('type')}>
            <EnumOptions values={ACTIVITY_TYPES} />
          </Select>
        </Field>
        <Field label="When" htmlFor="a-occurredAt" error={errors.occurredAt?.message}>
          <Input type="datetime-local" {...fieldA11y('a-occurredAt', errors.occurredAt?.message)} {...register('occurredAt')} />
        </Field>
        <Field label="Subject" htmlFor="a-subject" error={errors.subject?.message} required className="sm:col-span-2">
          <Input {...fieldA11y('a-subject', errors.subject?.message)} {...register('subject')} />
        </Field>
        <Field label="Details" htmlFor="a-description" error={errors.description?.message} className="sm:col-span-2">
          <Textarea {...fieldA11y('a-description', errors.description?.message)} {...register('description')} />
        </Field>
        {(type === 'CALL' || type === 'MEETING') && (
          <Field label="Duration (minutes)" htmlFor="a-duration" error={errors.durationMinutes?.message}>
            <Input type="number" min={0} max={1440} {...fieldA11y('a-duration', errors.durationMinutes?.message)} {...register('durationMinutes')} />
          </Field>
        )}
        <Field label="Outcome" htmlFor="a-outcome" error={errors.outcome?.message}>
          <Input placeholder="e.g. Connected, demo booked" {...fieldA11y('a-outcome', errors.outcome?.message)} {...register('outcome')} />
        </Field>
        {!link && (
          <>
            <Field label="Customer" htmlFor="a-customer" error={errors.customerId?.message}>
              <RecordCombobox kind="customers" id="a-customer" value={watch('customerId') as string} onChange={(v) => setValue('customerId', v ?? '', { shouldValidate: true })} invalid={Boolean(errors.customerId)} />
            </Field>
            <Field label="Deal" htmlFor="a-deal">
              <RecordCombobox kind="deals" id="a-deal" value={watch('dealId') as string} onChange={(v) => setValue('dealId', v ?? '')} />
            </Field>
          </>
        )}
      </form>
    </Modal>
  );
}
