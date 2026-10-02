import { useState } from 'react';
import { RotateCcw, Copy, Check } from 'lucide-react';
import Card from './ui/Card.jsx';
import Button from './ui/Button.jsx';
import { inputClass } from './ui/FormField.jsx';

// Interview rounds for one candidate + the "second round" request form.
// Used on the agency candidate page and in the Company HR portal.
//   data: { rounds: [...], canRequestSecondRound }
//   canRequest: the viewer may ask for a second round
//   onRequest({ reason, notes }) → resolves to the refreshed data
//   audience: 'agency' | 'hr'

export const SECOND_ROUND_REASONS = [
  ['TECHNICAL_ISSUE', 'Technical issue in the first interview'],
  ['NOT_READY', 'Candidate was not ready'],
  ['NEED_MORE_DETAIL', 'Need more detail'],
  ['OTHER', 'Other'],
];
const reasonLabel = (key) => SECOND_ROUND_REASONS.find(([k]) => k === key)?.[1] || key;
const whoLabel = (role) => (role === 'CLIENT_HR' ? 'Company HR' : role === 'RECRUITER' ? 'Agency recruiter' : role ? 'Agency' : '');
const date = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

function statusText(r) {
  if (r.status === 'COMPLETED') return r.report ? `Completed ${date(r.endedAt)}` : `Completed ${date(r.endedAt)} · report in progress`;
  if (r.status === 'IN_PROGRESS') return 'In progress';
  return r.round > 1 ? `Link sent to the candidate${r.expiresAt ? ` · open until ${date(r.expiresAt)}` : ''}` : 'Scheduled';
}

function CopyLink({ link }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard?.writeText(link).then(() => {
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }).catch(() => {})}
      className="inline-flex min-h-[36px] items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
    >
      {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {done ? 'Copied' : 'Copy interview link'}
    </button>
  );
}

export default function SecondRoundPanel({ data, canRequest, onRequest, audience = 'agency' }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('TECHNICAL_ISSUE');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sentNote, setSentNote] = useState('');

  const rounds = data?.rounds || [];
  if (!rounds.length) return null;
  const showForm = canRequest && data.canRequestSecondRound;

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await onRequest({ reason, notes: notes.trim() });
      setOpen(false);
      setNotes('');
      setSentNote('Second round created — the candidate has been emailed the new interview link.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mb-6 p-4 sm:p-6">
      <h3 className="font-semibold text-slate-900">Interview rounds</h3>
      <ul className="mt-3 space-y-3">
        {rounds.map((r) => (
          <li key={r.interviewId} className="rounded-lg border border-slate-200 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">Round {r.round}</span>
              <span className="text-sm text-slate-700">{statusText(r)}</span>
              {r.report?.overallScore != null && (
                <span className="ml-auto rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                  Score {Math.round(r.report.overallScore)}
                </span>
              )}
            </div>
            {r.round > 1 && (
              <p className="mt-2 text-xs text-slate-500">
                Requested by {whoLabel(r.requestedByRole)} · {reasonLabel(r.reason)}
                {r.notes ? ` · “${r.notes}”` : ''}
              </p>
            )}
            {r.round > 1 && r.report && (
              <div className="mt-2 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                {r.report.strengths?.length > 0 && (
                  <div className="rounded-md bg-slate-50 p-2">
                    <p className="font-semibold text-emerald-700">Strengths</p>
                    <ul className="mt-1 list-disc pl-4 text-slate-600">
                      {r.report.strengths.slice(0, 4).map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {r.report.areasForImprovement?.length > 0 && (
                  <div className="rounded-md bg-slate-50 p-2">
                    <p className="font-semibold text-amber-700">Concerns</p>
                    <ul className="mt-1 list-disc pl-4 text-slate-600">
                      {r.report.areasForImprovement.slice(0, 4).map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            {audience === 'agency' && r.link && (
              <div className="mt-1">
                <CopyLink link={r.link} />
              </div>
            )}
          </li>
        ))}
      </ul>

      {audience === 'hr' && rounds.some((r) => r.round > 1 && r.status === 'COMPLETED') && (
        <p className="mt-3 text-xs text-slate-500">The candidate package below shows the scores as they were when the candidate was shared with you (round 1).</p>
      )}
      {sentNote && <p className="mt-3 text-sm text-emerald-700">{sentNote}</p>}

      {showForm && !open && (
        <Button variant="secondary" className="mt-4 w-full sm:w-auto" onClick={() => setOpen(true)}>
          <RotateCcw className="h-4 w-4" /> {audience === 'hr' ? 'Request second round' : 'Give second interview'}
        </Button>
      )}

      {showForm && open && (
        <div className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:p-4">
          <div>
            <label htmlFor="sr-reason" className="mb-1 block text-sm font-medium text-slate-700">
              Reason
            </label>
            <select id="sr-reason" className={`${inputClass} min-h-[44px]`} value={reason} onChange={(e) => setReason(e.target.value)}>
              {SECOND_ROUND_REASONS.map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="sr-notes" className="mb-1 block text-sm font-medium text-slate-700">
              What should the AI focus on? (optional)
            </label>
            <textarea
              id="sr-notes"
              rows={3}
              maxLength={1000}
              className={inputClass}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Ask more about SQL and team handling"
            />
          </div>
          <p className="text-xs text-slate-500">The candidate gets a new AI interview link by email right away. Round 1 and its report are kept.</p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="secondary" className="w-full sm:w-auto" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button className="w-full sm:w-auto" onClick={submit} loading={busy}>
              {audience === 'hr' ? 'Request second round' : 'Send second interview'}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
