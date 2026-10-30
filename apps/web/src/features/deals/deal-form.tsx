'use client';

import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { z } from 'zod';
import { createDealSchema, type Deal, type Pipeline } from '@crm/shared';
import { MemberSelect, RecordCombobox } from '@/components/pickers';
import { Button } from '@/components/ui/button';
import { Field, fieldA11y, Input, Select, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/overlays';
import { api } from '@/lib/api';
import { toDateInput } from '@/lib/format';
import { useWorkspace, wsKey } from '@/hooks/use-workspace';

type Input = z.input<typeof createDealSchema>;
type Output = z.output<typeof createDealSchema>;

export function usePipelines() {
  const { base, workspaceId } = useWorkspace();
  return useQuery({ queryKey: wsKey(workspaceId, 'pipelines'), queryFn: () => api<Pipeline[]>(`${base}/pipelines`) });
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal?: Deal;
  defaults?: { pipelineId?: string; stageId?: string; customerId?: string; customerLabel?: string };
}

export function DealFormDialog({ open, onOpenChange, deal, defaults }: Props) {
  const { base, workspaceId, me, workspace } = useWorkspace();
  const client = useQueryClient();
  const pipelines = usePipelines();
  const editing = Boolean(deal);
  const firstPipeline = pipelines.data?.[0];

  const { register, handleSubmit, formState, watch, setValue } = useForm<Input, unknown, Output>({
    resolver: zodResolver(createDealSchema),
    values: {
      title: deal?.title ?? '',
      value: deal?.value ?? '',
      pipelineId: deal?.pipelineId ?? defaults?.pipelineId ?? firstPipeline?.id ?? '',
      stageId: deal?.stageId ?? defaults?.stageId ?? firstPipeline?.stages.find((s) => s.type === 'OPEN')?.id ?? '',
      customerId: deal?.customer?.id ?? defaults?.customerId ?? '',
      assignedToId: deal ? (deal.assignedTo?.id ?? '') : me.id,
      expectedCloseDate: toDateInput(deal?.expectedCloseDate),
      probability: deal?.probability ?? '',
      description: deal?.description ?? '',
      lostReason: deal?.lostReason ?? '',
    },
  });
  const errors = formState.errors;
  const pipelineId = watch('pipelineId') as string;
  const stageId = watch('stageId') as string;
  const stages = useMemo(() => pipelines.data?.find((p) => p.id === pipelineId)?.stages ?? [], [pipelines.data, pipelineId]);

  // Keep the stage valid when the pipeline changes.
  useEffect(() => {
    if (!editing && stages.length && !stages.some((s) => s.id === stageId)) setValue('stageId', stages[0]!.id);
  }, [editing, stages, stageId, setValue]);

  const save = useMutation({
    mutationFn: (values: Output) => {
      if (!editing) return api<Deal>(`${base}/deals`, { method: 'POST', body: values });
      const { pipelineId: _p, stageId: _s, ...rest } = values;
      return api<Deal>(`${base}/deals/${deal!.id}`, { method: 'PATCH', body: rest });
    },
    onSuccess: () => {
      toast.success(editing ? 'Deal updated' : 'Deal created');
      void client.invalidateQueries({ queryKey: wsKey(workspaceId) });
      onOpenChange(false);
    },
  });

  const selectedStage = stages.find((s) => s.id === stageId);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Edit deal' : 'New deal'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="deal-form" loading={save.isPending}>
            {editing ? 'Save changes' : 'Create deal'}
          </Button>
        </>
      }
    >
      <form id="deal-form" noValidate onSubmit={handleSubmit((v) => save.mutate(v))} className="grid gap-4 sm:grid-cols-2">
        <Field label="Deal title" htmlFor="d-title" error={errors.title?.message} required className="sm:col-span-2">
          <Input {...fieldA11y('d-title', errors.title?.message)} {...register('title')} />
        </Field>
        <Field label={`Value (${workspace.currency})`} htmlFor="d-value" error={errors.value?.message} required>
          <Input type="number" min={0} step="0.01" inputMode="decimal" {...fieldA11y('d-value', errors.value?.message)} {...register('value')} />
        </Field>
        <Field label="Expected close date" htmlFor="d-close" error={errors.expectedCloseDate?.message}>
          <Input type="date" {...fieldA11y('d-close', errors.expectedCloseDate?.message)} {...register('expectedCloseDate')} />
        </Field>
        {!editing && (
          <>
            <Field label="Pipeline" htmlFor="d-pipeline" error={errors.pipelineId?.message}>
              <Select id="d-pipeline" {...register('pipelineId')}>
                {pipelines.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Stage" htmlFor="d-stage" error={errors.stageId?.message}>
              <Select id="d-stage" {...register('stageId')}>
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        )}
        <Field label="Probability override (%)" htmlFor="d-probability" error={errors.probability?.message} hint={selectedStage || deal ? `Stage default: ${(selectedStage ?? deal?.stage)?.probability}%` : undefined}>
          <Input type="number" min={0} max={100} {...fieldA11y('d-probability', errors.probability?.message)} {...register('probability')} />
        </Field>
        <Field label="Owner" htmlFor="d-assignee" error={errors.assignedToId?.message}>
          <MemberSelect id="d-assignee" {...register('assignedToId')} />
        </Field>
        <Field label="Customer" htmlFor="d-customer" error={errors.customerId?.message} className="sm:col-span-2">
          <RecordCombobox kind="customers" id="d-customer" value={watch('customerId') as string} selectedLabel={deal?.customer?.fullName ?? defaults?.customerLabel} onChange={(v) => setValue('customerId', v ?? '')} />
        </Field>
        <Field label="Description" htmlFor="d-description" error={errors.description?.message} className="sm:col-span-2">
          <Textarea {...fieldA11y('d-description', errors.description?.message)} {...register('description')} />
        </Field>
        {deal?.status === 'LOST' && (
          <Field label="Lost reason" htmlFor="d-lost" error={errors.lostReason?.message} className="sm:col-span-2">
            <Input {...fieldA11y('d-lost', errors.lostReason?.message)} {...register('lostReason')} />
          </Field>
        )}
      </form>
    </Modal>
  );
}
