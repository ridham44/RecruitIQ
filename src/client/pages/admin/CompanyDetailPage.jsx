import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, ShieldOff, ShieldCheck, Send } from 'lucide-react';
import { adminApi } from '../../services/admin.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import LoadingState from '../../components/ui/LoadingState.jsx';
import ErrorState from '../../components/ui/ErrorState.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import CompanyForm from './CompanyForm.jsx';
import SetupLinkNotice from './SetupLinkNotice.jsx';
import { safeHttpUrl } from '../../utils/safeUrl.js';

const formatDate = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

function Stat({ label, value }) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </Card>
  );
}

function Detail({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-slate-900">{children || '—'}</dd>
    </div>
  );
}

// Build plan P1 — view/edit one Recruitment Company, suspend/activate it,
// and resend the owner's invite while it's still pending.
export default function CompanyDetailPage() {
  const { id } = useParams();
  const [company, setCompany] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [confirmSuspend, setConfirmSuspend] = useState(false);
  const [busy, setBusy] = useState('');
  const [actionError, setActionError] = useState('');
  const [invite, setInvite] = useState(null);

  const load = () => {
    setError('');
    adminApi
      .getCompany(id)
      .then((data) => setCompany(data.company))
      .catch((err) => setError(err.message));
  };

  useEffect(load, [id]);

  const changeStatus = async (status) => {
    setBusy('status');
    setActionError('');
    try {
      const data = await adminApi.setCompanyStatus(id, status);
      setCompany(data.company);
      setConfirmSuspend(false);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy('');
    }
  };

  const resend = async () => {
    setBusy('invite');
    setActionError('');
    try {
      const data = await adminApi.resendInvite(id);
      setInvite(data.setupLink);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy('');
    }
  };

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!company) return <LoadingState />;

  const suspended = company.status === 'SUSPENDED';

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/admin/companies" className="mb-4 inline-flex min-h-[44px] items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Agencies
      </Link>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="break-words text-xl font-semibold text-slate-900">{company.name}</h2>
            <StatusBadge status={company.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {company.createdByAdminId ? 'Added by admin' : 'Self-registered'} on {formatDate(company.createdAt)}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:shrink-0">
          {!editing && (
            <Button variant="secondary" onClick={() => setEditing(true)} className="w-full sm:w-auto">
              <Pencil className="h-4 w-4" /> Edit
            </Button>
          )}
          {suspended ? (
            <Button onClick={() => changeStatus('ACTIVE')} loading={busy === 'status'} className="w-full sm:w-auto">
              <ShieldCheck className="h-4 w-4" /> Activate
            </Button>
          ) : (
            <Button variant="danger" onClick={() => setConfirmSuspend(true)} className="w-full sm:w-auto">
              <ShieldOff className="h-4 w-4" /> Suspend
            </Button>
          )}
        </div>
      </div>

      {suspended && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          This agency is suspended. Its users can't log in, and anyone already logged in is signed out on their next
          action. Jobs and candidate data are kept.
        </div>
      )}
      {actionError && <p className="mb-4 text-sm text-red-600">{actionError}</p>}
      {invite && (
        <div className="mb-4">
          <SetupLinkNotice email={company.owner?.email} link={invite} />
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Jobs" value={company.jobCount} />
        <Stat label="Open jobs" value={company.openJobCount} />
        <Stat label="Applications" value={company.applicationCount} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-4 sm:p-6 lg:col-span-2">
          <h3 className="mb-4 font-semibold text-slate-900">Agency details</h3>
          {editing ? (
            <CompanyForm
              initial={company}
              submitLabel="Save changes"
              onCancel={() => setEditing(false)}
              onSubmit={async (payload) => {
                const data = await adminApi.updateCompany(id, payload);
                setCompany(data.company);
                setEditing(false);
              }}
            />
          ) : (
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Detail label="Website">
                {company.website &&
                  (safeHttpUrl(company.website) ? (
                    <a href={safeHttpUrl(company.website)} target="_blank" rel="noopener noreferrer" className="break-all text-brand-600 hover:underline">
                      {company.website}
                    </a>
                  ) : (
                    <span className="break-all">{company.website}</span>
                  ))}
              </Detail>
              <Detail label="Industry">{company.industry}</Detail>
              <Detail label="Size">{company.size && `${company.size} employees`}</Detail>
              <Detail label="Location">{company.location}</Detail>
              <div className="sm:col-span-2">
                <Detail label="Description">
                  {company.description && <span className="whitespace-pre-line">{company.description}</span>}
                </Detail>
              </div>
            </dl>
          )}
        </Card>

        <Card className="p-4 sm:p-6">
          <h3 className="mb-4 font-semibold text-slate-900">Agency owner</h3>
          <dl className="space-y-4">
            <Detail label="Email">{company.owner?.email}</Detail>
            <Detail label="Login">
              {company.pendingInvite ? (
                <StatusBadge status="INVITED" />
              ) : (
                <StatusBadge status={company.owner?.isActive ? 'ACTIVE' : 'INACTIVE'} />
              )}
            </Detail>
          </dl>
          {company.pendingInvite && (
            <>
              <p className="mt-3 text-xs text-slate-500">The agency owner hasn't set a password yet.</p>
              <Button variant="secondary" onClick={resend} loading={busy === 'invite'} className="mt-3 w-full">
                <Send className="h-4 w-4" /> Resend invite
              </Button>
            </>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={confirmSuspend}
        title={`Suspend ${company.name}?`}
        description="Its users will be logged out and can't log in until you activate the agency again. No data is deleted."
        confirmLabel="Suspend"
        loading={busy === 'status'}
        onConfirm={() => changeStatus('SUSPENDED')}
        onCancel={() => setConfirmSuspend(false)}
      />
    </div>
  );
}
