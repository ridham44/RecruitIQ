import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { clientsApi } from '../../services/clients.js';
import FormField, { inputClass } from '../../components/ui/FormField.jsx';

// Build plan P3 (§5) — Company (client) → Department / Company HR pickers for the job
// forms. value/onChange use { clientCompanyId, departmentId, hiringPersonId }
// ('' = none). Inactive entries can't be newly picked, but a job's current
// (since-deactivated) link still shows as selected.
export default function ClientLinkFields({ value, onChange, initial = value }) {
  const [clients, setClients] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    clientsApi
      .list()
      .then((data) => setClients(data.clients))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!value.clientCompanyId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    clientsApi
      .get(value.clientCompanyId)
      .then((data) => !cancelled && setDetail(data.client))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [value.clientCompanyId]);

  const cls = `${inputClass} min-h-[44px]`;
  const isKeep = (field, id) => initial?.[field] === id;

  const departments = detail?.id === value.clientCompanyId ? detail.departments || [] : [];
  // const department = departments.find((d) => d.id === value.departmentId);
  // const people = department?.hiringPersons || [];
  // Company HR belong to the company itself — the department doesn't filter them.
  const people = detail?.id === value.clientCompanyId ? detail.hiringPersons || [] : [];

  if (clients && clients.length === 0) {
    return (
      <FormField label="Company">
        <p className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500">
          No companies yet —{' '}
          <Link to="/company/clients" className="font-medium text-brand-600 hover:underline">
            add one
          </Link>{' '}
          to link this job to a company. (Optional)
        </p>
      </FormField>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-3">
        <FormField label="Company (optional)">
          <select
            className={cls}
            value={value.clientCompanyId}
            disabled={!clients}
            onChange={(e) => onChange({ clientCompanyId: e.target.value, departmentId: '', hiringPersonId: '' })}
          >
            <option value="">{clients ? 'No company' : 'Loading…'}</option>
            {(clients || []).map((c) => (
              <option key={c.id} value={c.id} disabled={!c.isActive && !isKeep('clientCompanyId', c.id)}>
                {c.name}
                {!c.isActive ? ' (inactive)' : ''}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Department">
          <select
            className={cls}
            value={value.departmentId}
            disabled={!value.clientCompanyId || !detail}
            // onChange={(e) => onChange({ ...value, departmentId: e.target.value, hiringPersonId: '' })}
            onChange={(e) => onChange({ ...value, departmentId: e.target.value })}
          >
            <option value="">{value.clientCompanyId ? (departments.length ? 'No department' : 'No departments yet') : 'Choose a company first'}</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id} disabled={!d.isActive && !isKeep('departmentId', d.id)}>
                {d.name}
                {!d.isActive ? ' (inactive)' : ''}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Company HR">
          <select
            className={cls}
            value={value.hiringPersonId}
            // disabled={!value.departmentId}
            disabled={!value.clientCompanyId || !detail}
            onChange={(e) => onChange({ ...value, hiringPersonId: e.target.value })}
          >
            {/* was: 'Choose a department first' — HR now only needs the company */}
            <option value="">{value.clientCompanyId ? (people.length ? 'No Company HR' : 'No Company HR yet') : 'Choose a company first'}</option>
            {people.map((p) => (
              <option key={p.id} value={p.id} disabled={!p.isActive && !isKeep('hiringPersonId', p.id)}>
                {p.fullName}
                {p.designation ? ` — ${p.designation}` : ''}
                {!p.isActive ? ' (inactive)' : ''}
              </option>
            ))}
          </select>
        </FormField>
      </div>
      {error && <p className="-mt-2 mb-4 text-xs text-red-600">{error}</p>}
    </div>
  );
}

// Form value → API payload (null clears).
export function clientLinkPayload(value) {
  return {
    clientCompanyId: value.clientCompanyId || null,
    departmentId: value.departmentId || null,
    hiringPersonId: value.hiringPersonId || null,
  };
}

export const EMPTY_CLIENT_LINK = { clientCompanyId: '', departmentId: '', hiringPersonId: '' };
