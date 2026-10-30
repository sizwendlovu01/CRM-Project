'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Plus, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { STAGE_TYPES, type Pipeline, type Stage } from '@crm/shared';
import { EnumOptions } from '@/components/labels';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { Badge } from '@/components/ui/misc';
import { ConfirmDialog, Modal } from '@/components/ui/overlays';
import { api } from '@/lib/api';
import { useWorkspace, wsKey } from '@/hooks/use-workspace';

function StageRow({ pipeline, stage, index, onMove }: { pipeline: Pipeline; stage: Stage; index: number; onMove: (index: number, delta: number) => void }) {
  const { base, workspaceId } = useWorkspace();
  const client = useQueryClient();
  const [draft, setDraft] = useState({ name: stage.name, probability: String(stage.probability), type: stage.type, color: stage.color });
  const [deleting, setDeleting] = useState(false);
  const [target, setTarget] = useState('');
  const dirty = draft.name !== stage.name || draft.probability !== String(stage.probability) || draft.type !== stage.type || draft.color !== stage.color;
  const invalidate = () => client.invalidateQueries({ queryKey: wsKey(workspaceId) });

  const save = useMutation({
    mutationFn: () => api(`${base}/pipelines/${pipeline.id}/stages/${stage.id}`, { method: 'PATCH', body: { ...draft, probability: Number(draft.probability) } }),
    onSuccess: () => {
      toast.success('Stage saved');
      void invalidate();
    },
  });
  const remove = useMutation({
    mutationFn: () => api(`${base}/pipelines/${pipeline.id}/stages/${stage.id}`, { method: 'DELETE', query: { moveDealsToStageId: target || undefined } }),
    onSuccess: () => {
      toast.success('Stage deleted');
      setDeleting(false);
      void invalidate();
    },
  });

  return (
    <li className="grid grid-cols-[auto_1fr] items-end gap-2 rounded-lg border p-3 sm:grid-cols-[auto_1fr_90px_120px_44px_auto]">
      <div className="flex flex-col gap-1 self-center">
        <Button variant="ghost" size="icon-sm" className="h-6 w-6" aria-label={`Move ${stage.name} up`} disabled={index === 0} onClick={() => onMove(index, -1)}>
          <ArrowUp />
        </Button>
        <Button variant="ghost" size="icon-sm" className="h-6 w-6" aria-label={`Move ${stage.name} down`} disabled={index === pipeline.stages.length - 1} onClick={() => onMove(index, 1)}>
          <ArrowDown />
        </Button>
      </div>
      <Field label="Name" htmlFor={`stage-name-${stage.id}`}>
        <Input id={`stage-name-${stage.id}`} value={draft.name} maxLength={60} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
      </Field>
      <Field label="Probability %" htmlFor={`stage-prob-${stage.id}`}>
        <Input id={`stage-prob-${stage.id}`} type="number" min={0} max={100} value={draft.probability} onChange={(e) => setDraft({ ...draft, probability: e.target.value })} />
      </Field>
      <Field label="Type" htmlFor={`stage-type-${stage.id}`}>
        <Select id={`stage-type-${stage.id}`} value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as Stage['type'] })}>
          <EnumOptions values={STAGE_TYPES} />
        </Select>
      </Field>
      <Field label="Colour" htmlFor={`stage-color-${stage.id}`}>
        <input id={`stage-color-${stage.id}`} type="color" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} className="h-9 w-11 cursor-pointer rounded-md border bg-background p-1" />
      </Field>
      <div className="col-span-2 flex items-center justify-end gap-1 sm:col-span-1">
        <span className="mr-1 text-xs text-muted-foreground">{stage.dealCount ?? 0} deals</span>
        <Button size="sm" disabled={!dirty || !draft.name.trim()} loading={save.isPending} onClick={() => save.mutate()}>
          Save
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label={`Delete ${stage.name}`} onClick={() => setDeleting(true)}>
          <Trash2 />
        </Button>
      </div>
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete stage "${stage.name}"?`}
        loading={remove.isPending}
        confirmLabel="Delete stage"
        onConfirm={() => remove.mutate()}
        description={
          (stage.dealCount ?? 0) > 0 ? (
            <div className="space-y-3">
              <p>This stage contains {stage.dealCount} deal(s). Choose where to move them.</p>
              <Select aria-label="Move deals to" value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="">Select a stage…</option>
                {pipeline.stages
                  .filter((s) => s.id !== stage.id)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </Select>
            </div>
          ) : (
            'The stage is empty and will be removed.'
          )
        }
      />
    </li>
  );
}

export function StageManagerDialog({ open, onOpenChange, pipeline, pipelines, onSelectPipeline }: { open: boolean; onOpenChange: (open: boolean) => void; pipeline: Pipeline; pipelines: Pipeline[]; onSelectPipeline: (id: string) => void }) {
  const { base, workspaceId } = useWorkspace();
  const client = useQueryClient();
  const [newStage, setNewStage] = useState({ name: '', probability: '50' });
  const [newPipeline, setNewPipeline] = useState('');
  const [rename, setRename] = useState(pipeline.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const invalidate = () => client.invalidateQueries({ queryKey: wsKey(workspaceId) });

  const reorder = useMutation({
    mutationFn: (stageIds: string[]) => api(`${base}/pipelines/${pipeline.id}/stages/order`, { method: 'PUT', body: { stageIds } }),
    onSuccess: () => void invalidate(),
  });
  const addStage = useMutation({
    mutationFn: () => api(`${base}/pipelines/${pipeline.id}/stages`, { method: 'POST', body: { name: newStage.name, probability: Number(newStage.probability), type: 'OPEN' } }),
    onSuccess: () => {
      setNewStage({ name: '', probability: '50' });
      toast.success('Stage added');
      void invalidate();
    },
  });
  const updatePipeline = useMutation({
    mutationFn: (body: { name?: string; isDefault?: boolean }) => api(`${base}/pipelines/${pipeline.id}`, { method: 'PATCH', body }),
    onSuccess: () => {
      toast.success('Pipeline updated');
      void invalidate();
    },
  });
  const createPipeline = useMutation({
    mutationFn: () => api<Pipeline>(`${base}/pipelines`, { method: 'POST', body: { name: newPipeline } }),
    onSuccess: (p) => {
      setNewPipeline('');
      toast.success('Pipeline created');
      void invalidate();
      onSelectPipeline(p.id);
    },
  });
  const deletePipeline = useMutation({
    mutationFn: () => api(`${base}/pipelines/${pipeline.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Pipeline deleted');
      setConfirmDelete(false);
      const fallback = pipelines.find((p) => p.id !== pipeline.id);
      if (fallback) onSelectPipeline(fallback.id);
      void invalidate();
    },
  });

  const move = (index: number, delta: number) => {
    const ids = pipeline.stages.map((s) => s.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + delta, 0, moved!);
    reorder.mutate(ids);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Manage pipeline" description="Edit stages, probabilities and pipelines." size="lg">
      <div className="space-y-6">
        <section className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Pipeline name" htmlFor="pipeline-name" className="min-w-48 flex-1">
              <Input id="pipeline-name" value={rename} maxLength={80} onChange={(e) => setRename(e.target.value)} />
            </Field>
            <Button variant="outline" disabled={!rename.trim() || rename === pipeline.name} loading={updatePipeline.isPending} onClick={() => updatePipeline.mutate({ name: rename })}>
              Rename
            </Button>
            {pipeline.isDefault ? (
              <Badge tone="primary">
                <Star className="h-3 w-3" /> Default
              </Badge>
            ) : (
              <>
                <Button variant="outline" onClick={() => updatePipeline.mutate({ isDefault: true })}>
                  Make default
                </Button>
                <Button variant="ghost" className="text-destructive" onClick={() => setConfirmDelete(true)}>
                  Delete pipeline
                </Button>
              </>
            )}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold">Stages</h3>
          <ul className="space-y-2">
            {pipeline.stages.map((stage, index) => (
              <StageRow key={`${stage.id}-${stage.position}-${stage.name}-${stage.probability}`} pipeline={pipeline} stage={stage} index={index} onMove={move} />
            ))}
          </ul>
          <form
            className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-dashed p-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (newStage.name.trim()) addStage.mutate();
            }}
          >
            <Field label="New stage" htmlFor="new-stage-name" className="min-w-40 flex-1">
              <Input id="new-stage-name" value={newStage.name} maxLength={60} onChange={(e) => setNewStage({ ...newStage, name: e.target.value })} placeholder="e.g. Demo scheduled" />
            </Field>
            <Field label="Probability %" htmlFor="new-stage-prob" className="w-28">
              <Input id="new-stage-prob" type="number" min={0} max={100} value={newStage.probability} onChange={(e) => setNewStage({ ...newStage, probability: e.target.value })} />
            </Field>
            <Button type="submit" variant="outline" disabled={!newStage.name.trim()} loading={addStage.isPending}>
              <Plus /> Add stage
            </Button>
          </form>
        </section>

        <section className="border-t pt-4">
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (newPipeline.trim()) createPipeline.mutate();
            }}
          >
            <Field label="Create another pipeline" htmlFor="new-pipeline" className="min-w-48 flex-1" hint="Starts with the default stages. Subject to your plan's pipeline limit.">
              <Input id="new-pipeline" value={newPipeline} maxLength={80} onChange={(e) => setNewPipeline(e.target.value)} placeholder="e.g. Renewals" />
            </Field>
            <Button type="submit" disabled={!newPipeline.trim()} loading={createPipeline.isPending}>
              Create pipeline
            </Button>
          </form>
        </section>
      </div>
      <ConfirmDialog open={confirmDelete} onOpenChange={setConfirmDelete} title={`Delete "${pipeline.name}"?`} description="Only empty pipelines can be deleted. This cannot be undone." confirmLabel="Delete pipeline" loading={deletePipeline.isPending} onConfirm={() => deletePipeline.mutate()} />
    </Modal>
  );
}
