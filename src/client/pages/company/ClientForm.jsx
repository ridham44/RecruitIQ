import { useEffect, useState } from 'react';
import FormField, { inputClass } from '../../components/ui/FormField.jsx';
import { createClientSchema } from '../../../shared/schemas/client.schema.js';
import { checkForm } from '../../../shared/schemas/common.js';

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

// Same rules as the server: { data } when valid, else { errors: { field: message } }.
export function validateClientForm(form) {
  return checkForm(createClientSchema, form);
}

// Build plan P3 — client company fields. Single column on phones, two from sm.
export default function ClientForm({ value, onChange, errors = {} }) {
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
        <FormField label="Company name *" error={errors.name}>
          <input className={cls} value={form.name} onChange={set('name')} placeholder="e.g. Infosys" maxLength={200} />
        </FormField>
      </div>
      <FormField label="Industry" error={errors.industry}>
        <input className={cls} value={form.industry} onChange={set('industry')} placeholder="e.g. IT services" maxLength={120} />
      </FormField>
      <FormField label="Website" error={errors.website}>
        <input type="url" inputMode="url" className={cls} value={form.website} onChange={set('website')} placeholder="https://example.com" maxLength={500} />
      </FormField>
      <FormField label="Contact person" error={errors.contactName}>
        <input className={cls} value={form.contactName} onChange={set('contactName')} autoComplete="name" maxLength={120} />
      </FormField>
      <FormField label="Contact email" error={errors.contactEmail}>
        <input type="email" inputMode="email" className={cls} value={form.contactEmail} onChange={set('contactEmail')} autoComplete="email" maxLength={254} />
      </FormField>
      <FormField label="Contact phone" error={errors.contactPhone} hint="Include the country code, e.g. +39 319 123 4567">
        <input type="tel" inputMode="tel" className={cls} value={form.contactPhone} onChange={set('contactPhone')} placeholder="+39 319 123 4567" autoComplete="tel" maxLength={24} />
      </FormField>
      <FormField label="Address" error={errors.address}>
        <input className={cls} value={form.address} onChange={set('address')} maxLength={500} />
      </FormField>
      <div className="sm:col-span-2">
        <FormField label="Description" error={errors.description}>
          <textarea rows={3} className={inputClass} value={form.description} onChange={set('description')} maxLength={4000} />
        </FormField>
      </div>
    </div>
  );
}
