import { useState } from 'react';
import FormField, { inputClass } from '../../components/ui/FormField.jsx';
import Button from '../../components/ui/Button.jsx';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_REGEX = /^https?:\/\/\S+\.\S+/i;

export const SIZE_OPTIONS = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'];

// Build plan P1 — shared by "Add company" and the company detail edit form.
// Single column on phones, two columns from sm up.
export default function CompanyForm({ initial = {}, withOwnerEmail = false, submitLabel, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    companyName: initial.name || '',
    ownerEmail: '',
    website: initial.website || '',
    industry: initial.industry || '',
    size: initial.size || '',
    location: initial.location || '',
    description: initial.description || '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.companyName.trim()) return setError('Company name is required');
    if (withOwnerEmail && !EMAIL_REGEX.test(form.ownerEmail.trim())) return setError('Enter a valid owner email');
    if (form.website.trim() && !URL_REGEX.test(form.website.trim())) {
      return setError('Website must start with http:// or https://');
    }

    const payload = {
      companyName: form.companyName.trim(),
      website: form.website.trim(),
      industry: form.industry.trim(),
      size: form.size,
      location: form.location.trim(),
      description: form.description.trim(),
      ...(withOwnerEmail ? { ownerEmail: form.ownerEmail.trim() } : {}),
    };

    setSaving(true);
    try {
      await onSubmit(payload);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FormField label="Company name *">
            <input className={`${inputClass} min-h-[44px]`} value={form.companyName} onChange={set('companyName')} placeholder="e.g. Acme Talent Partners" />
          </FormField>
        </div>
        {withOwnerEmail && (
          <div className="sm:col-span-2">
            <FormField label="Owner email *">
              <input
                type="email"
                inputMode="email"
                autoComplete="off"
                className={`${inputClass} min-h-[44px]`}
                value={form.ownerEmail}
                onChange={set('ownerEmail')}
                placeholder="owner@company.com"
              />
              <p className="mt-1 text-xs text-slate-500">We'll email this person a link to set their password.</p>
            </FormField>
          </div>
        )}
        <FormField label="Website">
          <input type="url" inputMode="url" className={`${inputClass} min-h-[44px]`} value={form.website} onChange={set('website')} placeholder="https://" />
        </FormField>
        <FormField label="Industry">
          <input className={`${inputClass} min-h-[44px]`} value={form.industry} onChange={set('industry')} placeholder="e.g. IT staffing" />
        </FormField>
        <FormField label="Company size">
          <select className={`${inputClass} min-h-[44px]`} value={form.size} onChange={set('size')}>
            <option value="">Not specified</option>
            {SIZE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s} employees
              </option>
            ))}
            {form.size && !SIZE_OPTIONS.includes(form.size) && <option value={form.size}>{form.size}</option>}
          </select>
        </FormField>
        <FormField label="Location">
          <input className={`${inputClass} min-h-[44px]`} value={form.location} onChange={set('location')} placeholder="e.g. Pune, India" />
        </FormField>
        <div className="sm:col-span-2">
          <FormField label="Description">
            <textarea rows={4} className={inputClass} value={form.description} onChange={set('description')} />
          </FormField>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel} className="w-full sm:w-auto">
            Cancel
          </Button>
        )}
        <Button type="submit" loading={saving} className="w-full sm:w-auto">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
