import { useEffect, useState } from 'react';
import { Link2, Send, Copy, Check, RefreshCw } from 'lucide-react';
import { api } from '../../services/api.js';
import { configApi } from '../../services/config.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';

// Build plan P5 (§9) — recruiter sends a shortlisted candidate a link to take
// the AI interview now or later, no slot booking. Hidden unless the feature
// is on and the user may configure interviews.
export default function InstantInterviewCard({ application, onChanged }) {
  const { can } = usePermissions();
  const [enabled, setEnabled] = useState(false);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    configApi
      .getPublic()
      .then((c) => setEnabled(Boolean(c?.instantInterview)))
      .catch(() => setEnabled(false));
  }, []);

  const eligible = ['SHORTLISTED', 'INTERVIEW_SCHEDULED'].includes(application.status);
  if (!enabled || !eligible || !can('CONFIGURE_INTERVIEWS')) return null;

  const send = async (rotate = false) => {
    setBusy(rotate ? 'rotate' : 'send');
    setError('');
    try {
      const r = await api.post(`/scheduling/applications/${application.id}/instant-interview`, rotate ? { rotate: true } : undefined);
      setResult(r);
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const already = application.status === 'INTERVIEW_SCHEDULED';

  return (
    <Card className="mb-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Link2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
          <div>
            <h3 className="font-semibold text-slate-900">Instant interview link</h3>
            <p className="text-sm text-slate-500">
              {already
                ? 'The candidate has an interview. Re-send the link, or issue a new one (the old link stops working).'
                : 'Email the candidate a link to take the AI interview now or later — no slot booking needed.'}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:shrink-0">
          <Button onClick={() => send(false)} loading={busy === 'send'} className="w-full sm:w-auto">
            <Send className="h-4 w-4" /> {already ? 'Re-send link' : 'Send interview link'}
          </Button>
          {already && (
            <Button variant="secondary" onClick={() => send(true)} loading={busy === 'rotate'} className="w-full sm:w-auto">
              <RefreshCw className="h-4 w-4" /> New link
            </Button>
          )}
        </div>
      </div>

      {result && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm text-emerald-900">
            {result.emailed ? 'Emailed to the candidate.' : `Link ready, but the email failed${result.emailError ? `: ${result.emailError}` : ''}.`} Valid
            until {new Date(result.expiresAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}.
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              readOnly
              value={result.link}
              onFocus={(e) => e.target.select()}
              className="min-h-[44px] w-full min-w-0 flex-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 font-mono text-xs text-slate-700"
              aria-label="Interview link"
            />
            <Button variant="secondary" onClick={copy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </Card>
  );
}
