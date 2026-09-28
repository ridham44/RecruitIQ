import { useState } from 'react';
import { Check, Copy, MailCheck } from 'lucide-react';

// Build plan P1: shown after creating a company / resending an invite. The
// email may not arrive (e.g. Brevo not configured in dev), so the admin can
// always copy the link and share it directly.
export default function SetupLinkNotice({ email, link }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <div className="flex items-start gap-3">
        <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-emerald-900">Invite sent to {email}</p>
          <p className="mt-1 text-sm text-emerald-800">
            If the email doesn't arrive, share this link with the owner. It works once and expires in 72 hours.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              readOnly
              value={link}
              onFocus={(e) => e.target.select()}
              className="min-h-[44px] w-full min-w-0 flex-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 font-mono text-xs text-slate-700"
              aria-label="Set-password link"
            />
            <button
              type="button"
              onClick={copy}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
