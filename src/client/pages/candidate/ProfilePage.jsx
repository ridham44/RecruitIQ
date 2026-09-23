import { useEffect, useState } from 'react';
import { Upload, FileText, Plus, Trash2, GraduationCap, ChevronDown, ChevronUp } from 'lucide-react';
import { candidateProfileApi, educationApi } from '../../services/profile.js';
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

const DEGREE_PRESETS = [
  "B.Tech / B.E.",
  "BCA",
  "B.Sc.",
  "B.Com",
  "BA",
  "M.Tech / M.E.",
  "MCA",
  "MBA",
  "M.Sc.",
  "PhD",
  "Diploma",
  "12th / HSC",
  "10th / SSC",
];

function emptyEducation() {
  return {
    _localId: crypto.randomUUID(),
    id: null,          // null = not yet saved to DB
    degree: '',
    fieldOfStudy: '',
    institution: '',
    startYear: '',
    endYear: '',
    isCurrentlyStudying: false,
    grade: '',
    saving: false,
    saved: false,
    error: '',
    collapsed: false,
  };
}

function fromDbEducation(edu) {
  return {
    _localId: edu.id,
    id: edu.id,
    degree: edu.degree ?? '',
    fieldOfStudy: edu.fieldOfStudy ?? '',
    institution: edu.institution ?? '',
    startYear: edu.startYear ?? '',
    endYear: edu.endYear ?? '',
    isCurrentlyStudying: edu.isCurrentlyStudying ?? false,
    grade: edu.grade ?? '',
    saving: false,
    saved: false,
    error: '',
    collapsed: false,
  };
}

/** Single education entry card */
function EducationCard({ entry, onChange, onSave, onDelete }) {
  const isNew = !entry.id;

  const set = (field, value) => onChange({ ...entry, [field]: value });

  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <button
        type="button"
        onClick={() => set('collapsed', !entry.collapsed)}
        className="flex w-full items-center justify-between rounded-xl px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-brand-50 p-2">
            <GraduationCap className="h-4 w-4 text-brand-600" />
          </div>
          <div>
            <p className="font-medium text-slate-900">
              {entry.degree || <span className="italic text-slate-400">New education</span>}
            </p>
            {entry.institution && (
              <p className="text-xs text-slate-500">{entry.institution}</p>
            )}
          </div>
        </div>
        {entry.collapsed ? (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronUp className="h-4 w-4 text-slate-400" />
        )}
      </button>

      {/* Body */}
      {!entry.collapsed && (
        <div className="border-t border-slate-100 px-5 pb-5 pt-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Degree / Qualification">
              <input
                className={inputClass}
                list={`degree-list-${entry._localId}`}
                placeholder="e.g. B.Tech, MBA, Diploma"
                value={entry.degree}
                onChange={(e) => set('degree', e.target.value)}
              />
              <datalist id={`degree-list-${entry._localId}`}>
                {DEGREE_PRESETS.map((d) => <option key={d} value={d} />)}
              </datalist>
            </FormField>
            <FormField label="Field of Study / Specialization">
              <input
                className={inputClass}
                placeholder="e.g. Computer Science"
                value={entry.fieldOfStudy}
                onChange={(e) => set('fieldOfStudy', e.target.value)}
              />
            </FormField>
          </div>

          <FormField label="University / Institution">
            <input
              className={inputClass}
              placeholder="e.g. LJ University"
              value={entry.institution}
              onChange={(e) => set('institution', e.target.value)}
            />
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField label="Start Year">
              <input
                type="number"
                min={1900}
                max={2100}
                className={inputClass}
                placeholder="e.g. 2020"
                value={entry.startYear}
                onChange={(e) => set('startYear', e.target.value)}
              />
            </FormField>
            <FormField label="End Year">
              <input
                type="number"
                min={1900}
                max={2100}
                className={inputClass}
                placeholder="e.g. 2024"
                value={entry.endYear}
                disabled={entry.isCurrentlyStudying}
                onChange={(e) => set('endYear', e.target.value)}
              />
            </FormField>
            <FormField label="Grade / CGPA / %">
              <input
                className={inputClass}
                placeholder="e.g. 7.42 CGPA"
                value={entry.grade}
                onChange={(e) => set('grade', e.target.value)}
              />
            </FormField>
          </div>

          {/* Currently Studying toggle — the whole row (dial + label text) is
              the click target, not just the small dial, so it's easy to hit
              on touch screens and actually responds when tapped. */}
          <label
            className="mb-4 flex cursor-pointer select-none items-center gap-3 py-1 text-sm text-slate-700"
            onClick={() => {
              set('isCurrentlyStudying', !entry.isCurrentlyStudying);
              if (!entry.isCurrentlyStudying) set('endYear', '');
            }}
          >
            <span
              role="switch"
              aria-checked={entry.isCurrentlyStudying}
              className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${
                entry.isCurrentlyStudying ? 'bg-brand-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
                  entry.isCurrentlyStudying ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </span>
            Currently studying here
          </label>

          {entry.error && <p className="mb-3 text-sm text-red-600">{entry.error}</p>}
          {entry.saved && <p className="mb-3 text-sm text-emerald-600">Saved ✓</p>}

          <div className="flex items-center gap-3">
            <Button
              type="button"
              loading={entry.saving}
              onClick={() => onSave(entry)}
            >
              {isNew ? 'Add Education' : 'Save'}
            </Button>
            {!isNew && (
              <button
                type="button"
                onClick={() => onDelete(entry)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-red-500 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function emptyForm(candidate) {
  return {
    fullName: candidate.fullName,
    phone: candidate.phone || '',
    location: candidate.location || '',
    headline: candidate.headline || '',
    skills: candidate.skills || [],
    gender: candidate.gender || '',
  };
}

export default function ProfilePage() {
  const [candidate, setCandidate] = useState(null);
  const [resumes, setResumes] = useState([]);
  const [form, setForm] = useState(null);
  const [educations, setEducations] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [suggestions, setSuggestions] = useState(null);

  const load = () => {
    setError('');
    Promise.all([candidateProfileApi.get(), resumesApi.list(), educationApi.list()])
      .then(([profileRes, resumeRes, eduRes]) => {
        setCandidate(profileRes.candidate);
        setForm(emptyForm(profileRes.candidate));
        setResumes(resumeRes.resumes);
        setEducations((eduRes.educations ?? []).map(fromDbEducation));
      })
      .catch((err) => setError(err.message));
  };

  useEffect(load, []);

  // ── Profile save ──────────────────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const payload = {
        ...form,
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

  // ── Resume upload ─────────────────────────────────────────────
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

  // ── Education helpers ─────────────────────────────────────────
  const updateEntry = (updated) => {
    setEducations((prev) =>
      prev.map((e) => (e._localId === updated._localId ? updated : e)),
    );
  };

  const handleSaveEducation = async (entry) => {
    updateEntry({ ...entry, saving: true, saved: false, error: '' });
    try {
      const payload = {
        degree: entry.degree || undefined,
        fieldOfStudy: entry.fieldOfStudy || null,
        institution: entry.institution || null,
        startYear: entry.startYear !== '' ? Number(entry.startYear) : null,
        endYear: entry.isCurrentlyStudying || entry.endYear === '' ? null : Number(entry.endYear),
        isCurrentlyStudying: entry.isCurrentlyStudying,
        grade: entry.grade || null,
      };

      if (!entry.id) {
        // Create new
        const { education } = await educationApi.add(payload);
        setEducations((prev) =>
          prev.map((e) =>
            e._localId === entry._localId
              ? { ...fromDbEducation(education), saved: true, collapsed: false }
              : e,
          ),
        );
      } else {
        // Update existing
        const { education } = await educationApi.update(entry.id, payload);
        setEducations((prev) =>
          prev.map((e) =>
            e._localId === entry._localId
              ? { ...fromDbEducation(education), saved: true, collapsed: false }
              : e,
          ),
        );
      }
    } catch (err) {
      updateEntry({ ...entry, saving: false, error: err.message });
    }
  };

  const handleDeleteEducation = async (entry) => {
    if (!entry.id) {
      // Not saved yet — just remove from local state
      setEducations((prev) => prev.filter((e) => e._localId !== entry._localId));
      return;
    }
    updateEntry({ ...entry, saving: true });
    try {
      await educationApi.remove(entry.id);
      setEducations((prev) => prev.filter((e) => e._localId !== entry._localId));
    } catch (err) {
      updateEntry({ ...entry, saving: false, error: err.message });
    }
  };

  const addNewEducation = () => {
    setEducations((prev) => [...prev, emptyEducation()]);
  };

  // ─────────────────────────────────────────────────────────────
  if (error && !candidate) return <ErrorState message={error} onRetry={load} />;
  if (!candidate || !form) return <LoadingState />;

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="mb-6 text-xl font-semibold text-slate-900">Profile</h2>

      {/* ── Personal Information ─────────────────────────────── */}
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
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Skills">
            <TagInput value={form.skills} onChange={(v) => setForm({ ...form, skills: v })} placeholder="Type a skill and press Enter" />
          </FormField>

          {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
          {saved && <p className="mb-4 text-sm text-emerald-600">Profile updated</p>}
          <Button type="submit" loading={saving}>Save changes</Button>
        </form>
      </Card>

      {/* ── Academic Information ──────────────────────────────── */}
      <div className="mb-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Academic Information</h3>
          <span className="text-xs text-slate-400">{educations.length} record{educations.length !== 1 ? 's' : ''}</span>
        </div>

        {educations.length === 0 && (
          <p className="mb-4 text-sm text-slate-400">No education records yet. Click below to add one.</p>
        )}

        {educations.map((entry) => (
          <EducationCard
            key={entry._localId}
            entry={entry}
            onChange={updateEntry}
            onSave={handleSaveEducation}
            onDelete={handleDeleteEducation}
          />
        ))}

        <button
          type="button"
          onClick={addNewEducation}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-3 text-sm font-medium text-slate-500 transition-colors hover:border-brand-400 hover:text-brand-600"
        >
          <Plus className="h-4 w-4" />
          Add Education
        </button>
      </div>

      {/* ── Resumes ───────────────────────────────────────────── */}
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
