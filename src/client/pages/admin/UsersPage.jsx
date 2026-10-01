import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Users } from 'lucide-react';
import { adminApi } from '../../services/admin.js';
import { useAuth } from '../../hooks/useAuth.jsx';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import LoadingState from '../../components/ui/LoadingState.jsx';
import ErrorState from '../../components/ui/ErrorState.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import { inputClass } from '../../components/ui/FormField.jsx';

// const ROLE_LABELS = { ADMIN: 'Admin', COMPANY: 'Company', CANDIDATE: 'Candidate', RECRUITER: 'Recruiter', INTERVIEWER: 'Interviewer' };
const ROLE_LABELS = {
  ADMIN: 'Portal Admin',
  COMPANY: 'Agency owner',
  CANDIDATE: 'Candidate',
  RECRUITER: 'Agency recruiter',
  INTERVIEWER: 'Interviewer',
  // Build plan P8
  CLIENT_HR: 'Company HR',
};
const formatDate = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

// function displayName(u) {
//   return u.company?.name || u.candidate?.fullName || '—';
// }
// Build plan P2: recruiters show "Name · Company".
function displayName(u) {
  if (u.role === 'RECRUITER') return [u.memberName, u.company?.name].filter(Boolean).join(' · ') || '—';
  return u.company?.name || u.candidate?.fullName || '—';
}

function NameCell({ u }) {
  // Build plan P2
  if (u.role === 'RECRUITER' && u.company) {
    return (
      <span>
        <span className="text-slate-900">{u.memberName || '—'}</span>{' '}
        <Link to={`/admin/companies/${u.company.id}`} className="text-xs text-slate-500 hover:text-brand-600">
          · {u.company.name}
        </Link>
      </span>
    );
  }
  if (u.company) {
    return (
      <Link to={`/admin/companies/${u.company.id}`} className="text-slate-900 hover:text-brand-600">
        {u.company.name}
      </Link>
    );
  }
  return <span className="text-slate-900">{displayName(u)}</span>;
}

// Build plan P1 — every login on the platform; the admin can activate or
// deactivate any account except their own.
export default function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ q: '', role: '', status: '' });
  const [pending, setPending] = useState(null); // user to deactivate (confirm)
  const [busyId, setBusyId] = useState('');
  const [actionError, setActionError] = useState('');

  const load = (params = filters) => {
    setError('');
    adminApi
      .listUsers(params)
      .then((data) => setUsers(data.users))
      .catch((err) => setError(err.message));
  };

  useEffect(() => {
    const t = setTimeout(() => load(filters), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const setFilter = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));

  const toggle = async (u, isActive) => {
    setBusyId(u.id);
    setActionError('');
    try {
      const data = await adminApi.setUserStatus(u.id, isActive);
      setUsers((list) => list.map((x) => (x.id === u.id ? data.user : x)));
      setPending(null);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusyId('');
    }
  };

  const ToggleButton = ({ u, className = '' }) => {
    if (u.id === me?.id) return <span className={`text-xs text-slate-400 ${className}`}>You</span>;
    return u.isActive ? (
      <Button variant="secondary" className={className} onClick={() => setPending(u)}>
        Deactivate
      </Button>
    ) : (
      <Button className={className} loading={busyId === u.id} onClick={() => toggle(u, true)}>
        Activate
      </Button>
    );
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900">Users</h2>
        <p className="text-sm text-slate-500">Every account on the platform</p>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            className={`${inputClass} min-h-[44px] pl-9`}
            placeholder="Search by email or name"
            value={filters.q}
            onChange={setFilter('q')}
          />
        </div>
        <select className={`${inputClass} min-h-[44px] sm:w-40`} value={filters.role} onChange={setFilter('role')} aria-label="Filter by role">
          <option value="">All roles</option>
          {/* {['ADMIN', 'COMPANY', 'CANDIDATE'].map((r) => ( */}
          {['ADMIN', 'COMPANY', 'RECRUITER', 'CANDIDATE', 'CLIENT_HR'].map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <select className={`${inputClass} min-h-[44px] sm:w-40`} value={filters.status} onChange={setFilter('status')} aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {actionError && <p className="mb-4 text-sm text-red-600">{actionError}</p>}
      {error && <ErrorState message={error} onRetry={() => load()} />}
      {!error && !users && <LoadingState />}
      {users && users.length === 0 && <EmptyState icon={Users} title="No users match" description="Try a different search or filter." />}

      {users && users.length > 0 && (
        <>
          {/* Mobile: cards */}
          <div className="space-y-3 md:hidden">
            {users.map((u) => (
              <Card key={u.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{u.email}</p>
                    <p className="truncate text-sm text-slate-500">
                      {ROLE_LABELS[u.role] || u.role} · {displayName(u)}
                    </p>
                  </div>
                  <StatusBadge status={u.isActive ? 'ACTIVE' : 'INACTIVE'} />
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-500">Joined {formatDate(u.createdAt)}</span>
                  <ToggleButton u={u} />
                </div>
              </Card>
            ))}
          </div>

          {/* Tablet/desktop: table */}
          <Card className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Name / agency</th>
                  <th className="px-5 py-3">Joined</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-900">{u.email}</td>
                    <td className="px-5 py-3 text-slate-600">{ROLE_LABELS[u.role] || u.role}</td>
                    <td className="px-5 py-3">
                      <NameCell u={u} />
                      {u.company?.status === 'SUSPENDED' && <p className="text-xs text-red-600">Agency suspended</p>}
                    </td>
                    <td className="px-5 py-3 text-slate-500">{formatDate(u.createdAt)}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={u.isActive ? 'ACTIVE' : 'INACTIVE'} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <ToggleButton u={u} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      <ConfirmDialog
        open={Boolean(pending)}
        title="Deactivate this account?"
        description={pending ? `${pending.email} won't be able to log in, and is signed out on their next action. No data is deleted.` : ''}
        confirmLabel="Deactivate"
        loading={busyId === pending?.id}
        onConfirm={() => toggle(pending, false)}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
