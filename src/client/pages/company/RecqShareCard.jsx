import { useEffect, useState } from 'react';
import { Share2, Copy, Check, CalendarClock, Save } from 'lucide-react';
import { jobsApi } from '../../services/jobs.js';
import { configApi } from '../../services/config.js';
import { careersAdminApi } from '../../services/public.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import { checkForm } from '../../../shared/schemas/common.js';
import { updateJobSchema } from '../../../shared/schemas/job.schema.js';

// ISO <-> <input type="datetime-local"> (local, no timezone suffix).
function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(v) {
  return v ? new Date(v).toISOString() : null;
}

function LinkRow({ label, url }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the field is selectable */
    }
  };
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-slate-600">{label}</p>
      <div className="flex items-stretch gap-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.target.select()}
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
        />
        <Button variant="secondary" onClick={copy} className="shrink-0 px-3">
          {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
        </Button>
      </div>
    </div>
  );
}

// Build plan P9 — recruiter card: share the /recq candidate links and set the
// interview availability window. Shown only when FEATURE_RECQ is on, and
// independent of the instant-interview flag (which gates InterviewFlowCard).
export default function RecqShareCard({ job, onSaved }) {
  const { can } = usePermissions();
  const [enabled, setEnabled] = useState(null);
  const [agencySlug, setAgencySlug] = useState('');
  const [win, setWin] = useState({
    start: toLocalInput(job.interviewAvailabilityStart),
    end: toLocalInput(job.interviewAvailabilityEnd),
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    configApi
      .getPublic()
      .then((c) => setEnabled(Boolean(c?.recq)))
      .catch(() => setEnabled(false));
    careersAdminApi
      .getLink()
      .then((d) => setAgencySlug(d?.slug || ''))
      .catch(() => setAgencySlug(''));
  }, []);

  if (enabled === null) return null;
  if (!enabled) return null;

  const origin = window.location.origin;
  const agencyUrl = agencySlug ? `${origin}/recq/${agencySlug}` : null;
  const jobUrl = agencySlug && job.slug ? `${origin}/recq/${agencySlug}/${job.slug}` : null;
  const canEdit = can('CONFIGURE_INTERVIEWS') && can('MANAGE_JOBS');

  const save = async () => {
    setSaved(false);
    setError('');
    if (win.start && win.end && new Date(win.end) <= new Date(win.start)) {
      setError('The interview window must end after it starts.');
      return;
    }
    const payload = {
      interviewAvailabilityStart: fromLocalInput(win.start),
      interviewAvailabilityEnd: fromLocalInput(win.end),
    };
    const { data } = checkForm(updateJobSchema, payload);
    setSaving(true);
    try {
      const { job: updated } = await jobsApi.update(job.id, data ?? payload);
      onSaved?.(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err.message || 'Could not save the interview window.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mb-6 p-5">
      <h3 className="mb-1 flex items-center gap-2 font-semibold text-slate-900">
        <Share2 className="h-4 w-4 text-brand-600" /> Share with candidates
      </h3>
      <p className="mb-4 text-sm text-slate-500">
        Candidates apply through these links — they upload a resume, pass the match, verify their email and take the interview. No account needed.
      </p>

      <div className="space-y-3">
        {jobUrl && <LinkRow label="This job" url={jobUrl} />}
        {agencyUrl && <LinkRow label="All your open roles" url={agencyUrl} />}
        {!agencyUrl && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Set up your public link first (Dashboard → your careers link) to share these.
          </p>
        )}
      </div>

      <div className="mt-5 border-t border-slate-100 pt-4">
        <p className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-800">
          <CalendarClock className="h-4 w-4 text-slate-400" /> Interview window
        </p>
        <p className="mb-3 text-xs text-slate-500">
          When candidates can take the interview. Leave both blank for no fixed window (the link follows the normal expiry).
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Opens</span>
            <input
              type="datetime-local"
              disabled={!canEdit}
              value={win.start}
              onChange={(e) => setWin((w) => ({ ...w, start: e.target.value }))}
              className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:opacity-60"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Closes</span>
            <input
              type="datetime-local"
              disabled={!canEdit}
              value={win.end}
              min={win.start || undefined}
              onChange={(e) => setWin((w) => ({ ...w, end: e.target.value }))}
              className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:opacity-60"
            />
          </label>
        </div>
        {canEdit && (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <Button variant="secondary" onClick={save} loading={saving} className="w-full sm:w-auto">
              <Save className="h-4 w-4" /> Save window
            </Button>
            {(win.start || win.end) && (
              <button
                type="button"
                onClick={() => setWin({ start: '', end: '' })}
                className="text-xs font-medium text-slate-500 hover:text-slate-700"
              >
                Clear window
              </button>
            )}
            {saved && (
              <span role="status" className="text-sm text-emerald-600">
                Saved.
              </span>
            )}
          </div>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    </Card>
  );
}
