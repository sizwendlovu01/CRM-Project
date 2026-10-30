'use client';

import * as React from 'react';
import { AlertDialog, Dialog, DropdownMenu, Switch as SwitchPrimitive, Tabs as TabsPrimitive } from 'radix-ui';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

/* ---------------------------------- Dialog --------------------------------- */

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** "sheet" slides in from the right; used for record drawers. */
  variant?: 'dialog' | 'sheet';
}

export function Modal({ open, onOpenChange, title, description, children, footer, size = 'md', variant = 'dialog' }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-[3px] data-[state=open]:animate-fade-in" />
        <Dialog.Content
          className={cn(
            'fixed z-50 flex flex-col border bg-popover text-popover-foreground shadow-xl focus:outline-none',
            variant === 'dialog' &&
              'left-1/2 top-1/2 max-h-[90vh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl data-[state=open]:animate-dialog-in',
            variant === 'dialog' && size === 'sm' && 'max-w-md',
            variant === 'dialog' && size === 'md' && 'max-w-lg',
            variant === 'dialog' && size === 'lg' && 'max-w-2xl',
            variant === 'sheet' && 'inset-y-0 right-0 h-full w-full max-w-xl border-y-0 border-r-0 data-[state=open]:animate-sheet-in',
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b px-6 py-4">
            <div className="space-y-1">
              <Dialog.Title className="font-[family-name:var(--font-jakarta)] text-lg font-bold">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="text-sm text-muted-foreground">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Close">
                <X />
              </Button>
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 rounded-b-2xl border-t bg-subtle px-6 py-3.5">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* ------------------------------ Confirm dialog ------------------------------ */

interface ConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
}

/** Required before every destructive operation. */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = 'Confirm', destructive = true, loading, onConfirm }: ConfirmProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-[3px] data-[state=open]:animate-fade-in" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-popover p-6 shadow-xl data-[state=open]:animate-dialog-in">
          <AlertDialog.Title className="font-[family-name:var(--font-jakarta)] text-lg font-bold">{title}</AlertDialog.Title>
          <AlertDialog.Description asChild>
            <div className="mt-2 text-sm text-muted-foreground">{description}</div>
          </AlertDialog.Description>
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="outline" disabled={loading}>
                Cancel
              </Button>
            </AlertDialog.Cancel>
            <Button
              variant={destructive ? 'destructive' : 'default'}
              loading={loading}
              onClick={(event) => {
                event.preventDefault();
                onConfirm();
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

/* ------------------------------- Dropdown menu ------------------------------ */

export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;

export function MenuContent({ className, align = 'end', ...props }: React.ComponentPropsWithoutRef<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={6}
        className={cn('z-50 min-w-48 overflow-hidden rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-lg data-[state=open]:animate-pop-in', className)}
        {...props}
      />
    </DropdownMenu.Portal>
  );
}

export function MenuItem({ className, destructive, ...props }: React.ComponentPropsWithoutRef<typeof DropdownMenu.Item> & { destructive?: boolean }) {
  return (
    <DropdownMenu.Item
      className={cn(
        'flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium outline-none transition-colors data-[disabled]:pointer-events-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:text-muted-foreground data-[highlighted]:[&_svg]:text-accent-foreground',
        destructive && 'text-destructive data-[highlighted]:bg-danger-soft [&_svg]:text-destructive',
        className,
      )}
      {...props}
    />
  );
}

export function MenuLabel({ className, ...props }: React.ComponentPropsWithoutRef<typeof DropdownMenu.Label>) {
  return <DropdownMenu.Label className={cn('px-2 py-1.5 text-xs font-medium text-muted-foreground', className)} {...props} />;
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="my-1 h-px bg-border" />;
}

export const MenuSub = DropdownMenu.Sub;
export function MenuSubTrigger({ className, ...props }: React.ComponentPropsWithoutRef<typeof DropdownMenu.SubTrigger>) {
  return (
    <DropdownMenu.SubTrigger
      className={cn('flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-muted data-[state=open]:bg-muted [&_svg]:size-4 [&_svg]:text-muted-foreground', className)}
      {...props}
    />
  );
}
export function MenuSubContent({ className, ...props }: React.ComponentPropsWithoutRef<typeof DropdownMenu.SubContent>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.SubContent className={cn('z-50 min-w-48 rounded-xl border bg-popover p-1.5 shadow-lg data-[state=open]:animate-pop-in', className)} {...props} />
    </DropdownMenu.Portal>
  );
}

/* ----------------------------------- Tabs ----------------------------------- */

export const Tabs = TabsPrimitive.Root;
export function TabsList({ className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn('inline-flex h-10 items-center gap-1 rounded-xl bg-muted p-1', className)} {...props} />;
}
export function TabsTrigger({ className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'inline-flex h-8 items-center rounded-lg px-3.5 text-sm font-semibold text-muted-foreground transition-all duration-150 hover:text-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm',
        className,
      )}
      {...props}
    />
  );
}
export const TabsContent = TabsPrimitive.Content;

/* ---------------------------------- Switch ---------------------------------- */

export function Switch({ className, ...props }: React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent bg-input transition-colors data-[state=checked]:bg-primary disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block h-4 w-4 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-4" />
    </SwitchPrimitive.Root>
  );
}
