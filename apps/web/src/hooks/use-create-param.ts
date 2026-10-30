'use client';

import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * Opens a page's "create" form when the URL contains ?create=1 (used by the global "New" menu),
 * then removes the parameter so refreshing does not reopen it.
 */
export function useCreateParam(open: () => void, enabled = true) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const requested = params.get('create') === '1';

  useEffect(() => {
    if (!requested || !enabled) return;
    open();
    const next = new URLSearchParams(params.toString());
    next.delete('create');
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [requested, enabled, open, params, pathname, router]);
}
