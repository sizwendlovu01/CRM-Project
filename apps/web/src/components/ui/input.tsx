import * as React from 'react';
import { Label as LabelPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

const fieldBase =
  'w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground shadow-xs transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground/80 hover:border-border-strong focus-visible:border-primary focus-visible:shadow-[0_0_0_4px_color-mix(in_srgb,var(--primary)_14%,transparent)] focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70 aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:shadow-[0_0_0_4px_color-mix(in_srgb,var(--destructive)_14%,transparent)]';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, type = 'text', ...props },
  ref,
) {
  return <input ref={ref} type={type} className={cn(fieldBase, 'h-10 py-1', className)} {...props} />;
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, rows = 3, ...props }, ref) {
    return <textarea ref={ref} rows={rows} className={cn(fieldBase, 'min-h-20 py-2', className)} {...props} />;
  },
);

/** Native select: fully accessible, keyboard friendly and reliable on mobile. */
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        fieldBase,
        'h-10 appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 20 20%27 fill=%27%2364748b%27%3E%3Cpath d=%27M5.5 7.5 10 12l4.5-4.5%27 stroke=%27%2364748b%27 stroke-width=%271.5%27 fill=%27none%27/%3E%3C/svg%3E")] bg-[length:1rem] bg-[right_0.6rem_center] bg-no-repeat pr-8',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});

export const Label = React.forwardRef<HTMLLabelElement, React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>>(function Label(
  { className, ...props },
  ref,
) {
  return <LabelPrimitive.Root ref={ref} className={cn('text-[13px] font-semibold leading-none text-foreground', className)} {...props} />;
});

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

/** Label + control + error/hint, wired for screen readers via aria-describedby on the control. */
export function Field({ label, htmlFor, error, hint, required, className, children }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center gap-0.5">
        <Label htmlFor={htmlFor}>{label}</Label>
        {required && (
          <span className="text-sm text-destructive" aria-hidden>
            *
          </span>
        )}
      </div>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function fieldA11y(id: string, error?: string) {
  return { id, 'aria-invalid': error ? true : undefined, 'aria-describedby': error ? `${id}-error` : undefined } as const;
}
