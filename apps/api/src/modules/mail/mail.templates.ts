export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface TemplateInput {
  heading: string;
  paragraphs: string[];
  action?: { label: string; url: string };
  footnote?: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/** Minimal, client-safe transactional email layout. All dynamic text is HTML-escaped. */
export function render(subject: string, input: TemplateInput): RenderedEmail {
  const paragraphs = input.paragraphs.map((p) => `<p style="margin:0 0 16px;line-height:1.6;color:#334155">${escapeHtml(p)}</p>`).join('');
  const action = input.action
    ? `<p style="margin:24px 0"><a href="${escapeHtml(input.action.url)}" style="background:#4f46e5;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">${escapeHtml(input.action.label)}</a></p>
       <p style="margin:0 0 16px;font-size:13px;color:#64748b">Or paste this link into your browser:<br>${escapeHtml(input.action.url)}</p>`
    : '';
  const footnote = input.footnote ? `<p style="margin:24px 0 0;font-size:12px;color:#94a3b8">${escapeHtml(input.footnote)}</p>` : '';

  const html = `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:32px">
  <tr><td><p style="margin:0 0 24px;font-weight:700;color:#4f46e5">Enterprise CRM</p>
  <h1 style="margin:0 0 16px;font-size:20px;color:#0f172a">${escapeHtml(input.heading)}</h1>
  ${paragraphs}${action}${footnote}</td></tr></table></td></tr></table></body></html>`;

  const text = [input.heading, '', ...input.paragraphs, ...(input.action ? ['', `${input.action.label}: ${input.action.url}`] : []), ...(input.footnote ? ['', input.footnote] : [])].join('\n');

  return { subject, html, text };
}

export const templates = {
  verifyEmail: (name: string, url: string) =>
    render('Verify your email address', {
      heading: `Welcome, ${name}`,
      paragraphs: ['Please confirm your email address to secure your Enterprise CRM account.'],
      action: { label: 'Verify email', url },
      footnote: 'This link expires in 48 hours. If you did not create an account you can ignore this email.',
    }),

  passwordReset: (name: string, url: string) =>
    render('Reset your password', {
      heading: 'Password reset requested',
      paragraphs: [`Hi ${name}, we received a request to reset your password.`],
      action: { label: 'Choose a new password', url },
      footnote: 'This link expires in 60 minutes and can only be used once. If you did not request a reset, no action is needed.',
    }),

  invitation: (workspaceName: string, inviterName: string, role: string, url: string) =>
    render(`You're invited to join ${workspaceName}`, {
      heading: `Join ${workspaceName} on Enterprise CRM`,
      paragraphs: [`${inviterName} invited you to join the ${workspaceName} workspace as ${role}.`],
      action: { label: 'Accept invitation', url },
      footnote: 'This invitation expires in 7 days.',
    }),

  notification: (title: string, body: string | null, url: string | null) =>
    render(title, {
      heading: title,
      paragraphs: body ? [body] : [],
      action: url ? { label: 'Open in CRM', url } : undefined,
      footnote: 'You can change email notification preferences in your profile settings.',
    }),
};
