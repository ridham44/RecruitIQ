import { useState } from 'react';
// import { useNavigate } from 'react-router-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import ClientLinkFields, { clientLinkPayload, EMPTY_CLIENT_LINK } from './ClientLinkFields.jsx';
import { jobsApi } from '../../services/jobs.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import FormField, { inputClass } from '../../components/ui/FormField.jsx';
import TagInput from '../../components/ui/TagInput.jsx';
import { createJobSchema, extractJobDetailsSchema } from '../../../shared/schemas/job.schema.js';
import { AUTO_FILL_FIELDS } from '../../../shared/schemas/job-analysis.schema.js';
import { checkForm } from '../../../shared/schemas/common.js';

// Fields that live in the collapsible "More details" section.
const MORE_FIELDS = [
  'workMode', 'openings', 'jobLevel', 'noticePeriod', 'salaryRange', 'employmentType', 'minimumExperience',
  'maximumExperience', 'location', 'requiredSkills', 'preferredSkills', 'languagesRequired', 'certifications',
  'educationRequirements',
];

// First error for a field, including nested ones like "requiredSkills.2".
function errorFor(errors, key) {
  if (errors[key]) return errors[key];
  const hit = Object.keys(errors).find((p) => p.startsWith(`${key}.`));
  return hit ? errors[hit] : undefined;
}

const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE'];
const WORK_MODES = ['On-site', 'Remote', 'Hybrid'];
const JOB_LEVELS = ['Junior', 'Mid', 'Senior', 'Lead'];
const NOTICE_PERIODS = ['Immediate', '15 days', '30 days', '60 days', '90 days'];

export default function JobNewPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({
    title: '',
    description: '',
    workMode: 'On-site',
    openings: 1,
    jobLevel: 'Mid',
    noticePeriod: '30 days',
    salaryRange: '',
    minimumExperience: 0,
    maximumExperience: '',
    location: '',
    employmentType: 'FULL_TIME',
    requiredSkills: [],
    preferredSkills: [],
    educationRequirements: [],
    languagesRequired: [],
    certifications: [],
  });
  // Fields the user changed by hand (never overwritten by the AI) and fields
  // the "Auto-fill from description" button filled in.
  const [touched, setTouched] = useState(() => new Set());
  const [aiFilled, setAiFilled] = useState(() => new Set());
  const [extracting, setExtracting] = useState(false);
  const [extractNote, setExtractNote] = useState(null);
  const setField = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setTouched((t) => new Set(t).add(key));
    setAiFilled((a) => {
      if (!a.has(key)) return a;
      const next = new Set(a);
      next.delete(key);
      return next;
    });
  };
  const fromAi = (key) => (aiFilled.has(key) ? 'Filled from the description — change it if needed' : undefined);

  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const fe = (key) => errorFor(fieldErrors, key);
  const [loading, setLoading] = useState(false);
  // Build plan P3: ?clientId= pre-selects a client (e.g. from the client page).
  const [clientLink, setClientLink] = useState({ ...EMPTY_CLIENT_LINK, clientCompanyId: searchParams.get('clientId') || '' });
  const [showMore, setShowMore] = useState(false);

  const canExtract = form.title.trim().length > 0 && form.description.trim().length >= 30;

  const autoFill = async () => {
    setExtractNote(null);
    const { data, errors } = checkForm(extractJobDetailsSchema, { title: form.title, description: form.description });
    if (!data) {
      setFieldErrors(errors);
      return;
    }
    setExtracting(true);
    try {
      const result = await jobsApi.extract(data);
      const filled = new Set();
      const next = { ...form };
      for (const [key, value] of Object.entries(result.fields || {})) {
        if (touched.has(key)) continue;
        next[key] = value;
        filled.add(key);
      }
      for (const key of ['requiredSkills', 'preferredSkills']) {
        const extra = (result[key] || []).filter((s) => !next[key].some((x) => x.toLowerCase() === s.toLowerCase()));
        if (extra.length) {
          next[key] = [...next[key], ...extra];
          filled.add(key);
        }
      }
      setForm(next);
      setAiFilled(filled);
      setShowMore(true);
      setExtractNote(
        filled.size
          ? { ok: true, text: `Filled ${filled.size} field${filled.size === 1 ? '' : 's'} from the description. Check them below and change anything that's wrong.` }
          : { ok: false, text: "The description doesn't mention any more details — fill them in below if you want." },
      );
    } catch (err) {
      setExtractNote({ ok: false, text: err.message || "Couldn't read the description. Fill in the details below." });
    } finally {
      setExtracting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const payload = {
      ...form,
      // Untouched fields are filled from the description on the server.
      autoFillFields: AUTO_FILL_FIELDS.filter((k) => !touched.has(k) && !aiFilled.has(k)),
      openings: form.openings === '' ? '' : Number(form.openings),
      maximumExperience: form.maximumExperience === '' ? null : Number(form.maximumExperience),
      minimumExperience: form.minimumExperience === '' ? 0 : Number(form.minimumExperience),
      salaryRange: form.salaryRange?.trim() || null,
      noticePeriod: form.noticePeriod?.trim() || null,
      ...clientLinkPayload(clientLink),
    };
    const { data, errors } = checkForm(createJobSchema, payload);
    setFieldErrors(errors);
    if (!data) {
      if (Object.keys(errors).some((k) => MORE_FIELDS.includes(k.split('.')[0]))) setShowMore(true);
      return setError('Please fix the highlighted fields');
    }
    setLoading(true);
    try {
      const { job } = await jobsApi.create(data);
      navigate(`/company/jobs/${job.id}`);
    } catch (err) {
      const fields = err.fields || {};
      setFieldErrors(fields);
      if (Object.keys(fields).some((k) => MORE_FIELDS.includes(k.split('.')[0]))) setShowMore(true);
      setError(Object.keys(fields).length ? 'Please fix the highlighted fields' : err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="mb-6 text-xl font-semibold text-slate-900">Create a job</h2>
      <Card className="p-6">
        <form onSubmit={handleSubmit}>
          <FormField label="Job title" error={fe('title')}>
            <input
              required
              className={inputClass}
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
              placeholder="e.g. React Developer"
              maxLength={200}
            />
          </FormField>

          <FormField label="Description" error={fe('description')} hint="At least 30 characters">
            <textarea
              required
              rows={6}
              className={inputClass}
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              placeholder="Describe the role: responsibilities, skills, experience, education, location, work mode, salary, notice period… Anything you write here can fill the details below."
              minLength={30}
              maxLength={20000}
            />
          </FormField>

          <div className="-mt-2 mb-4">
            <Button
              type="button"
              variant="secondary"
              onClick={autoFill}
              loading={extracting}
              disabled={!canExtract || extracting}
              className="w-full sm:w-auto"
            >
              <Sparkles className="h-4 w-4" />
              Auto-fill details from description
            </Button>
            <p className="mt-1.5 text-xs text-slate-500">
              {canExtract
                ? "Fills the details below from your description. Anything you've already set yourself is kept. Details you leave untouched are also filled when you publish."
                : 'Add a title and a description (at least 30 characters) to auto-fill the details.'}
            </p>
            {extractNote && (
              <p role="status" className={`mt-2 text-sm ${extractNote.ok ? 'text-emerald-700' : 'text-amber-700'}`}>
                {extractNote.text}
              </p>
            )}
          </div>

          {/* Build plan P3 (§5): optional Client → Department → HR link */}
          <ClientLinkFields value={clientLink} onChange={setClientLink} />
          {(fe('clientCompanyId') || fe('departmentId') || fe('hiringPersonId')) && (
            <p role="alert" className="-mt-2 mb-4 text-xs text-red-600">
              {fe('clientCompanyId') || fe('departmentId') || fe('hiringPersonId')}
            </p>
          )}

          {/* Build plan P3 (§5): a job only needs a title + description; the
              structured fields below are optional and have sensible defaults. */}
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            aria-expanded={showMore}
            className="mb-4 flex min-h-[44px] w-full items-center justify-between rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <span>More details (optional — filled from the description when you leave them)</span>
            {showMore ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showMore && (
          <div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Work mode" error={fe('workMode')} hint={fromAi('workMode')}>
              <select
                className={inputClass}
                value={form.workMode}
                onChange={(e) => setField('workMode', e.target.value)}
              >
                {WORK_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Number of openings (required)" error={fe('openings')} hint={fromAi('openings')}>
              <input
                type="number"
                required
                min={1}
                max={1000}
                step={1}
                className={inputClass}
                value={form.openings}
                onChange={(e) => setField('openings', e.target.value)}
                placeholder="e.g. 3"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Job level" error={fe('jobLevel')} hint={fromAi('jobLevel')}>
              <select
                className={inputClass}
                value={form.jobLevel}
                onChange={(e) => setField('jobLevel', e.target.value)}
              >
                {JOB_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Notice period" error={fe('noticePeriod')} hint={fromAi('noticePeriod')}>
              <select
                className={inputClass}
                value={form.noticePeriod}
                onChange={(e) => setField('noticePeriod', e.target.value)}
              >
                {(NOTICE_PERIODS.includes(form.noticePeriod) || !form.noticePeriod ? NOTICE_PERIODS : [...NOTICE_PERIODS, form.noticePeriod]).map((np) => (
                  <option key={np} value={np}>
                    {np}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Salary range" error={fe('salaryRange')} hint={fromAi('salaryRange')}>
              <input
                className={inputClass}
                value={form.salaryRange}
                onChange={(e) => setField('salaryRange', e.target.value)}
                placeholder="e.g. ₹6–10 LPA"
                maxLength={60}
              />
            </FormField>

            <FormField label="Employment type" error={fe('employmentType')} hint={fromAi('employmentType')}>
              <select
                className={inputClass}
                value={form.employmentType}
                onChange={(e) => setField('employmentType', e.target.value)}
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
            <FormField label="Minimum experience (years)" error={fe('minimumExperience')} hint={fromAi('minimumExperience')}>
              <input
                type="number"
                min={0}
                max={50}
                step={0.5}
                className={inputClass}
                value={form.minimumExperience}
                onChange={(e) => setField('minimumExperience', e.target.value)}
              />
            </FormField>
            <FormField label="Maximum experience (years, optional)" error={fe('maximumExperience')} hint={fromAi('maximumExperience')}>
              <input
                type="number"
                min={0}
                max={50}
                step={0.5}
                className={inputClass}
                value={form.maximumExperience}
                onChange={(e) => setField('maximumExperience', e.target.value)}
              />
            </FormField>
          </div>

          <FormField label="Location" error={fe('location')} hint={fromAi('location')}>
            <input
              className={inputClass}
              value={form.location}
              onChange={(e) => setField('location', e.target.value)}
              placeholder="e.g. Ahmedabad, Gujarat / Remote"
              maxLength={200}
            />
          </FormField>

          <FormField label="Required skills" error={fe('requiredSkills')} hint={fromAi('requiredSkills')}>
            <TagInput
              value={form.requiredSkills}
              onChange={(v) => setField('requiredSkills', v)}
              placeholder="Type a skill and press Enter (e.g. React, JavaScript)"
            />
          </FormField>

          <FormField label="Preferred skills" error={fe('preferredSkills')} hint={fromAi('preferredSkills')}>
            <TagInput
              value={form.preferredSkills}
              onChange={(v) => setField('preferredSkills', v)}
              placeholder="Type a skill and press Enter (e.g. TypeScript, Redux)"
            />
          </FormField>

          <FormField label="Languages required" error={fe('languagesRequired')} hint={fromAi('languagesRequired')}>
            <TagInput
              value={form.languagesRequired}
              onChange={(v) => setField('languagesRequired', v)}
              placeholder="Type a language and press Enter (e.g. English, Hindi)"
            />
          </FormField>

          <FormField label="Certifications" error={fe('certifications')} hint={fromAi('certifications')}>
            <TagInput
              value={form.certifications}
              onChange={(v) => setField('certifications', v)}
              placeholder="Type a certification and press Enter (e.g. AWS, Azure, PMP)"
            />
          </FormField>

          <FormField label="Education requirements" error={fe('educationRequirements')} hint={fromAi('educationRequirements')}>
            <TagInput
              value={form.educationRequirements}
              onChange={(v) => setField('educationRequirements', v)}
              placeholder="e.g. B.Tech Computer Science, BCA"
            />
          </FormField>
          </div>
          )}

          {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              Publish job
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
