import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Link2, Save } from 'lucide-react';
import { jobsApi } from '../../services/jobs.js';
import { interviewsApi } from '../../services/interviews.js';
import { configApi } from '../../services/config.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import { inputClass } from '../../components/ui/FormField.jsx';
import { updateJobSchema } from '../../../shared/schemas/job.schema.js';
import { checkForm } from '../../../shared/schemas/common.js';

// Build plan P5 (§9) — per-job interview flow: slot booking (default) or an
// instant link. Also lists this job's link-based interviews, which don't
// appear in the slot table below.
export default function InterviewFlowCard({ job, onSaved }) {
  const { can } = usePermissions();
  const [enabled, setEnabled] = useState(null);
  const [form, setForm] = useState({ interviewFlow: job.interviewFlow || 'SLOT', inviteValidDays: job.inviteValidDays || 7 });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [linkInterviews, setLinkInterviews] = useState([]);

  useEffect(() => {
    configApi
      .getPublic()
      .then((c) => setEnabled(Boolean(c?.instantInterview)))
      .catch(() => setEnabled(false));
    interviewsApi
      .listForJob(job.id)
      .then((d) => setLinkInterviews((d.interviews || []).filter((i) => !i.slotId)))
      .catch(() => setLinkInterviews([]));
  }, [job.id]);

  if (enabled === null) return null;
  if (!enabled && job.interviewFlow !== 'INSTANT' && linkInterviews.length === 0) return null;

  const save = async () => {
    setSaved(false);
    setError('');
    const { data, errors } = checkForm(updateJobSchema, {
      interviewFlow: form.interviewFlow,
      inviteValidDays: form.inviteValidDays === '' ? NaN : Number(form.inviteValidDays),
    });
    if (errors.inviteValidDays && form.inviteValidDays === '') errors.inviteValidDays = 'Enter how many days the link stays valid (1–60)';
    setFieldErrors(errors);
    if (!data) return setError('Please fix the highlighted fields');
    setSaving(true);
    try {
      const { job: updated } = await jobsApi.update(job.id, data);
      onSaved?.(updated);
      setSaved(true);
    } catch (err) {
      const fields = err.fields || {};
      setFieldErrors(fields);
      setError(Object.keys(fields).length ? 'Please fix the highlighted fields' : err.message);
    } finally {
      setSaving(false);
    }
  };

  const canEdit = can('CONFIGURE_INTERVIEWS') && can('MANAGE_JOBS');

  return (
    <Card className="mb-6 p-5">
      <h3 className="mb-1 flex items-center gap-2 font-semibold text-slate-900">
        <Link2 className="h-4 w-4 text-brand-600" /> Interview flow
      </h3>
      <p className="mb-4 text-sm text-slate-500">How shortlisted candidates get to their AI interview.</p>

      {!enabled && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Instant links are switched off (FEATURE_INSTANT_INTERVIEW) — candidates use slot booking until it's turned on.
        </p>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {[
          ['SLOT', 'Slot booking', 'Candidates pick one of the time slots you publish below.'],
          ['INSTANT', 'Instant link', 'Shortlisted candidates get a link to start now or any time before it expires.'],
        ].map(([value, title, desc]) => (
          <label
            key={value}
            className={`flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border p-3 ${
              form.interviewFlow === value ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'
            } ${!canEdit ? 'cursor-not-allowed opacity-70' : ''}`}
          >
            <input
              type="radio"
              name="interviewFlow"
              className="mt-1 h-4 w-4 text-brand-600"
              checked={form.interviewFlow === value}
              disabled={!canEdit}
              onChange={() => setForm({ ...form, interviewFlow: value })}
            />
            <span>
              <span className="block text-sm font-medium text-slate-900">{title}</span>
              <span className="block text-xs text-slate-500">{desc}</span>
            </span>
          </label>
        ))}
      </div>

      {form.interviewFlow === 'INSTANT' && (
        <div className="mt-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
          <label htmlFor="inviteValidDays" className="text-sm text-slate-700">
            Link valid for
          </label>
          <div className="flex items-center gap-2">
            <input
              id="inviteValidDays"
              type="number"
              min={1}
              max={60}
              step={1}
              aria-invalid={fieldErrors.inviteValidDays ? true : undefined}
              aria-describedby={fieldErrors.inviteValidDays ? 'inviteValidDays-error' : undefined}
              disabled={!canEdit}
              className={`${inputClass} min-h-[44px] w-24`}
              value={form.inviteValidDays}
              onChange={(e) => setForm({ ...form, inviteValidDays: e.target.value })}
            />
            <span className="text-sm text-slate-500">days</span>
          </div>
          {fieldErrors.inviteValidDays && (
            <p id="inviteValidDays-error" role="alert" className="text-xs text-red-600">
              {fieldErrors.inviteValidDays}
            </p>
          )}
        </div>
      )}

      {canEdit && (
        <div className="mt-4 flex items-center gap-3">
          <Button variant="secondary" onClick={save} loading={saving}>
            <Save className="h-4 w-4" /> Save
          </Button>
          {saved && <span className="text-sm text-emerald-600">Saved.</span>}
        </div>
      )}
      <p className="mt-2 text-xs text-slate-400">
        With auto-advance on (Applications → Screening settings), candidates who pass the score get the link automatically. You can
        also send it from a candidate's page.
      </p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {linkInterviews.length > 0 && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="mb-2 text-sm font-medium text-slate-700">Link interviews ({linkInterviews.length})</p>
          <ul className="divide-y divide-slate-100">
            {linkInterviews.map((i) => (
              <li key={i.id} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
                <Link to={`/company/jobs/${job.id}/interviews/${i.id}`} className="text-sm font-medium text-slate-900 hover:text-brand-600">
                  {i.application?.candidate?.fullName || 'Candidate'}
                </Link>
                <span className="flex items-center gap-2 text-xs text-slate-500">
                  {i.report?.overallScore != null && <span>Score {Math.round(i.report.overallScore)}</span>}
                  <StatusBadge status={i.status} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
