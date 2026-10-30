'use client';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', display: 'grid', placeItems: 'center', minHeight: '100vh', margin: 0, background: '#fff', color: '#0f172a' }}>
        <div role="alert" style={{ textAlign: 'center', padding: 24 }}>
          <h1 style={{ fontSize: 20 }}>The application failed to load</h1>
          <p style={{ color: '#5b6b82' }}>Please refresh the page. If the problem persists, contact your administrator.</p>
          <button type="button" onClick={reset} style={{ marginTop: 12, padding: '8px 16px', borderRadius: 8, border: 0, background: '#4f46e5', color: '#fff' }}>
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
