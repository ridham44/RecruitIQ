import { useState } from 'react';
import FormField, { inputClass } from '../../components/ui/FormField.jsx';
import Button from '../../components/ui/Button.jsx';
import { adminCreateCompanySchema, adminUpdateCompanySchema } from '../../../shared/schemas/admin.schema.js';
import { checkForm } from '../../../shared/schemas/common.js';

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
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const cls = `${inputClass} min-h-[44px]`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const { ownerEmail, ...fields } = form;
    const { data, errors } = withOwnerEmail
      ? checkForm(adminCreateCompanySchema, { ...fields, ownerEmail })
      : checkForm(adminUpdateCompanySchema, fields);
    setFieldErrors(errors);
    if (!data) return setError(errors._form || 'Please fix the highlighted fields');

    setSaving(true);
    try {
      await onSubmit(data);
    } catch (err) {
      setFieldErrors(err.fields || {});
      setError(Object.keys(err.fields || {}).length ? 'Please fix the highlighted fields' : err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FormField label="Agency name *" error={fieldErrors.companyName}>
            <input className={cls} value={form.companyName} onChange={set('companyName')} placeholder="e.g. Acme Talent Partners" autoComplete="organization" maxLength={200} />
          </FormField>
        </div>
        {withOwnerEmail && (
          <div className="sm:col-span-2">
            <FormField label="Agency owner email *" error={fieldErrors.ownerEmail} hint="We'll email this person a link to set their password.">
              <input
                type="email"
                inputMode="email"
                autoComplete="off"
                className={cls}
                value={form.ownerEmail}
                onChange={set('ownerEmail')}
                placeholder="owner@agency.com"
                maxLength={254}
              />
            </FormField>
          </div>
        )}
        <FormField label="Website" error={fieldErrors.website}>
          <input type="url" inputMode="url" className={cls} value={form.website} onChange={set('website')} placeholder="https://example.com" maxLength={500} />
        </FormField>
        <FormField label="Industry" error={fieldErrors.industry}>
          <input className={cls} value={form.industry} onChange={set('industry')} placeholder="e.g. IT staffing" maxLength={120} />
        </FormField>
        <FormField label="Agency size" error={fieldErrors.size}>
          <select className={cls} value={form.size} onChange={set('size')}>
            <option value="">Not specified</option>
            {SIZE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s} employees
              </option>
            ))}
            {form.size && !SIZE_OPTIONS.includes(form.size) && <option value={form.size}>{form.size}</option>}
          </select>
        </FormField>
        <FormField label="Location" error={fieldErrors.location}>
          <input className={cls} value={form.location} onChange={set('location')} placeholder="e.g. Pune, India" maxLength={200} />
        </FormField>
        <div className="sm:col-span-2">
          <FormField label="Description" error={fieldErrors.description}>
            <textarea rows={4} className={inputClass} value={form.description} onChange={set('description')} maxLength={4000} />
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
