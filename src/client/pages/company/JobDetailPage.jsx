import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Pencil, Users, XCircle, Save, X } from 'lucide-react';
import { jobsApi } from '../../services/jobs.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import LoadingState from '../../components/ui/LoadingState.jsx';
import ErrorState from '../../components/ui/ErrorState.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import FormField, { inputClass } from '../../components/ui/FormField.jsx';
import TagInput from '../../components/ui/TagInput.jsx';

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
      minimumExperience: job.minimumExperience,
      maximumExperience: job.maximumExperience ?? '',
      location: job.location || '',
      requiredSkills: job.requiredSkills,
      preferredSkills: job.preferredSkills,
      educationRequirements: job.educationRequirements,
    });
    setEditing(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { job: updated } = await jobsApi.update(id, {
        ...form,
        maximumExperience: form.maximumExperience === '' ? null : Number(form.maximumExperience),
        minimumExperience: Number(form.minimumExperience),
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
            <div className="grid grid-cols-2 gap-4">
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
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-slate-900">{job.title}</h2>
            <StatusBadge status={job.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {job.location || 'Remote'} · {job.employmentType.replace('_', ' ')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={startEdit}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
          <Link to={`/company/jobs/${id}/applications`}>
            <Button variant="secondary">
              <Users className="h-4 w-4" /> Applications
            </Button>
          </Link>
          {job.status !== 'CLOSED' && (
            <Button variant="danger" onClick={() => setConfirmClose(true)}>
              <XCircle className="h-4 w-4" /> Close job
            </Button>
          )}
        </div>
      </div>

      <Card className="mb-6 p-6">
        <h3 className="mb-2 font-semibold text-slate-900">Description</h3>
        <p className="whitespace-pre-wrap text-sm text-slate-600">{job.description}</p>
      </Card>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card className="p-6">
          <h3 className="mb-3 font-semibold text-slate-900">Experience</h3>
          <p className="text-sm text-slate-600">
            {job.minimumExperience}+ years{job.maximumExperience ? ` – up to ${job.maximumExperience} years` : ''}
          </p>
        </Card>
        <Card className="p-6">
          <h3 className="mb-3 font-semibold text-slate-900">Education</h3>
          <p className="text-sm text-slate-600">
            {job.educationRequirements.length ? job.educationRequirements.join(', ') : 'No specific requirement'}
          </p>
        </Card>
      </div>

      <Card className="mt-6 p-6">
        <h3 className="mb-3 font-semibold text-slate-900">Required skills</h3>
        <SkillTags skills={job.requiredSkills} />
        <h3 className="mb-3 mt-5 font-semibold text-slate-900">Preferred skills</h3>
        <SkillTags skills={job.preferredSkills} tone="slate" />
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
