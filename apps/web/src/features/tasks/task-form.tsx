'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { z } from 'zod';
import { createTaskSchema, PRIORITIES, TASK_STATUSES, type Task } from '@crm/shared';
import { EnumOptions } from '@/components/labels';
import { MemberSelect, RecordCombobox } from '@/components/pickers';
import { Button } from '@/components/ui/button';
import { Field, fieldA11y, Input, Select, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/overlays';
import { api } from '@/lib/api';
import { toDateTimeInput } from '@/lib/format';
import { useWorkspace, wsKey } from '@/hooks/use-workspace';

type Input = z.input<typeof createTaskSchema>;
type Output = z.output<typeof createTaskSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task;
  defaults?: { customerId?: string; customerLabel?: string; dealId?: string; dealLabel?: string; leadId?: string };
}

export function TaskFormDialog({ open, onOpenChange, task, defaults }: Props) {
  const { base, workspaceId, me } = useWorkspace();
  const client = useQueryClient();
  const editing = Boolean(task);
  const { register, handleSubmit, formState, watch, setValue } = useForm<Input, unknown, Output>({
    resolver: zodResolver(createTaskSchema),
    values: {
      title: task?.title ?? '',
      description: task?.description ?? '',
      status: task?.status ?? 'TODO',
      priority: task?.priority ?? 'MEDIUM',
      dueAt: toDateTimeInput(task?.dueAt),
      assignedToId: task ? (task.assignedTo?.id ?? '') : me.id,
      customerId: task?.customer?.id ?? defaults?.customerId ?? '',
      dealId: task?.deal?.id ?? defaults?.dealId ?? '',
      leadId: task?.lead?.id ?? defaults?.leadId ?? '',
    },
  });
  const errors = formState.errors;

  const save = useMutation({
    mutationFn: (values: Output) => (editing ? api<Task>(`${base}/tasks/${task!.id}`, { method: 'PATCH', body: values }) : api<Task>(`${base}/tasks`, { method: 'POST', body: values })),
    onSuccess: () => {
      toast.success(editing ? 'Task updated' : 'Task created');
      void client.invalidateQueries({ queryKey: wsKey(workspaceId) });
      onOpenChange(false);
    },
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Edit task' : 'New task'}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="task-form" loading={save.isPending}>
            {editing ? 'Save changes' : 'Create task'}
          </Button>
        </>
      }
    >
      <form id="task-form" noValidate onSubmit={handleSubmit((v) => save.mutate(v))} className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" htmlFor="t-title" error={errors.title?.message} required className="sm:col-span-2">
          <Input {...fieldA11y('t-title', errors.title?.message)} {...register('title')} />
        </Field>
        <Field label="Description" htmlFor="t-description" error={errors.description?.message} className="sm:col-span-2">
          <Textarea {...fieldA11y('t-description', errors.description?.message)} {...register('description')} />
        </Field>
        <Field label="Due" htmlFor="t-due" error={errors.dueAt?.message}>
          <Input type="datetime-local" {...fieldA11y('t-due', errors.dueAt?.message)} {...register('dueAt')} />
        </Field>
        <Field label="Assignee" htmlFor="t-assignee" error={errors.assignedToId?.message}>
          <MemberSelect id="t-assignee" {...register('assignedToId')} />
        </Field>
        <Field label="Priority" htmlFor="t-priority">
          <Select id="t-priority" {...register('priority')}>
            <EnumOptions values={PRIORITIES} />
          </Select>
        </Field>
        <Field label="Status" htmlFor="t-status">
          <Select id="t-status" {...register('status')}>
            <EnumOptions values={TASK_STATUSES} />
          </Select>
        </Field>
        <Field label="Customer" htmlFor="t-customer" error={errors.customerId?.message}>
          <RecordCombobox kind="customers" id="t-customer" value={watch('customerId') as string} selectedLabel={task?.customer?.fullName ?? defaults?.customerLabel} onChange={(v) => setValue('customerId', v ?? '')} />
        </Field>
        <Field label="Deal" htmlFor="t-deal" error={errors.dealId?.message}>
          <RecordCombobox kind="deals" id="t-deal" value={watch('dealId') as string} selectedLabel={task?.deal?.title ?? defaults?.dealLabel} onChange={(v) => setValue('dealId', v ?? '')} />
        </Field>
      </form>
    </Modal>
  );
}
