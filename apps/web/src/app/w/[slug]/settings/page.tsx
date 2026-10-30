'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FullPageLoader } from '@/components/common';
import { useWorkspace } from '@/hooks/use-workspace';

export default function SettingsIndex() {
  const router = useRouter();
  const { href } = useWorkspace();
  useEffect(() => router.replace(href('/settings/profile')), [router, href]);
  return <FullPageLoader />;
}
