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
import ProfileSuggestionsPanel from '../../components/ui/ProfileSuggestionsPanel.jsx';

const GENDER_OPTIONS = [
  { value: '', label: 'Prefer not to say' },
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
];

const DEGREE_SUGGESTIONS = [
  'B.Tech in Computer Science and Technology',
  'B.Tech in Computer Engineering',
  'B.Tech in Information Technology',
  'BCA',
  'MCA',
  'MBA',
  'B.Sc. Computer Science',
  'Diploma in Computer Engineering',
];

function emptyForm(candidate) {
  return {
    fullName: candidate.fullName,
    phone: candidate.phone || '',
    location: candidate.location || '',
    headline: candidate.headline || '',
    skills: candidate.skills || [],
    gender: candidate.gender || '',
    university: candidate.university || '',
    college: candidate.college || '',
    degree: candidate.degree || '',
    academicStatus: candidate.academicStatus || 'COMPLETED',
    currentSemester: candidate.currentSemester ?? '',
    latestSpi: candidate.latestSpi ?? '',
  };
}

export default function ProfilePage() {
  const [candidate, setCandidate] = useState(null);
  const [resumes, setResumes] = useState([]);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [suggestions, setSuggestions] = useState(null);

  const load = () => {
    setError('');
    Promise.all([candidateProfileApi.get(), resumesApi.list()])
      .then(([profileRes, resumeRes]) => {
        setCandidate(profileRes.candidate);
        setForm(emptyForm(profileRes.candidate));
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
      const payload = {
        ...form,
        currentSemester: form.academicStatus === 'ONGOING' && form.currentSemester !== '' ? Number(form.currentSemester) : null,
        latestSpi: form.latestSpi !== '' ? Number(form.latestSpi) : null,
        gender: form.gender || null,
      };
      const { candidate } = await candidateProfileApi.update(payload);
      setCandidate(candidate);
      setForm(emptyForm(candidate));
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
    setSuggestions(null);
    try {
      const { resume, profileSuggestions } = await resumesApi.upload(file);
      setResumes((prev) => [resume, ...prev]);
      if (profileSuggestions) setSuggestions(profileSuggestions);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const applySuggestions = (accepted) => {
    setForm((prev) => ({
      ...prev,
      ...accepted,
      skills: accepted.skills ? Array.from(new Set([...prev.skills, ...accepted.skills])) : prev.skills,
    }));
    setSuggestions(null);
  };

  if (error && !candidate) return <ErrorState message={error} onRetry={load} />;
  if (!candidate || !form) return <LoadingState />;

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="mb-6 text-xl font-semibold text-slate-900">Profile</h2>

      <Card className="mb-6 p-6">
        {suggestions && (
          <ProfileSuggestionsPanel suggestions={suggestions} onApply={applySuggestions} onDismiss={() => setSuggestions(null)} />
        )}

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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Phone">
              <input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </FormField>
            <FormField label="Location">
              <input className={inputClass} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </FormField>
          </div>
          <FormField label="Gender">
            <select className={inputClass} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
              {GENDER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Skills">
            <TagInput value={form.skills} onChange={(v) => setForm({ ...form, skills: v })} placeholder="Type a skill and press Enter" />
          </FormField>

          <div className="mb-2 mt-6 border-t border-slate-100 pt-4">
            <h3 className="text-sm font-semibold text-slate-900">Academic information</h3>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="University">
              <input className={inputClass} value={form.university} onChange={(e) => setForm({ ...form, university: e.target.value })} />
            </FormField>
            <FormField label="College / Institute">
              <input className={inputClass} value={form.college} onChange={(e) => setForm({ ...form, college: e.target.value })} />
            </FormField>
          </div>
          <FormField label="Degree">
            <input
              className={inputClass}
              list="degree-suggestions"
              placeholder="e.g. B.Tech in Computer Science and Technology"
              value={form.degree}
              onChange={(e) => setForm({ ...form, degree: e.target.value })}
            />
            <datalist id="degree-suggestions">
              {DEGREE_SUGGESTIONS.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </FormField>

          <FormField label="Academic status">
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="academicStatus"
                  checked={form.academicStatus === 'ONGOING'}
                  onChange={() => setForm({ ...form, academicStatus: 'ONGOING' })}
                />
                Ongoing
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="academicStatus"
                  checked={form.academicStatus === 'COMPLETED'}
                  onChange={() => setForm({ ...form, academicStatus: 'COMPLETED', currentSemester: '' })}
                />
                Completed
              </label>
            </div>
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {form.academicStatus === 'ONGOING' && (
              <FormField label="Current semester">
                <input
                  type="number"
                  min={1}
                  max={12}
                  className={inputClass}
                  value={form.currentSemester}
                  onChange={(e) => setForm({ ...form, currentSemester: e.target.value })}
                />
              </FormField>
            )}
            <FormField label={form.academicStatus === 'ONGOING' ? 'Latest SPI' : 'Final SPI'}>
              <input
                type="number"
                min={0}
                max={10}
                step={0.01}
                className={inputClass}
                value={form.latestSpi}
                onChange={(e) => setForm({ ...form, latestSpi: e.target.value })}
              />
            </FormField>
          </div>

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
