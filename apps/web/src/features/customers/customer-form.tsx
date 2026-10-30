'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { z } from 'zod';
import {
  createCustomerSchema,
  CUSTOMER_STATUSES,
  CUSTOMER_TYPES,
  RECORD_SOURCES,
  type Customer,
} from '@crm/shared';
import { EnumOptions } from '@/components/labels';
import { MemberSelect } from '@/components/pickers';
import { Button } from '@/components/ui/button';
import { Field, fieldA11y, Input, Select, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/overlays';
import { api, ApiError } from '@/lib/api';
import { useWorkspace, wsKey } from '@/hooks/use-workspace';

type Input = z.input<typeof createCustomerSchema>;
type Output = z.output<typeof createCustomerSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer?: Customer;
  onSaved?: (customer: Customer) => void;
}

const SOURCE_OPTIONS = RECORD_SOURCES.filter((s) => s !== 'LEAD_CONVERSION' && s !== 'IMPORT');

export function CustomerFormDialog({ open, onOpenChange, customer, onSaved }: Props) {
  const { base, workspaceId, me } = useWorkspace();
  const client = useQueryClient();
  const editing = Boolean(customer);
  const form = useForm<Input, unknown, Output>({
    resolver: zodResolver(createCustomerSchema),
    values: {
      fullName: customer?.fullName ?? '',
      company: customer?.company ?? '',
      email: customer?.email ?? '',
      phone: customer?.phone ?? '',
      address: customer?.address ?? '',
      industry: customer?.industry ?? '',
      type: customer?.type ?? 'BUSINESS',
      status: customer?.status ?? 'PROSPECT',
      source: customer?.source ?? 'OTHER',
      assignedToId: customer ? (customer.assignedTo?.id ?? '') : me.id,
    },
  });
  const { register, handleSubmit, formState, setError } = form;
  const errors = formState.errors;

  const save = useMutation({
    mutationFn: (values: Output) =>
      editing ? api<Customer>(`${base}/customers/${customer!.id}`, { method: 'PATCH', body: values }) : api<Customer>(`${base}/customers`, { method: 'POST', body: values }),
    meta: { silent: true },
    onSuccess: (saved) => {
      void client.invalidateQueries({ queryKey: wsKey(workspaceId, 'customers') });
      toast.success(editing ? 'Customer updated' : 'Customer created');
      onOpenChange(false);
      onSaved?.(saved);
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        for (const [path, message] of Object.entries(error.fieldErrors())) {
          setError(path as keyof Input, { message: path === 'email' && error.code === 'DUPLICATE_CUSTOMER' ? error.message : message });
        }
      }
      toast.error(error.message);
    },
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Edit customer' : 'New customer'}
      description={editing ? undefined : 'Add a person or business to your CRM.'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="customer-form" loading={save.isPending}>
            {editing ? 'Save changes' : 'Create customer'}
          </Button>
        </>
      }
    >
      <form id="customer-form" noValidate onSubmit={handleSubmit((values) => save.mutate(values))} className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" htmlFor="c-fullName" error={errors.fullName?.message} required className="sm:col-span-2">
          <Input {...fieldA11y('c-fullName', errors.fullName?.message)} {...register('fullName')} />
        </Field>
        <Field label="Company" htmlFor="c-company" error={errors.company?.message}>
          <Input {...fieldA11y('c-company', errors.company?.message)} {...register('company')} />
        </Field>
        <Field label="Industry" htmlFor="c-industry" error={errors.industry?.message}>
          <Input {...fieldA11y('c-industry', errors.industry?.message)} {...register('industry')} />
        </Field>
        <Field label="Email" htmlFor="c-email" error={errors.email?.message}>
          <Input type="email" {...fieldA11y('c-email', errors.email?.message)} {...register('email')} />
        </Field>
        <Field label="Phone" htmlFor="c-phone" error={errors.phone?.message}>
          <Input type="tel" {...fieldA11y('c-phone', errors.phone?.message)} {...register('phone')} />
        </Field>
        <Field label="Address" htmlFor="c-address" error={errors.address?.message} className="sm:col-span-2">
          <Textarea rows={2} {...fieldA11y('c-address', errors.address?.message)} {...register('address')} />
        </Field>
        <Field label="Type" htmlFor="c-type">
          <Select id="c-type" {...register('type')}>
            <EnumOptions values={CUSTOMER_TYPES} />
          </Select>
        </Field>
        <Field label="Status" htmlFor="c-status">
          <Select id="c-status" {...register('status')}>
            <EnumOptions values={CUSTOMER_STATUSES} />
          </Select>
        </Field>
        <Field label="Source" htmlFor="c-source">
          <Select id="c-source" {...register('source')}>
            <EnumOptions values={editing && customer && !SOURCE_OPTIONS.includes(customer.source as never) ? [customer.source, ...SOURCE_OPTIONS] : SOURCE_OPTIONS} />
          </Select>
        </Field>
        <Field label="Assigned representative" htmlFor="c-assignee" error={errors.assignedToId?.message}>
          <MemberSelect id="c-assignee" {...register('assignedToId')} />
        </Field>
      </form>
    </Modal>
  );
}
