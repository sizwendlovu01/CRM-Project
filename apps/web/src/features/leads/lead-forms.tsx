'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { z } from 'zod';
import {
  convertLeadSchema,
  createLeadSchema,
  CUSTOMER_STATUSES,
  LEAD_STATUSES,
  PRIORITIES,
  RECORD_SOURCES,
  type ConvertLeadResult,
  type Lead,
} from '@crm/shared';
import { EnumOptions } from '@/components/labels';
import { MemberSelect } from '@/components/pickers';
import { Button } from '@/components/ui/button';
import { Field, fieldA11y, Input, Select, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/overlays';
import { api } from '@/lib/api';
import { toDateInput } from '@/lib/format';
import { useWorkspace, wsKey } from '@/hooks/use-workspace';
import { usePipelines } from '../deals/deal-form';

type LeadInput = z.input<typeof createLeadSchema>;
type LeadOutput = z.output<typeof createLeadSchema>;

const EDITABLE_STATUSES = LEAD_STATUSES.filter((s) => s !== 'CONVERTED');
const SOURCES = RECORD_SOURCES.filter((s) => s !== 'LEAD_CONVERSION');

export function LeadFormDialog({ open, onOpenChange, lead }: { open: boolean; onOpenChange: (open: boolean) => void; lead?: Lead }) {
  const { base, workspaceId, me } = useWorkspace();
  const client = useQueryClient();
  const editing = Boolean(lead);
  const { register, handleSubmit, formState } = useForm<LeadInput, unknown, LeadOutput>({
    resolver: zodResolver(createLeadSchema),
    values: {
      fullName: lead?.fullName ?? '',
      company: lead?.company ?? '',
      email: lead?.email ?? '',
      phone: lead?.phone ?? '',
      jobTitle: lead?.jobTitle ?? '',
      source: lead?.source ?? 'WEBSITE',
      status: lead && lead.status !== 'CONVERTED' ? lead.status : 'NEW',
      priority: lead?.priority ?? 'MEDIUM',
      estimatedValue: lead?.estimatedValue ?? '',
      assignedToId: lead ? (lead.assignedTo?.id ?? '') : me.id,
      nextFollowUpAt: toDateInput(lead?.nextFollowUpAt),
      description: lead?.description ?? '',
    },
  });
  const errors = formState.errors;
  const save = useMutation({
    mutationFn: (values: LeadOutput) => (editing ? api<Lead>(`${base}/leads/${lead!.id}`, { method: 'PATCH', body: values }) : api<Lead>(`${base}/leads`, { method: 'POST', body: values })),
    onSuccess: () => {
      toast.success(editing ? 'Lead updated' : 'Lead created');
      void client.invalidateQueries({ queryKey: wsKey(workspaceId, 'leads') });
      onOpenChange(false);
    },
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Edit lead' : 'New lead'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="lead-form" loading={save.isPending}>
            {editing ? 'Save changes' : 'Create lead'}
          </Button>
        </>
      }
    >
      <form id="lead-form" noValidate onSubmit={handleSubmit((v) => save.mutate(v))} className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" htmlFor="l-fullName" error={errors.fullName?.message} required>
          <Input {...fieldA11y('l-fullName', errors.fullName?.message)} {...register('fullName')} />
        </Field>
        <Field label="Job title" htmlFor="l-jobTitle" error={errors.jobTitle?.message}>
          <Input {...fieldA11y('l-jobTitle', errors.jobTitle?.message)} {...register('jobTitle')} />
        </Field>
        <Field label="Company" htmlFor="l-company" error={errors.company?.message}>
          <Input {...fieldA11y('l-company', errors.company?.message)} {...register('company')} />
        </Field>
        <Field label="Estimated value" htmlFor="l-value" error={errors.estimatedValue?.message}>
          <Input type="number" min={0} step="0.01" {...fieldA11y('l-value', errors.estimatedValue?.message)} {...register('estimatedValue')} />
        </Field>
        <Field label="Email" htmlFor="l-email" error={errors.email?.message}>
          <Input type="email" {...fieldA11y('l-email', errors.email?.message)} {...register('email')} />
        </Field>
        <Field label="Phone" htmlFor="l-phone" error={errors.phone?.message}>
          <Input type="tel" {...fieldA11y('l-phone', errors.phone?.message)} {...register('phone')} />
        </Field>
        <Field label="Status" htmlFor="l-status">
          <Select id="l-status" {...register('status')}>
            <EnumOptions values={EDITABLE_STATUSES} />
          </Select>
        </Field>
        <Field label="Priority" htmlFor="l-priority">
          <Select id="l-priority" {...register('priority')}>
            <EnumOptions values={PRIORITIES} />
          </Select>
        </Field>
        <Field label="Source" htmlFor="l-source">
          <Select id="l-source" {...register('source')}>
            <EnumOptions values={SOURCES} />
          </Select>
        </Field>
        <Field label="Next follow-up" htmlFor="l-followup" error={errors.nextFollowUpAt?.message}>
          <Input type="date" {...fieldA11y('l-followup', errors.nextFollowUpAt?.message)} {...register('nextFollowUpAt')} />
        </Field>
        <Field label="Owner" htmlFor="l-assignee" error={errors.assignedToId?.message}>
          <MemberSelect id="l-assignee" {...register('assignedToId')} />
        </Field>
        <Field label="Notes" htmlFor="l-description" error={errors.description?.message} className="sm:col-span-2">
          <Textarea {...fieldA11y('l-description', errors.description?.message)} {...register('description')} />
        </Field>
      </form>
    </Modal>
  );
}

type ConvertInput = z.input<typeof convertLeadSchema>;
type ConvertOutput = z.output<typeof convertLeadSchema>;

export function ConvertLeadDialog({ open, onOpenChange, lead }: { open: boolean; onOpenChange: (open: boolean) => void; lead: Lead }) {
  const { base, workspaceId, href } = useWorkspace();
  const client = useQueryClient();
  const router = useRouter();
  const pipelines = usePipelines();
  const { register, handleSubmit, watch } = useForm<ConvertInput, unknown, ConvertOutput>({
    resolver: zodResolver(convertLeadSchema),
    values: {
      customerStatus: 'ACTIVE',
      createDeal: true,
      dealTitle: `${lead.company ?? lead.fullName} opportunity`,
      dealValue: lead.estimatedValue ?? '',
      pipelineId: pipelines.data?.[0]?.id ?? '',
    },
  });
  const createDeal = watch('createDeal');
  const convert = useMutation({
    mutationFn: (values: ConvertOutput) => api<ConvertLeadResult>(`${base}/leads/${lead.id}/convert`, { method: 'POST', body: values }),
    onSuccess: (result) => {
      toast.success('Lead converted to customer');
      void client.invalidateQueries({ queryKey: wsKey(workspaceId) });
      onOpenChange(false);
      router.push(href(`/customers/${result.customerId}`));
    },
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Convert ${lead.fullName}`}
      description="Creates a customer (or links an existing one with the same email). This cannot be undone."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="convert-form" loading={convert.isPending}>
            Convert lead
          </Button>
        </>
      }
    >
      <form id="convert-form" noValidate onSubmit={handleSubmit((v) => convert.mutate(v))} className="space-y-4">
        <Field label="Customer status" htmlFor="cv-status">
          <Select id="cv-status" {...register('customerStatus')}>
            <EnumOptions values={CUSTOMER_STATUSES} />
          </Select>
        </Field>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" {...register('createDeal')} /> Also create a deal
        </label>
        {createDeal && (
          <div className="grid gap-4 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2">
            <Field label="Deal title" htmlFor="cv-title" className="sm:col-span-2">
              <Input id="cv-title" {...register('dealTitle')} />
            </Field>
            <Field label="Deal value" htmlFor="cv-value">
              <Input id="cv-value" type="number" min={0} step="0.01" {...register('dealValue')} />
            </Field>
            <Field label="Pipeline" htmlFor="cv-pipeline">
              <Select id="cv-pipeline" {...register('pipelineId')}>
                {pipelines.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}
      </form>
    </Modal>
  );
}
