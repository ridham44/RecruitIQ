import { useEffect, useState } from 'react';
import FormField, { inputClass } from '../../components/ui/FormField.jsx';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_REGEX = /^https?:\/\/\S+\.\S+/i;

export const EMPTY_CLIENT = {
  name: '',
  industry: '',
  website: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  address: '',
  description: '',
};

export function clientToForm(client) {
  return Object.fromEntries(Object.keys(EMPTY_CLIENT).map((k) => [k, client?.[k] || '']));
}

// Returns an error message, or '' when the form is valid.
export function validateClientForm(form) {
  if (!form.name.trim()) return 'Company name is required';
  if (form.website.trim() && !URL_REGEX.test(form.website.trim())) return 'Website must start with http:// or https://';
  if (form.contactEmail.trim() && !EMAIL_REGEX.test(form.contactEmail.trim())) return 'Enter a valid contact email';
  return '';
}

export function trimClientForm(form) {
  return Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()]));
}

// Build plan P3 — client company fields. Single column on phones, two from sm.
export default function ClientForm({ value, onChange }) {
  const [form, setForm] = useState(value);
  useEffect(() => setForm(value), [value]);
  const set = (key) => (e) => {
    const next = { ...form, [key]: e.target.value };
    setForm(next);
    onChange(next);
  };
  const cls = `${inputClass} min-h-[44px]`;

  return (
    <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <FormField label="Company name *">
          <input className={cls} value={form.name} onChange={set('name')} placeholder="e.g. Infosys" />
        </FormField>
      </div>
      <FormField label="Industry">
        <input className={cls} value={form.industry} onChange={set('industry')} placeholder="e.g. IT services" />
      </FormField>
      <FormField label="Website">
        <input type="url" inputMode="url" className={cls} value={form.website} onChange={set('website')} placeholder="https://" />
      </FormField>
      <FormField label="Contact person">
        <input className={cls} value={form.contactName} onChange={set('contactName')} />
      </FormField>
      <FormField label="Contact email">
        <input type="email" inputMode="email" className={cls} value={form.contactEmail} onChange={set('contactEmail')} />
      </FormField>
      <FormField label="Contact phone">
        <input type="tel" inputMode="tel" className={cls} value={form.contactPhone} onChange={set('contactPhone')} />
      </FormField>
      <FormField label="Address">
        <input className={cls} value={form.address} onChange={set('address')} />
      </FormField>
      <div className="sm:col-span-2">
        <FormField label="Description">
          <textarea rows={3} className={inputClass} value={form.description} onChange={set('description')} />
        </FormField>
      </div>
    </div>
  );
}
