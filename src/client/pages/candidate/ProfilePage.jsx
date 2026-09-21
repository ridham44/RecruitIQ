import { useEffect, useState } from 'react';
import { Upload, FileText } from 'lucide-react';
import { candidateProfileApi } from '../../services/profile.js';
import { resumesApi } from '../../services/resumes.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import FormField, { inputClass } from '../../components/ui/FormField.jsx';
import TagInput from '../../components/ui/TagInput.jsx';
import LoadingState from '../../components/ui/LoadingState.jsx';
import ErrorState from '../../components/ui/ErrorState.jsx';

export default function ProfilePage() {
  const [candidate, setCandidate] = useState(null);
  const [resumes, setResumes] = useState([]);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = () => {
    setError('');
    Promise.all([candidateProfileApi.get(), resumesApi.list()])
      .then(([profileRes, resumeRes]) => {
        setCandidate(profileRes.candidate);
        setForm({
          fullName: profileRes.candidate.fullName,
          phone: profileRes.candidate.phone || '',
          location: profileRes.candidate.location || '',
          headline: profileRes.candidate.headline || '',
          skills: profileRes.candidate.skills || [],
        });
        setResumes(resumeRes.resumes);
      })
      .catch((err) => setError(err.message));
  };

  useEffect(load, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const { candidate } = await candidateProfileApi.update(form);
      setCandidate(candidate);
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const { resume } = await resumesApi.upload(file);
      setResumes((prev) => [resume, ...prev]);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  if (error && !candidate) return <ErrorState message={error} onRetry={load} />;
  if (!candidate || !form) return <LoadingState />;

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="mb-6 text-xl font-semibold text-slate-900">Profile</h2>

      <Card className="mb-6 p-6">
        <form onSubmit={handleSave}>
          <FormField label="Full name">
            <input required className={inputClass} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </FormField>
          <FormField label="Headline">
            <input
              className={inputClass}
              placeholder="e.g. Frontend Developer"
              value={form.headline}
              onChange={(e) => setForm({ ...form, headline: e.target.value })}
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Phone">
              <input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </FormField>
            <FormField label="Location">
              <input className={inputClass} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </FormField>
          </div>
          <FormField label="Skills">
            <TagInput value={form.skills} onChange={(v) => setForm({ ...form, skills: v })} placeholder="Type a skill and press Enter" />
          </FormField>
          {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
          {saved && <p className="mb-4 text-sm text-emerald-600">Profile updated</p>}
          <Button type="submit" loading={saving}>
            Save changes
          </Button>
        </form>
      </Card>

      <Card className="p-6">
        <h3 className="mb-3 font-semibold text-slate-900">Resumes</h3>
        <label className="mb-4 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 py-4 text-sm text-slate-500 hover:border-brand-400 hover:text-brand-600">
          <Upload className="h-4 w-4" />
          {uploading ? 'Uploading…' : 'Upload a resume (PDF or DOCX)'}
          <input type="file" accept=".pdf,.docx" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
        {resumes.length === 0 ? (
          <p className="text-sm text-slate-400">No resumes uploaded yet</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {resumes.map((resume) => (
              <li key={resume.id} className="flex items-center justify-between py-2 text-sm">
                <span className="flex items-center gap-2 text-slate-700">
                  <FileText className="h-4 w-4 text-slate-400" /> {resume.fileName}
                </span>
                {resume.isPrimary && <span className="text-xs font-medium text-brand-600">Primary</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
