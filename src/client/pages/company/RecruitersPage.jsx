import { useEffect, useState } from 'react';
import { UserPlus, UserCog, Send, Pencil } from 'lucide-react';
import { recruitersApi } from '../../services/recruiters.js';
import { jobsApi } from '../../services/jobs.js';
import { PERMISSION_OPTIONS, DEFAULT_RECRUITER_PERMISSIONS } from '../../../shared/constants/permissions.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import LoadingState from '../../components/ui/LoadingState.jsx';
import ErrorState from '../../components/ui/ErrorState.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import FormField, { inputClass } from '../../components/ui/FormField.jsx';
import SetupLinkNotice from '../admin/SetupLinkNotice.jsx';
import { useAuth } from '../../hooks/useAuth.jsx';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PERMISSION_LABEL = Object.fromEntries(PERMISSION_OPTIONS.map((p) => [p.key, p.label]));

function memberStatus(m) {
  if (m.pendingInvite) return 'INVITED';
  return m.isActive ? 'ACTIVE' : 'INACTIVE';
}

// Checkbox rows with 44px touch targets.
function CheckList({ options, selected, onToggle, empty }) {
  if (!options.length) return <p className="text-sm text-slate-500">{empty}</p>;
  return (
    <div className="space-y-1">
      {options.map((o) => (
        <label key={o.key} className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-slate-50">
          <input
            type="checkbox"
            className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            checked={selected.includes(o.key)}
            onChange={() => onToggle(o.key)}
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-slate-800">{o.label}</span>
            {o.description && <span className="block text-xs text-slate-500">{o.description}</span>}
          </span>
        </label>
      ))}
    </div>
  );
}

const toggleIn = (list, key) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);

// Invite (member = null) or edit access of an existing recruiter.
function RecruiterModal({ open, member, jobs, onClose, onSaved }) {
  const editing = Boolean(member);
  const [form, setForm] = useState({ fullName: '', email: '', permissions: DEFAULT_RECRUITER_PERMISSIONS, jobIds: [] });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm(
      member
        ? { fullName: member.fullName || '', email: member.email, permissions: member.permissions, jobIds: member.jobs.map((j) => j.id) }
        : { fullName: '', email: '', permissions: DEFAULT_RECRUITER_PERMISSIONS, jobIds: [] }
    );
  }, [open, member]);

  const jobOptions = jobs.map((j) => ({ key: j.id, label: j.title, description: j.status === 'OPEN' ? null : j.status.toLowerCase() }));

  const save = async () => {
    setError('');
    if (!form.fullName.trim()) return setError('Name is required');
    if (!editing && !EMAIL_REGEX.test(form.email.trim())) return setError('Enter a valid email');
    setSaving(true);
    try {
      if (editing) {
        if (form.fullName.trim() !== (member.fullName || '')) await recruitersApi.update(member.id, { fullName: form.fullName.trim() });
        await recruitersApi.setPermissions(member.id, form.permissions);
        const { recruiter } = await recruitersApi.setJobs(member.id, form.jobIds);
        onSaved({ recruiter });
      } else {
        const result = await recruitersApi.invite({
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          permissions: form.permissions,
          jobIds: form.jobIds,
        });
        onSaved(result);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={editing ? `Edit ${member?.fullName || member?.email}` : 'Invite agency recruiter'}
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button onClick={save} loading={saving} className="w-full sm:w-auto">
            {editing ? 'Save changes' : 'Send invite'}
          </Button>
        </div>
      }
    >
      <FormField label="Full name">
        <input className={`${inputClass} min-h-[44px]`} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="e.g. Riya Sharma" />
      </FormField>
      {editing ? (
        <FormField label="Email">
          <p className="break-all rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{form.email}</p>
        </FormField>
      ) : (
        <FormField label="Email">
          <input
            type="email"
            inputMode="email"
            autoComplete="off"
            className={`${inputClass} min-h-[44px]`}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="recruiter@agency.com"
          />
        </FormField>
      )}

      <p className="mb-1 mt-2 text-sm font-medium text-slate-700">Permissions</p>
      <CheckList options={PERMISSION_OPTIONS} selected={form.permissions} onToggle={(k) => setForm({ ...form, permissions: toggleIn(form.permissions, k) })} />

      <p className="mb-1 mt-4 text-sm font-medium text-slate-700">Assigned jobs</p>
      <p className="mb-1 text-xs text-slate-500">They only see these jobs, plus any job they create.</p>
      <CheckList options={jobOptions} selected={form.jobIds} onToggle={(k) => setForm({ ...form, jobIds: toggleIn(form.jobIds, k) })} empty="No jobs yet." />

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </Modal>
  );
}

// Build plan P2 — the owner (or a recruiter with MANAGE_RECRUITERS) manages
// who works in the company and on which jobs.
export default function RecruitersPage() {
  const { user } = useAuth();
  const [members, setMembers] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState('');
  const [modal, setModal] = useState({ open: false, member: null });
  const [notice, setNotice] = useState(null);
  const [confirmOff, setConfirmOff] = useState(null);
  const [busyId, setBusyId] = useState('');
  const [actionError, setActionError] = useState('');

  const load = () => {
    setError('');
    Promise.all([recruitersApi.list(), jobsApi.listMine()])
      .then(([r, j]) => {
        setMembers(r.members);
        setJobs(j.jobs);
      })
      .catch((err) => setError(err.message));
  };

  useEffect(load, []);

  const replace = (recruiter) =>
    setMembers((list) => (list.some((m) => m.id === recruiter.id) ? list.map((m) => (m.id === recruiter.id ? recruiter : m)) : [...list, recruiter]));

  const setStatus = async (m, isActive) => {
    setBusyId(m.id);
    setActionError('');
    try {
      const { recruiter } = await recruitersApi.setStatus(m.id, isActive);
      replace(recruiter);
      setConfirmOff(null);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusyId('');
    }
  };

  const resend = async (m) => {
    setBusyId(m.id);
    setActionError('');
    try {
      const { setupLink } = await recruitersApi.resendInvite(m.id);
      setNotice({ email: m.email, link: setupLink });
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusyId('');
    }
  };

  const isSelf = (m) => m.userId === user?.id;

  const Actions = ({ m }) => {
    if (m.role === 'OWNER' || isSelf(m)) return null;
    return (
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => setModal({ open: true, member: m })}>
          <Pencil className="h-4 w-4" /> Edit
        </Button>
        {m.pendingInvite && (
          <Button variant="secondary" loading={busyId === m.id} onClick={() => resend(m)}>
            <Send className="h-4 w-4" /> Resend
          </Button>
        )}
        {m.isActive ? (
          <Button variant="ghost" onClick={() => setConfirmOff(m)}>
            Deactivate
          </Button>
        ) : (
          <Button variant="secondary" loading={busyId === m.id} onClick={() => setStatus(m, true)}>
            Activate
          </Button>
        )}
      </div>
    );
  };

  const PermissionTags = ({ m }) =>
    m.role === 'OWNER' ? (
      <span className="text-xs text-slate-500">All permissions</span>
    ) : m.permissions.length ? (
      <div className="flex flex-wrap gap-1">
        {m.permissions.map((p) => (
          <span key={p} className="rounded bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
            {PERMISSION_LABEL[p] || p}
          </span>
        ))}
      </div>
    ) : (
      <span className="text-xs text-slate-400">No permissions</span>
    );

  // const JobsText = ({ m }) =>
  //   m.role === 'OWNER' ? 'All jobs' : m.jobs.length ? m.jobs.map((j) => j.title).join(', ') : 'No jobs assigned';
  // Build plan P3: client assignments count too ("All jobs of <client>").
  const JobsText = ({ m }) => {
    if (m.role === 'OWNER') return 'All jobs';
    const parts = [...(m.clients || []).map((c) => `All ${c.name} jobs`), ...m.jobs.map((j) => j.title)];
    return parts.length ? parts.join(', ') : 'No jobs assigned';
  };

  // Owners have no stored name — show "Company owner" instead of the email twice.
  const displayName = (m) => m.fullName || (m.role === 'OWNER' ? 'Agency owner' : m.email);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Agency recruiters</h2>
          <p className="text-sm text-slate-500">People in your agency and the jobs they work on</p>
        </div>
        <Button onClick={() => setModal({ open: true, member: null })} className="w-full sm:w-auto">
          <UserPlus className="h-4 w-4" /> Invite agency recruiter
        </Button>
      </div>

      {notice && (
        <div className="mb-4">
          <SetupLinkNotice email={notice.email} link={notice.link} who="the recruiter" />
        </div>
      )}
      {actionError && <p className="mb-4 text-sm text-red-600">{actionError}</p>}
      {error && <ErrorState message={error} onRetry={load} />}
      {!error && !members && <LoadingState />}

      {members && (
        <>
          {members.length === 1 && (
            <Card className="mb-4 flex flex-col items-center gap-2 p-6 text-center">
              <UserCog className="h-8 w-8 text-slate-300" />
              <p className="font-medium text-slate-700">No agency recruiters yet</p>
              <p className="text-sm text-slate-500">Invite recruiters and choose which jobs they work on.</p>
            </Card>
          )}

          {/* Mobile: cards */}
          <div className="space-y-3 md:hidden">
            {members.map((m) => (
              <Card key={m.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">
                      {/* {m.fullName || m.email} */}
                      {displayName(m)} {isSelf(m) && <span className="text-xs text-slate-400">(you)</span>}
                    </p>
                    <p className="truncate text-sm text-slate-500">{m.email}</p>
                  </div>
                  {m.role === 'OWNER' ? <StatusBadge status="OWNER" /> : <StatusBadge status={memberStatus(m)} />}
                </div>
                <div className="mt-3 space-y-2">
                  <PermissionTags m={m} />
                  <p className="text-xs text-slate-500">
                    <span className="font-medium text-slate-600">Jobs:</span> <JobsText m={m} />
                  </p>
                </div>
                <div className="mt-3">
                  <Actions m={m} />
                </div>
              </Card>
            ))}
          </div>

          {/* Tablet/desktop: table */}
          <Card className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Permissions</th>
                  <th className="px-5 py-3">Jobs</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.map((m) => (
                  <tr key={m.id} className="align-top hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-900">
                        {/* {m.fullName || m.email} */}
                        {displayName(m)} {isSelf(m) && <span className="text-xs font-normal text-slate-400">(you)</span>}
                      </p>
                      <p className="text-xs text-slate-500">{m.email}</p>
                    </td>
                    <td className="max-w-[220px] px-5 py-3">
                      <PermissionTags m={m} />
                    </td>
                    <td className="max-w-[220px] px-5 py-3 text-slate-600">
                      <JobsText m={m} />
                    </td>
                    <td className="px-5 py-3">
                      {m.role === 'OWNER' ? <StatusBadge status="OWNER" /> : <StatusBadge status={memberStatus(m)} />}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end">
                        <Actions m={m} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      <RecruiterModal
        open={modal.open}
        member={modal.member}
        jobs={jobs}
        onClose={() => setModal({ open: false, member: null })}
        onSaved={(result) => {
          replace(result.recruiter);
          if (result.setupLink) setNotice({ email: result.recruiter.email, link: result.setupLink });
          setModal({ open: false, member: null });
        }}
      />

      <ConfirmDialog
        open={Boolean(confirmOff)}
        title="Deactivate this agency recruiter?"
        description={
          confirmOff
            ? `${confirmOff.fullName || confirmOff.email} won't be able to log in. Their jobs stay with the agency and you can reassign them.`
            : ''
        }
        confirmLabel="Deactivate"
        loading={busyId === confirmOff?.id}
        onConfirm={() => setStatus(confirmOff, false)}
        onCancel={() => setConfirmOff(null)}
      />
    </div>
  );
}
