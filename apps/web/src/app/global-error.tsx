'use client';

/*
 * Rendered when the root layout itself fails, so the app stylesheet may not be loaded.
 * It carries its own small token block instead of relying on globals.css.
 */
const STYLES = `
:root { --ge-bg: #ffffff; --ge-fg: #101828; --ge-muted: #5d6b82; --ge-primary: #5b47e8; --ge-on-primary: #ffffff; }
@media (prefers-color-scheme: dark) { :root { --ge-bg: #0f1524; --ge-fg: #e8ecf3; --ge-muted: #9aa6bc; --ge-primary: #7564f5; } }
html, body { overflow-x: clip; }
body { font-family: system-ui, sans-serif; display: grid; place-items: center; min-height: 100vh; margin: 0; background: var(--ge-bg); color: var(--ge-fg); }
.ge { text-align: center; padding: 24px; }
.ge h1 { font-size: 20px; }
.ge p { color: var(--ge-muted); }
.ge button { margin-top: 12px; padding: 10px 18px; border-radius: 10px; border: 0; background: var(--ge-primary); color: var(--ge-on-primary); font: inherit; cursor: pointer; }
.ge button:focus-visible { outline: 2px solid var(--ge-primary); outline-offset: 2px; }
`;

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <head>
        <style>{STYLES}</style>
      </head>
      <body>
        <div role="alert" className="ge">
          <h1>The application failed to load</h1>
          <p>Please refresh the page. If the problem persists, contact your administrator.</p>
          <button type="button" onClick={reset}>
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
