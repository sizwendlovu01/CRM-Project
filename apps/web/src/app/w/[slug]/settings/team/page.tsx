'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Crown, MailPlus, RotateCw, Trash2, UserMinus } from 'lucide-react';
import { toast } from 'sonner';
import type { z } from 'zod';
import { canChangeRole, canInviteRole, canRemoveMember, humanize, INVITABLE_ROLES, inviteMemberSchema, ROLE_DESCRIPTIONS, type InvitationDto, type Member, type Role } from '@crm/shared';
import { ErrorState, TableSkeleton } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Field, fieldA11y, Input, Select } from '@/components/ui/input';
import { Avatar, Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Table, TBody, TD, TH, THead, TR } from '@/components/ui/misc';
import { ConfirmDialog } from '@/components/ui/overlays';
import { api, ApiError } from '@/lib/api';
import { formatDate, formatRelative } from '@/lib/format';
import { useWorkspace, wsKey } from '@/hooks/use-workspace';

type InviteValues = z.infer<typeof inviteMemberSchema>;

export default function TeamSettingsPage() {
  const { base, workspaceId, workspace, me, members, can } = useWorkspace();
  const client = useQueryClient();
  const [removing, setRemoving] = useState<Member | null>(null);
  const [transferTo, setTransferTo] = useState<Member | null>(null);
  const actorRole = workspace.role;
  const invalidateMembers = () => client.invalidateQueries({ queryKey: wsKey(workspaceId) });

  const invitations = useQuery({
    queryKey: wsKey(workspaceId, 'invitations'),
    queryFn: () => api<InvitationDto[]>(`${base}/invitations`),
    enabled: can('members:invite'),
  });

  const changeRole = useMutation({
    mutationFn: ({ member, role }: { member: Member; role: Role }) => api(`${base}/members/${member.id}`, { method: 'PATCH', body: { role } }),
    onSuccess: () => {
      toast.success('Role updated');
      void invalidateMembers();
    },
  });
  const remove = useMutation({
    mutationFn: (member: Member) => api(`${base}/members/${member.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Member removed');
      setRemoving(null);
      void invalidateMembers();
    },
  });
  const transfer = useMutation({
    mutationFn: (member: Member) => api(`${base}/transfer-ownership`, { method: 'POST', body: { userId: member.user.id } }),
    onSuccess: () => {
      toast.success('Ownership transferred');
      setTransferTo(null);
      void invalidateMembers();
    },
  });
  const revoke = useMutation({ mutationFn: (id: string) => api(`${base}/invitations/${id}`, { method: 'DELETE' }), onSuccess: () => { toast.success('Invitation revoked'); void invitations.refetch(); } });
  const resend = useMutation({ mutationFn: (id: string) => api(`${base}/invitations/${id}/resend`, { method: 'POST' }), onSuccess: () => { toast.success('Invitation re-sent'); void invitations.refetch(); } });

  const form = useForm<InviteValues>({ resolver: zodResolver(inviteMemberSchema), defaultValues: { email: '', role: 'SALES_REPRESENTATIVE' } });
  const invite = useMutation({
    mutationFn: (values: InviteValues) => api<InvitationDto>(`${base}/invitations`, { method: 'POST', body: values }),
    meta: { silent: true },
    onSuccess: (inv) => {
      toast.success(`Invitation sent to ${inv.email}`);
      form.reset({ email: '', role: form.getValues('role') });
      void invitations.refetch();
      void client.invalidateQueries({ queryKey: wsKey(workspaceId, 'subscription') });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.fieldErrors().email) form.setError('email', { message: error.message });
      toast.error(error.message);
    },
  });
  const invitableRoles = INVITABLE_ROLES.filter((role) => canInviteRole(actorRole, role));
  const pending = invitations.data?.filter((i) => i.status === 'PENDING') ?? [];

  return (
    <div className="space-y-6">
      {can('members:invite') && (
        <Card>
          <CardHeader>
            <CardTitle>Invite a teammate</CardTitle>
            <CardDescription>Invitations are emailed and expire after 7 days. Pending invitations count towards your plan&apos;s member limit.</CardDescription>
          </CardHeader>
          <CardContent>
            <form noValidate onSubmit={form.handleSubmit((v) => invite.mutate(v))} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Field label="Email address" htmlFor="invite-email" error={form.formState.errors.email?.message} className="flex-1">
                <Input type="email" placeholder="colleague@company.com" {...fieldA11y('invite-email', form.formState.errors.email?.message)} {...form.register('email')} />
              </Field>
              <Field label="Role" htmlFor="invite-role" className="sm:w-56">
                <Select id="invite-role" {...form.register('role')}>
                  {invitableRoles.map((r) => <option key={r} value={r}>{humanize(r)}</option>)}
                </Select>
              </Field>
              <Button type="submit" loading={invite.isPending}><MailPlus /> Send invite</Button>
            </form>
            <p className="mt-3 text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[form.watch('role') as Role]}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Members ({members.length})</CardTitle>
          <CardDescription>Roles control what each person can see and do. Permissions are enforced on the server.</CardDescription>
        </CardHeader>
        <Table aria-label="Members">
          <THead>
            <tr>
              <TH>Member</TH>
              <TH>Role</TH>
              <TH className="hidden sm:table-cell">Joined</TH>
              <TH className="w-24"><span className="sr-only">Actions</span></TH>
            </tr>
          </THead>
          <TBody>
            {members.map((m) => {
              const self = m.user.id === me.id;
              const roleOptions = INVITABLE_ROLES.filter((r) => r === m.role || canChangeRole(actorRole, m.role, r));
              const editableRole = !self && m.role !== 'OWNER' && roleOptions.length > 1;
              return (
                <TR key={m.id}>
                  <TD>
                    <span className="flex items-center gap-3">
                      <Avatar name={m.user.name} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{m.user.name} {self && <span className="text-xs text-muted-foreground">(you)</span>}</span>
                        <span className="block truncate text-xs text-muted-foreground">{m.user.email}</span>
                      </span>
                    </span>
                  </TD>
                  <TD>
                    {editableRole ? (
                      <Select aria-label={`Role for ${m.user.name}`} value={m.role} onChange={(e) => changeRole.mutate({ member: m, role: e.target.value as Role })} className="h-8 w-48">
                        {roleOptions.map((r) => <option key={r} value={r}>{humanize(r)}</option>)}
                      </Select>
                    ) : (
                      <Badge tone={m.role === 'OWNER' ? 'primary' : 'neutral'}>{m.role === 'OWNER' && <Crown className="h-3 w-3" />}{humanize(m.role)}</Badge>
                    )}
                  </TD>
                  <TD className="hidden text-muted-foreground sm:table-cell">{formatDate(m.joinedAt)}</TD>
                  <TD>
                    <span className="flex justify-end gap-1">
                      {actorRole === 'OWNER' && !self && (
                        <Button variant="ghost" size="icon-sm" aria-label={`Transfer ownership to ${m.user.name}`} title="Transfer ownership" onClick={() => setTransferTo(m)}><Crown /></Button>
                      )}
                      {!self && canRemoveMember(actorRole, m.role) && (
                        <Button variant="ghost" size="icon-sm" aria-label={`Remove ${m.user.name}`} title="Remove member" onClick={() => setRemoving(m)}><UserMinus /></Button>
                      )}
                    </span>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </Card>

      {can('members:invite') && (
        <Card>
          <CardHeader>
            <CardTitle>Pending invitations</CardTitle>
          </CardHeader>
          {invitations.isPending ? (
            <TableSkeleton rows={2} columns={3} />
          ) : invitations.isError ? (
            <ErrorState error={invitations.error} onRetry={() => void invitations.refetch()} />
          ) : pending.length === 0 ? (
            <CardContent><p className="text-sm text-muted-foreground">No pending invitations.</p></CardContent>
          ) : (
            <ul className="divide-y border-t" aria-label="Pending invitations">
              {pending.map((inv) => (
                <li key={inv.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">{humanize(inv.role)} · invited {formatRelative(inv.createdAt)}{inv.invitedBy ? ` by ${inv.invitedBy.name}` : ''} · expires {formatDate(inv.expiresAt)}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => resend.mutate(inv.id)} loading={resend.isPending && resend.variables === inv.id}><RotateCw /> Resend</Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => revoke.mutate(inv.id)}><Trash2 /> Revoke</Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <ConfirmDialog open={Boolean(removing)} onOpenChange={(o) => !o && setRemoving(null)} title={`Remove ${removing?.user.name}?`} description="They will lose access immediately and their open records will become unassigned." confirmLabel="Remove member" loading={remove.isPending} onConfirm={() => removing && remove.mutate(removing)} />
      <ConfirmDialog open={Boolean(transferTo)} onOpenChange={(o) => !o && setTransferTo(null)} title={`Transfer ownership to ${transferTo?.user.name}?`} description="They become the owner with billing control. You will become an admin. This can only be reversed by the new owner." confirmLabel="Transfer ownership" loading={transfer.isPending} onConfirm={() => transferTo && transfer.mutate(transferTo)} />
    </div>
  );
}
