'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import type { Customer, Deal, Lead, Paginated } from '@crm/shared';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/use-debounce';
import { useWorkspace, wsKey } from '@/hooks/use-workspace';
import { Select } from './ui/input';

/** Member picker. Users without the assign permission can only pick themselves. */
export const MemberSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & { allowUnassigned?: boolean }>(
  function MemberSelect({ allowUnassigned = true, ...props }, ref) {
    const { members, can, me } = useWorkspace();
    const assignable = can('records:assign') ? members : members.filter((m) => m.user.id === me.id);
    return (
      <Select ref={ref} {...props}>
        {allowUnassigned && <option value="">Unassigned</option>}
        {assignable.map((m) => (
          <option key={m.user.id} value={m.user.id}>
            {m.user.name}
            {m.user.id === me.id ? ' (you)' : ''}
          </option>
        ))}
      </Select>
    );
  },
);

type RecordKind = 'customers' | 'leads' | 'deals';
interface Option {
  id: string;
  label: string;
  sublabel?: string | null;
}

function toOption(kind: RecordKind, row: Customer | Lead | Deal): Option {
  if (kind === 'deals') return { id: row.id, label: (row as Deal).title, sublabel: (row as Deal).customer?.fullName };
  const person = row as Customer | Lead;
  return { id: person.id, label: person.fullName, sublabel: person.company };
}

interface RecordComboboxProps {
  kind: RecordKind;
  id: string;
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  /** Label for the currently selected record when it is not in the search results. */
  selectedLabel?: string | null;
  placeholder?: string;
  invalid?: boolean;
}

/**
 * Accessible async combobox (WAI-ARIA combobox pattern) that searches records server-side.
 */
export function RecordCombobox({ kind, id, value, onChange, selectedLabel, placeholder = 'Search…', invalid }: RecordComboboxProps) {
  const { base, workspaceId } = useWorkspace();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [active, setActive] = React.useState(0);
  const [label, setLabel] = React.useState<string | null>(selectedLabel ?? null);
  const debounced = useDebounce(query, 250);
  const listId = `${id}-listbox`;

  React.useEffect(() => setLabel(selectedLabel ?? null), [selectedLabel]);

  const results = useQuery({
    queryKey: wsKey(workspaceId, kind, 'picker', debounced),
    queryFn: () => api<Paginated<Customer | Lead | Deal>>(`${base}/${kind}`, { query: { q: debounced || undefined, pageSize: 8, ...(kind === 'deals' ? {} : { sortBy: 'fullName', sortDir: 'asc' }) } }),
    enabled: open,
  });
  const options = (results.data?.data ?? []).map((row) => toOption(kind, row));

  const select = (option: Option) => {
    onChange(option.id);
    setLabel(option.label);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="relative">
      <div
        className={cn(
          'flex h-9 w-full items-center rounded-md border border-input bg-background pl-3 pr-1 text-sm shadow-xs focus-within:border-ring focus-within:outline-2 focus-within:outline-ring/40',
          invalid && 'border-destructive',
        )}
      >
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && options[active] ? `${id}-opt-${active}` : undefined}
          className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground/80"
          placeholder={value && label ? label : placeholder}
          value={open ? query : value && label ? label : ''}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
              setActive((a) => Math.min(a + 1, options.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter' && open && options[active]) {
              e.preventDefault();
              select(options[active]!);
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
        />
        {value ? (
          <button
            type="button"
            aria-label="Clear selection"
            className="rounded p-1 text-muted-foreground hover:text-foreground"
            onClick={() => {
              onChange(null);
              setLabel(null);
            }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <ChevronsUpDown className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        )}
      </div>
      {open && (
        <ul id={listId} role="listbox" className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border bg-popover p-1 shadow-lg">
          {results.isPending && <li className="px-2 py-1.5 text-sm text-muted-foreground">Searching…</li>}
          {results.isError && <li className="px-2 py-1.5 text-sm text-destructive">Could not load results</li>}
          {results.isSuccess && options.length === 0 && <li className="px-2 py-1.5 text-sm text-muted-foreground">No matches</li>}
          {options.map((option, index) => (
            <li
              key={option.id}
              id={`${id}-opt-${index}`}
              role="option"
              aria-selected={option.id === value}
              onMouseDown={(e) => {
                e.preventDefault();
                select(option);
              }}
              onMouseEnter={() => setActive(index)}
              className={cn('flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm', index === active && 'bg-muted')}
            >
              <span className="min-w-0">
                <span className="block truncate">{option.label}</span>
                {option.sublabel && <span className="block truncate text-xs text-muted-foreground">{option.sublabel}</span>}
              </span>
              {option.id === value && <Check className="h-4 w-4 text-primary" aria-hidden />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
