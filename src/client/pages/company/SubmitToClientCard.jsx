import { useEffect, useState } from 'react';
import { Send, Building2, Eye } from 'lucide-react';
import { submissionsApi } from '../../services/submissions.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import FormField, { inputClass } from '../../components/ui/FormField.jsx';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const fmt = (d) => new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

function Score({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2 text-center">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-slate-900">{value != null ? Math.round(value) : '—'}</p>
    </div>
  );
}

// Build plan P7 (§13) — final score, "Submit to client" with a package
// preview and HR picker, and the submission history (Sent / Viewed).
export default function SubmitToClientCard({ application, onChanged }) {
  const { can } = usePermissions();
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ mode: 'hr', hiringPersonId: '', recipientEmail: '', recipientName: '', note: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [sentLink, setSentLink] = useState('');

  const load = () =>
    submissionsApi
      .overview(application.id)
      .then(setData)
      .catch(() => setData(null));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [application.id, application.status]);

  if (!data) return null;
  const interviewed = data.preview?.interview || data.finalScore != null;
  if (!interviewed && data.history.length === 0) return null;

  const openModal = () => {
    setError('');
    setSentLink('');
    setForm({
      mode: data.recipients.length ? 'hr' : 'email',
      hiringPersonId: data.defaultHiringPersonId || data.recipients[0]?.id || '',
      recipientEmail: '',
      recipientName: '',
      note: '',
    });
    setOpen(true);
  };

  const submit = async () => {
    setError('');
    if (form.mode === 'email' && !EMAIL_REGEX.test(form.recipientEmail.trim())) return setError('Enter a valid email');
    if (form.mode === 'hr' && !form.hiringPersonId) return setError('Choose a Company HR');
    setSaving(true);
    try {
      const r = await submissionsApi.submit({
        applicationId: application.id,
        ...(form.mode === 'hr'
          ? { hiringPersonId: form.hiringPersonId }
          : { recipientEmail: form.recipientEmail.trim(), recipientName: form.recipientName.trim() || undefined }),
        ...(form.note.trim() ? { note: form.note.trim() } : {}),
      });
      setSentLink(r.link);
      await load();
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const p = data.preview;
  const canSend = can('SUBMIT_CANDIDATES') && data.canSubmit;

  return (
    <Card className="mb-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
          <div>
            <h3 className="font-semibold text-slate-900">Final score &amp; submission to company</h3>
            <p className="text-sm text-slate-500">
              {data.client ? `Company: ${data.client.name}` : 'This job is not linked to a company — you can send to an HR email.'}
              {data.finalThreshold != null && ` · Threshold ${data.finalThreshold}`}
            </p>
          </div>
        </div>
        {canSend && (
          <Button onClick={openModal} className="w-full sm:w-auto">
            <Send className="h-4 w-4" /> Submit to company
          </Button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 sm:max-w-md">
        <Score label="CV match" value={p?.cvMatch?.score} />
        <Score label="Interview" value={p?.interview?.overallScore} />
        <Score label="Final" value={data.finalScore} />
      </div>

      {data.history.length > 0 && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="mb-2 text-sm font-medium text-slate-700">Sent to</p>
          <ul className="divide-y divide-slate-100">
            {data.history.map((h) => (
              <li key={h.id} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="min-w-0 text-sm text-slate-900">
                  {h.recipientName} <span className="break-all text-xs text-slate-500">({h.recipientEmail})</span>
                  {h.submittedBy === 'Automatic' && <span className="ml-1 text-xs text-slate-400">· automatic</span>}
                </span>
                <span className="flex items-center gap-2 text-xs text-slate-500">
                  {fmt(h.createdAt)}
                  <StatusBadge status={h.status} />
                  {h.viewedAt && (
                    <span className="inline-flex items-center gap-1">
                      <Eye className="h-3.5 w-3.5" /> {fmt(h.viewedAt)}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Modal
        open={open}
        title="Submit to company"
        onClose={() => setOpen(false)}
        footer={
          sentLink ? (
            <div className="flex justify-end">
              <Button onClick={() => setOpen(false)} className="w-full sm:w-auto">
                Done
              </Button>
            </div>
          ) : (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setOpen(false)} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button onClick={submit} loading={saving} className="w-full sm:w-auto">
                <Send className="h-4 w-4" /> Send package
              </Button>
            </div>
          )
        }
      >
        {sentLink ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            Sent. The Company HR got an email with a private link to the candidate package.
            <input
              readOnly
              value={sentLink}
              onFocus={(e) => e.target.select()}
              className="mt-2 min-h-[44px] w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 font-mono text-xs text-slate-700"
              aria-label="Package link"
            />
          </div>
        ) : (
          <>
            <div className="mb-4 rounded-lg border border-slate-200 p-3 text-sm">
              <p className="mb-2 font-medium text-slate-900">What will be sent</p>
              <ul className="space-y-1 text-slate-600">
                <li>
                  {p.candidate.fullName} · {p.candidate.email}
                  {p.candidate.phone ? ` · ${p.candidate.phone}` : ''}
                </li>
                <li>CV: {p.cv.fileName}</li>
                <li>
                  CV match {p.cvMatch?.score != null ? Math.round(p.cvMatch.score) : '—'} · Interview{' '}
                  {p.interview?.overallScore != null ? Math.round(p.interview.overallScore) : '—'} · Final{' '}
                  {p.finalScore != null ? Math.round(p.finalScore) : '—'}
                </li>
                {p.interview && <li>Interview evaluation, strengths and {p.interview.questions.length} question summaries</li>}
              </ul>
            </div>

            {data.recipients.length > 0 && (
              <div className="mb-3 flex gap-2" role="radiogroup">
                {[
                  ['hr', 'Company HR'],
                  ['email', 'Type an email'],
                ].map(([k, l]) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={form.mode === k}
                    onClick={() => setForm({ ...form, mode: k })}
                    className={`min-h-[44px] flex-1 rounded-lg border px-3 text-sm font-medium ${
                      form.mode === k ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            )}

            {form.mode === 'hr' ? (
              <FormField label="Company HR">
                <select
                  className={`${inputClass} min-h-[44px]`}
                  value={form.hiringPersonId}
                  onChange={(e) => setForm({ ...form, hiringPersonId: e.target.value })}
                >
                  {data.recipients.map((r) => (
                    <option key={r.id} value={r.id}>
                      {/* {r.fullName} — {r.department} */}
                      {r.fullName}
                      {r.department ? ` — ${r.department}` : ''}
                      {r.id === data.defaultHiringPersonId ? ' (job HR)' : ''}
                    </option>
                  ))}
                </select>
              </FormField>
            ) : (
              <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                <FormField label="HR email">
                  <input
                    type="email"
                    inputMode="email"
                    className={`${inputClass} min-h-[44px]`}
                    value={form.recipientEmail}
                    onChange={(e) => setForm({ ...form, recipientEmail: e.target.value })}
                  />
                </FormField>
                <FormField label="Name (optional)">
                  <input className={`${inputClass} min-h-[44px]`} value={form.recipientName} onChange={(e) => setForm({ ...form, recipientName: e.target.value })} />
                </FormField>
              </div>
            )}

            <FormField label="Note to the company (optional)">
              <textarea rows={3} maxLength={1000} className={inputClass} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </FormField>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </>
        )}
      </Modal>
    </Card>
  );
}
