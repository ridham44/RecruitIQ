import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Building, Search } from 'lucide-react';
import { clientsApi } from '../../services/clients.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import LoadingState from '../../components/ui/LoadingState.jsx';
import ErrorState from '../../components/ui/ErrorState.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import { inputClass } from '../../components/ui/FormField.jsx';
import ClientForm, { EMPTY_CLIENT, validateClientForm } from './ClientForm.jsx';

// Build plan P3 (§4) — the recruitment company's clients.
export default function ClientsPage() {
  const { can } = usePermissions();
  const canManage = can('MANAGE_CLIENTS');
  const navigate = useNavigate();
  const [clients, setClients] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_CLIENT);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const load = (params = { q, status }) => {
    setError('');
    clientsApi
      .list(params)
      .then((data) => setClients(data.clients))
      .catch((err) => setError(err.message));
  };

  useEffect(() => {
    const t = setTimeout(() => load({ q, status }), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status]);

  const openAdd = () => {
    setForm(EMPTY_CLIENT);
    setFormError('');
    setFieldErrors({});
    setAdding(true);
  };

  const save = async () => {
    const { data, errors } = validateClientForm(form);
    setFieldErrors(errors);
    if (!data) return setFormError('Please fix the highlighted fields');
    setFormError('');
    setSaving(true);
    try {
      const { client } = await clientsApi.create(data);
      navigate(`/company/clients/${client.id}`);
    } catch (err) {
      setFieldErrors(err.fields || {});
      setFormError(err.fields && Object.keys(err.fields).length ? 'Please fix the highlighted fields' : err.message);
    } finally {
      setSaving(false);
    }
  };

  const filtered = Boolean(q || status);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Companies</h2>
          <p className="text-sm text-slate-500">Companies you recruit for, their departments and HR contacts</p>
        </div>
        {canManage && (
          <Button onClick={openAdd} className="w-full sm:w-auto">
            <Plus className="h-4 w-4" /> Add company
          </Button>
        )}
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            className={`${inputClass} min-h-[44px] pl-9`}
            placeholder="Search by name, industry or contact"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select className={`${inputClass} min-h-[44px] sm:w-44`} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {error && <ErrorState message={error} onRetry={() => load()} />}
      {!error && !clients && <LoadingState />}
      {clients && clients.length === 0 && (
        <EmptyState
          icon={Building}
          title={filtered ? 'No companies match' : 'No companies yet'}
          description={
            filtered
              ? 'Try a different search or status.'
              : canManage
                ? 'Add the companies you recruit for, then link jobs to them.'
                : "You haven't been assigned to any companies yet."
          }
          action={!filtered && canManage && <Button onClick={openAdd}>Add company</Button>}
        />
      )}

      {clients && clients.length > 0 && (
        <>
          {/* Mobile: cards */}
          <div className="space-y-3 md:hidden">
            {clients.map((c) => (
              <Link key={c.id} to={`/company/clients/${c.id}`} className="block">
                <Card className="p-4 active:bg-slate-50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">{c.name}</p>
                      <p className="truncate text-sm text-slate-500">{c.industry || c.contactName || '—'}</p>
                    </div>
                    <StatusBadge status={c.isActive ? 'ACTIVE' : 'INACTIVE'} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span>{c.departmentCount} departments</span>
                    <span>{c.jobCount} jobs</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          {/* Tablet/desktop: table */}
          <Card className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Company</th>
                  <th className="px-5 py-3">Industry</th>
                  <th className="px-5 py-3">Contact</th>
                  <th className="px-5 py-3">Departments</th>
                  <th className="px-5 py-3">Jobs</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clients.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <Link to={`/company/clients/${c.id}`} className="font-medium text-slate-900 hover:text-brand-600">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{c.industry || '—'}</td>
                    <td className="px-5 py-3 text-slate-600">
                      {c.contactName || '—'}
                      {c.contactEmail && <p className="text-xs text-slate-400">{c.contactEmail}</p>}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{c.departmentCount}</td>
                    <td className="px-5 py-3 text-slate-600">{c.jobCount}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={c.isActive ? 'ACTIVE' : 'INACTIVE'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      <Modal
        open={adding}
        title="Add company"
        onClose={() => setAdding(false)}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setAdding(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={save} loading={saving} className="w-full sm:w-auto">
              Add company
            </Button>
          </div>
        }
      >
        <ClientForm value={form} errors={fieldErrors} onChange={setForm} />
        {formError && <p className="text-sm text-red-600">{formError}</p>}
      </Modal>
    </div>
  );
}
