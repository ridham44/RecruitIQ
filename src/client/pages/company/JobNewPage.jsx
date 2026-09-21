import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jobsApi } from '../../services/jobs.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import FormField, { inputClass } from '../../components/ui/FormField.jsx';
import TagInput from '../../components/ui/TagInput.jsx';

const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE'];

export default function JobNewPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '',
    description: '',
    minimumExperience: 0,
    maximumExperience: '',
    location: '',
    employmentType: 'FULL_TIME',
    requiredSkills: [],
    preferredSkills: [],
    educationRequirements: [],
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { job } = await jobsApi.create({
        ...form,
        maximumExperience: form.maximumExperience === '' ? null : Number(form.maximumExperience),
        minimumExperience: Number(form.minimumExperience),
      });
      navigate(`/company/jobs/${job.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="mb-6 text-xl font-semibold text-slate-900">Create a job</h2>
      <Card className="p-6">
        <form onSubmit={handleSubmit}>
          <FormField label="Job title">
            <input
              required
              className={inputClass}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. React Developer"
            />
          </FormField>

          <FormField label="Description">
            <textarea
              required
              rows={6}
              className={inputClass}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describe the role, responsibilities, and requirements. Our AI will also extract structured requirements from this text."
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
            <FormField label="Maximum experience (years, optional)">
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

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Location">
              <input
                className={inputClass}
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Remote / City"
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

          <FormField label="Required skills">
            <TagInput
              value={form.requiredSkills}
              onChange={(v) => setForm({ ...form, requiredSkills: v })}
              placeholder="Type a skill and press Enter"
            />
          </FormField>

          <FormField label="Preferred skills">
            <TagInput
              value={form.preferredSkills}
              onChange={(v) => setForm({ ...form, preferredSkills: v })}
              placeholder="Type a skill and press Enter"
            />
          </FormField>

          <FormField label="Education requirements">
            <TagInput
              value={form.educationRequirements}
              onChange={(v) => setForm({ ...form, educationRequirements: v })}
              placeholder="e.g. Computer Science"
            />
          </FormField>

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
