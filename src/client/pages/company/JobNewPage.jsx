import { useState } from 'react';
// import { useNavigate } from 'react-router-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronUp } from 'lucide-react';
import ClientLinkFields, { clientLinkPayload, EMPTY_CLIENT_LINK } from './ClientLinkFields.jsx';
import { jobsApi } from '../../services/jobs.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import FormField, { inputClass } from '../../components/ui/FormField.jsx';
import TagInput from '../../components/ui/TagInput.jsx';
import { createJobSchema } from '../../../shared/schemas/job.schema.js';
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
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const fe = (key) => errorFor(fieldErrors, key);
  const [loading, setLoading] = useState(false);
  // Build plan P3: ?clientId= pre-selects a client (e.g. from the client page).
  const [clientLink, setClientLink] = useState({ ...EMPTY_CLIENT_LINK, clientCompanyId: searchParams.get('clientId') || '' });
  const [showMore, setShowMore] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const payload = {
      ...form,
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
              onChange={(e) => setForm({ ...form, title: e.target.value })}
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
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describe the role, responsibilities, and requirements. Our AI will also extract structured requirements from this text."
              minLength={30}
              maxLength={20000}
            />
          </FormField>

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
            <span>More details (optional)</span>
            {showMore ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showMore && (
          <div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Work mode" error={fe('workMode')}>
              <select
                className={inputClass}
                value={form.workMode}
                onChange={(e) => setForm({ ...form, workMode: e.target.value })}
              >
                {WORK_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Number of openings (required)" error={fe('openings')}>
              <input
                type="number"
                required
                min={1}
                max={1000}
                step={1}
                className={inputClass}
                value={form.openings}
                onChange={(e) => setForm({ ...form, openings: e.target.value })}
                placeholder="e.g. 3"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Job level" error={fe('jobLevel')}>
              <select
                className={inputClass}
                value={form.jobLevel}
                onChange={(e) => setForm({ ...form, jobLevel: e.target.value })}
              >
                {JOB_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Notice period" error={fe('noticePeriod')}>
              <select
                className={inputClass}
                value={form.noticePeriod}
                onChange={(e) => setForm({ ...form, noticePeriod: e.target.value })}
              >
                {NOTICE_PERIODS.map((np) => (
                  <option key={np} value={np}>
                    {np}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Salary range" error={fe('salaryRange')}>
              <input
                className={inputClass}
                value={form.salaryRange}
                onChange={(e) => setForm({ ...form, salaryRange: e.target.value })}
                placeholder="e.g. ₹6–10 LPA"
                maxLength={60}
              />
            </FormField>

            <FormField label="Employment type" error={fe('employmentType')}>
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
            <FormField label="Minimum experience (years)" error={fe('minimumExperience')}>
              <input
                type="number"
                min={0}
                max={50}
                step={0.5}
                className={inputClass}
                value={form.minimumExperience}
                onChange={(e) => setForm({ ...form, minimumExperience: e.target.value })}
              />
            </FormField>
            <FormField label="Maximum experience (years, optional)" error={fe('maximumExperience')}>
              <input
                type="number"
                min={0}
                max={50}
                step={0.5}
                className={inputClass}
                value={form.maximumExperience}
                onChange={(e) => setForm({ ...form, maximumExperience: e.target.value })}
              />
            </FormField>
          </div>

          <FormField label="Location" error={fe('location')}>
            <input
              className={inputClass}
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="e.g. Ahmedabad, Gujarat / Remote"
              maxLength={200}
            />
          </FormField>

          <FormField label="Required skills" error={fe('requiredSkills')}>
            <TagInput
              value={form.requiredSkills}
              onChange={(v) => setForm({ ...form, requiredSkills: v })}
              placeholder="Type a skill and press Enter (e.g. React, JavaScript)"
            />
          </FormField>

          <FormField label="Preferred skills" error={fe('preferredSkills')}>
            <TagInput
              value={form.preferredSkills}
              onChange={(v) => setForm({ ...form, preferredSkills: v })}
              placeholder="Type a skill and press Enter (e.g. TypeScript, Redux)"
            />
          </FormField>

          <FormField label="Languages required" error={fe('languagesRequired')}>
            <TagInput
              value={form.languagesRequired}
              onChange={(v) => setForm({ ...form, languagesRequired: v })}
              placeholder="Type a language and press Enter (e.g. English, Hindi)"
            />
          </FormField>

          <FormField label="Certifications" error={fe('certifications')}>
            <TagInput
              value={form.certifications}
              onChange={(v) => setForm({ ...form, certifications: v })}
              placeholder="Type a certification and press Enter (e.g. AWS, Azure, PMP)"
            />
          </FormField>

          <FormField label="Education requirements" error={fe('educationRequirements')}>
            <TagInput
              value={form.educationRequirements}
              onChange={(v) => setForm({ ...form, educationRequirements: v })}
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
