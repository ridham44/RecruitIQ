import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Pencil, Users, Calendar, XCircle, Save, X, Laptop, IndianRupee, Clock3 } from 'lucide-react';
import { jobsApi } from '../../services/jobs.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import LoadingState from '../../components/ui/LoadingState.jsx';
import ErrorState from '../../components/ui/ErrorState.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import FormField, { inputClass } from '../../components/ui/FormField.jsx';
import TagInput from '../../components/ui/TagInput.jsx';

const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE'];
const WORK_MODES = ['On-site', 'Remote', 'Hybrid'];
const JOB_LEVELS = ['Junior', 'Mid', 'Senior', 'Lead'];
const NOTICE_PERIODS = ['Immediate', '15 days', '30 days', '60 days', '90 days'];

export default function JobDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [closing, setClosing] = useState(false);

  const load = () => {
    setError('');
    jobsApi
      .get(id)
      .then((data) => setJob(data.job))
      .catch((err) => setError(err.message));
  };

  useEffect(load, [id]);

  const startEdit = () => {
    setForm({
      title: job.title,
      description: job.description,
      workMode: job.workMode || 'On-site',
      openings: job.openings ?? 1,
      jobLevel: job.jobLevel || 'Mid',
      noticePeriod: job.noticePeriod || '30 days',
      salaryRange: job.salaryRange || '',
      minimumExperience: job.minimumExperience,
      maximumExperience: job.maximumExperience ?? '',
      location: job.location || '',
      employmentType: job.employmentType || 'FULL_TIME',
      requiredSkills: job.requiredSkills || [],
      preferredSkills: job.preferredSkills || [],
      educationRequirements: job.educationRequirements || [],
      languagesRequired: job.languagesRequired || [],
      certifications: job.certifications || [],
    });
    setEditing(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { job: updated } = await jobsApi.update(id, {
        ...form,
        openings: Math.max(1, parseInt(form.openings, 10) || 1),
        maximumExperience: form.maximumExperience === '' ? null : Number(form.maximumExperience),
        minimumExperience: Number(form.minimumExperience),
        salaryRange: form.salaryRange?.trim() || null,
        noticePeriod: form.noticePeriod?.trim() || null,
      });
      setJob(updated);
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = async () => {
    setClosing(true);
    try {
      const { job: updated } = await jobsApi.close(id);
      setJob(updated);
      setConfirmClose(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setClosing(false);
    }
  };

  if (error && !job) return <ErrorState message={error} onRetry={load} />;
  if (!job) return <LoadingState />;

  if (editing) {
    return (
      <div className="mx-auto max-w-2xl">
        <h2 className="mb-6 text-xl font-semibold text-slate-900">Edit job</h2>
        <Card className="p-6">
          <form onSubmit={handleSave}>
            <FormField label="Job title">
              <input required className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </FormField>

            <FormField label="Description">
              <textarea
                required
                rows={6}
                className={inputClass}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </FormField>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Work mode">
                <select className={inputClass} value={form.workMode} onChange={(e) => setForm({ ...form, workMode: e.target.value })}>
                  {WORK_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Number of openings (required)">
                <input
                  type="number"
                  required
                  min={1}
                  className={inputClass}
                  value={form.openings}
                  onChange={(e) => setForm({ ...form, openings: e.target.value })}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Job level">
                <select className={inputClass} value={form.jobLevel} onChange={(e) => setForm({ ...form, jobLevel: e.target.value })}>
                  {JOB_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Notice period">
                <select className={inputClass} value={form.noticePeriod} onChange={(e) => setForm({ ...form, noticePeriod: e.target.value })}>
                  {NOTICE_PERIODS.map((np) => (
                    <option key={np} value={np}>
                      {np}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Salary range">
                <input
                  className={inputClass}
                  value={form.salaryRange}
                  onChange={(e) => setForm({ ...form, salaryRange: e.target.value })}
                  placeholder="e.g. ₹6–10 LPA"
                />
              </FormField>

              <FormField label="Employment type">
                <select
                  className={inputClass}
                  value={form.employmentType}
                  onChange={(e) => setForm({ ...form, employmentType: e.target.value })}
                >
                  {EMPLOYMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Minimum experience (years)">
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  className={inputClass}
                  value={form.minimumExperience}
                  onChange={(e) => setForm({ ...form, minimumExperience: e.target.value })}
                />
              </FormField>
              <FormField label="Maximum experience (years)">
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  className={inputClass}
                  value={form.maximumExperience}
                  onChange={(e) => setForm({ ...form, maximumExperience: e.target.value })}
                />
              </FormField>
            </div>

            <FormField label="Location">
              <input className={inputClass} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </FormField>

            <FormField label="Required skills">
              <TagInput value={form.requiredSkills} onChange={(v) => setForm({ ...form, requiredSkills: v })} />
            </FormField>

            <FormField label="Preferred skills">
              <TagInput value={form.preferredSkills} onChange={(v) => setForm({ ...form, preferredSkills: v })} />
            </FormField>

            <FormField label="Languages required">
              <TagInput value={form.languagesRequired} onChange={(v) => setForm({ ...form, languagesRequired: v })} placeholder="e.g. English, Hindi" />
            </FormField>

            <FormField label="Certifications">
              <TagInput value={form.certifications} onChange={(v) => setForm({ ...form, certifications: v })} placeholder="e.g. AWS, Azure, PMP" />
            </FormField>

            <FormField label="Education requirements">
              <TagInput value={form.educationRequirements} onChange={(v) => setForm({ ...form, educationRequirements: v })} />
            </FormField>

            {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
                <X className="h-4 w-4" /> Cancel
              </Button>
              <Button type="submit" loading={saving}>
                <Save className="h-4 w-4" /> Save changes
              </Button>
            </div>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold text-slate-900">{job.title}</h2>
            <StatusBadge status={job.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {job.location || 'Remote'} · {job.employmentType.replace('_', ' ')} · {job.jobLevel || 'Mid'} Level
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
          <Button variant="secondary" onClick={startEdit} className="w-full sm:w-auto">
            <Pencil className="h-4 w-4" /> Edit
          </Button>
          <Link to={`/company/jobs/${id}/applications`} className="contents sm:block">
            <Button variant="secondary" className="w-full sm:w-auto">
              <Users className="h-4 w-4" /> Applications
            </Button>
          </Link>
          <Link to={`/company/jobs/${id}/interviews`} className="contents sm:block">
            <Button variant="secondary" className="w-full sm:w-auto">
              <Calendar className="h-4 w-4" /> Interviews
            </Button>
          </Link>
          {job.status !== 'CLOSED' && (
            <Button variant="danger" onClick={() => setConfirmClose(true)} className="w-full sm:w-auto">
              <XCircle className="h-4 w-4" /> Close job
            </Button>
          )}
        </div>
      </div>

      {/* Highlights bar */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatChip icon={Laptop} iconBg="bg-blue-50 text-blue-600" label="Work Mode" value={job.workMode || 'On-site'} />
        <StatChip icon={Users} iconBg="bg-brand-50 text-brand-600" label="Openings" value={job.openings || 1} />
        <StatChip icon={IndianRupee} iconBg="bg-emerald-50 text-emerald-600" label="Salary Range" value={job.salaryRange || 'Not disclosed'} />
        <StatChip icon={Clock3} iconBg="bg-amber-50 text-amber-600" label="Notice Period" value={job.noticePeriod || 'Negotiable'} />
      </div>

      <Card className="mb-6 p-5">
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Description</h3>
        <p className="whitespace-pre-wrap text-sm text-slate-600">{job.description}</p>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Experience</h3>
          <p className="text-sm text-slate-600">
            {job.minimumExperience}+ years{job.maximumExperience ? ` – up to ${job.maximumExperience} years` : ''}
          </p>
        </Card>
        <Card className="p-5">
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Education</h3>
          <p className="text-sm text-slate-600">
            {job.educationRequirements?.length ? job.educationRequirements.join(', ') : 'No specific requirement'}
          </p>
        </Card>
      </div>

      <Card className="mt-4 p-5">
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Required skills</h3>
        <SkillTags skills={job.requiredSkills} />

        <h3 className="mb-2 mt-4 text-sm font-semibold text-slate-900">Preferred skills</h3>
        <SkillTags skills={job.preferredSkills} tone="slate" />

        <h3 className="mb-2 mt-4 text-sm font-semibold text-slate-900">Languages required</h3>
        <SkillTags skills={job.languagesRequired} tone="emerald" />

        <h3 className="mb-2 mt-4 text-sm font-semibold text-slate-900">Certifications</h3>
        <SkillTags skills={job.certifications} tone="amber" />
      </Card>

      <ConfirmDialog
        open={confirmClose}
        title="Close this job?"
        description="Candidates will no longer be able to apply. Existing applications remain visible."
        confirmLabel="Close job"
        onConfirm={handleClose}
        onCancel={() => setConfirmClose(false)}
        loading={closing}
      />
    </div>
  );
}

function StatChip({ icon: Icon, iconBg, label, value }) {
  return (
    <Card className="p-3.5">
      <div className={`inline-flex rounded-lg p-1.5 ${iconBg}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <p className="mt-2 text-xs font-medium text-slate-400">{label}</p>
      <p className="truncate text-sm font-semibold text-slate-800">{value}</p>
    </Card>
  );
}

function SkillTags({ skills, tone = 'brand' }) {
  if (!skills?.length) return <p className="text-sm text-slate-400">None specified</p>;
  const cls = tone === 'brand' ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-600';
  return (
    <div className="flex flex-wrap gap-2">
      {skills.map((skill) => (
        <span key={skill} className={`rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>
          {skill}
        </span>
      ))}
    </div>
  );
}
