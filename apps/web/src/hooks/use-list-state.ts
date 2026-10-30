'use client';

import { useCallback, useState } from 'react';
import { useDebounce } from './use-debounce';

/** Table state: debounced search, filters, sorting and pagination (filters reset to page 1). */
export function useListState<F extends Record<string, string>, S extends string>(initial: { filters: F; sortBy: S; sortDir?: 'asc' | 'desc'; pageSize?: number }) {
  const [search, setSearchRaw] = useState('');
  const [filters, setFiltersRaw] = useState<F>(initial.filters);
  const [sortBy, setSortBy] = useState<S>(initial.sortBy);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(initial.sortDir ?? 'desc');
  const [page, setPage] = useState(1);
  const q = useDebounce(search.trim(), 300);

  const setSearch = useCallback((value: string) => {
    setSearchRaw(value);
    setPage(1);
  }, []);
  const setFilter = useCallback(<K extends keyof F>(key: K, value: F[K]) => {
    setFiltersRaw((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }, []);
  const resetFilters = useCallback(() => {
    setFiltersRaw(initial.filters);
    setSearchRaw('');
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const toggleSort = useCallback(
    (field: S) => {
      if (field === sortBy) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      else {
        setSortBy(field);
        setSortDir('asc');
      }
      setPage(1);
    },
    [sortBy],
  );

  const activeFilters = Object.values(filters).filter(Boolean).length + (q ? 1 : 0);
  const query = { ...filters, q: q || undefined, sortBy, sortDir, page, pageSize: initial.pageSize ?? 20 };
  return { search, setSearch, filters, setFilter, resetFilters, sortBy, sortDir, toggleSort, page, setPage, query, activeFilters };
}

export function ariaSort(active: boolean, dir: 'asc' | 'desc'): 'ascending' | 'descending' | 'none' {
  if (!active) return 'none';
  return dir === 'asc' ? 'ascending' : 'descending';
}
