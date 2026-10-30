import Link from 'next/link';
import { Logo } from '@/components/common';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <Logo />
      <p className="text-sm font-semibold text-primary">404</p>
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="max-w-sm text-sm text-muted-foreground">The page you are looking for does not exist or has moved.</p>
      <Button asChild>
        <Link href="/app">Back to the app</Link>
      </Button>
    </main>
  );
}
