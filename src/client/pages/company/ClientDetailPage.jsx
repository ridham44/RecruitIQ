import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Plus, ChevronDown, ChevronRight, UserRound, Briefcase, UserCog } from 'lucide-react';
import { clientsApi } from '../../services/clients.js';
import { recruitersApi } from '../../services/recruiters.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import LoadingState from '../../components/ui/LoadingState.jsx';
import ErrorState from '../../components/ui/ErrorState.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import FormField, { inputClass } from '../../components/ui/FormField.jsx';
import ClientForm, { clientToForm, validateClientForm, trimClientForm } from './ClientForm.jsx';
// Build plan P8
import { configApi } from '../../services/config.js';
import SetupLinkNotice from '../admin/SetupLinkNotice.jsx';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// const EMPTY_PERSON = { fullName: '', email: '', phone: '', designation: '' };
const EMPTY_PERSON = { fullName: '', email: '', phone: '', designation: '', departmentId: '' };
// const TABS = [
//   { key: 'info', label: 'Info' },
//   { key: 'departments', label: 'Departments' },
//   { key: 'recruiters', label: 'Recruiters' },
// ];
// Company HR belong to the company itself; departments are an optional label.
const TABS = [
  { key: 'info', label: 'Info' },
  { key: 'hr', label: 'Company HR' },
  { key: 'departments', label: 'Departments' },
  { key: 'recruiters', label: 'Agency recruiters' },
];
// Old layout listed HR inside each department — kept switched off.
const SHOW_HR_IN_DEPARTMENTS = false;

function Detail({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-slate-900">{children || '—'}</dd>
    </div>
  );
}

function ModalFooter({ onCancel, onSave, saving, label = 'Save' }) {
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button variant="secondary" onClick={onCancel} className="w-full sm:w-auto">
        Cancel
      </Button>
      <Button onClick={onSave} loading={saving} className="w-full sm:w-auto">
        {label}
      </Button>
    </div>
  );
}

// Build plan P3 (§4, §4.1, §4.2) — one client: details, departments with
// their HR / hiring people, and the recruiters who work for it.
export default function ClientDetailPage() {
  const { id } = useParams();
  const { can } = usePermissions();
  const canManage = can('MANAGE_CLIENTS');
  const canAssign = canManage && can('MANAGE_RECRUITERS');

  const [client, setClient] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('info');
  const [open, setOpen] = useState({}); // expanded departments
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState('');

  // modal state: { kind: 'client' | 'department' | 'person' | 'recruiters', ... }
  const [modal, setModal] = useState(null);
  const [modalError, setModalError] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [allRecruiters, setAllRecruiters] = useState([]);

  const load = () => {
    setError('');
    clientsApi
      .get(id)
      .then((data) => setClient(data.client))
      .catch((err) => setError(err.message));
  };

  useEffect(load, [id]);

  // Build plan P8: client HR portal invites
  const [portalOn, setPortalOn] = useState(false);
  const [inviteNotice, setInviteNotice] = useState(null);
  useEffect(() => {
    configApi
      .getPublic()
      .then((c) => setPortalOn(Boolean(c?.clientPortal)))
      .catch(() => setPortalOn(false));
  }, []);
  const invite = async (person) => {
    setBusy(`inv:${person.id}`);
    setActionError('');
    try {
      const { setupLink } = await clientsApi.inviteHiringPerson(person.id);
      setInviteNotice({ email: person.email, link: setupLink });
      load();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy('');
    }
  };

  // Every mutation returns the full, refreshed client.
  const run = async (key, fn, { closeModal = false } = {}) => {
    setBusy(key);
    setActionError('');
    setModalError('');
    try {
      const data = await fn();
      if (data?.client) setClient(data.client);
      if (closeModal) setModal(null);
      setConfirm(null);
      return true;
    } catch (err) {
      if (modal) setModalError(err.message);
      else setActionError(err.message);
      return false;
    } finally {
      setBusy('');
    }
  };

  const openRecruiters = async () => {
    setModalError('');
    try {
      const { members } = await recruitersApi.list();
      setAllRecruiters(members.filter((m) => m.role === 'RECRUITER'));
      setModal({ kind: 'recruiters', selected: (client.recruiters || []).map((r) => r.id) });
    } catch (err) {
      setActionError(err.message);
    }
  };

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!client) return <LoadingState />;

  const saveModal = () => {
    if (!modal) return;
    if (modal.kind === 'client') {
      const msg = validateClientForm(modal.form);
      if (msg) return setModalError(msg);
      return run('modal', () => clientsApi.update(id, trimClientForm(modal.form)), { closeModal: true });
    }
    if (modal.kind === 'department') {
      const name = modal.name.trim();
      if (!name) return setModalError('Department name is required');
      return run('modal', () => (modal.department ? clientsApi.renameDepartment(modal.department.id, name) : clientsApi.addDepartment(id, name)), {
        closeModal: true,
      }).then((ok) => ok && !modal.department && setOpen((o) => ({ ...o, [`new:${name}`]: true })));
    }
    if (modal.kind === 'person') {
      const f = modal.form;
      if (!f.fullName.trim()) return setModalError('Name is required');
      if (!EMAIL_REGEX.test(f.email.trim())) return setModalError('Enter a valid email');
      // const payload = { fullName: f.fullName.trim(), email: f.email.trim(), phone: f.phone.trim(), designation: f.designation.trim() };
      const payload = {
        fullName: f.fullName.trim(),
        email: f.email.trim(),
        phone: f.phone.trim(),
        designation: f.designation.trim(),
        departmentId: f.departmentId || null,
      };
      return run(
        'modal',
        // () => (modal.person ? clientsApi.updateHiringPerson(modal.person.id, payload) : clientsApi.addHiringPerson(modal.departmentId, payload)),
        () => (modal.person ? clientsApi.updateHiringPerson(modal.person.id, payload) : clientsApi.addHiringPerson(id, payload)),
        { closeModal: true }
      );
    }
    if (modal.kind === 'recruiters') {
      return run('modal', () => clientsApi.setRecruiters(id, modal.selected), { closeModal: true });
    }
    return undefined;
  };

  const departments = client.departments || [];
  const hiringPersons = client.hiringPersons || [];
  const personForm = (p) => ({
    fullName: p.fullName,
    email: p.email,
    phone: p.phone || '',
    designation: p.designation || '',
    departmentId: p.departmentId || '',
  });

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/company/clients" className="mb-4 inline-flex min-h-[44px] items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        {/* <ArrowLeft className="h-4 w-4" /> Clients */}
        <ArrowLeft className="h-4 w-4" /> Companies
      </Link>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="break-words text-xl font-semibold text-slate-900">{client.name}</h2>
            <StatusBadge status={client.isActive ? 'ACTIVE' : 'INACTIVE'} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {hiringPersons.length} HR · {departments.length} departments ·{' '}
            <Link to={`/company/jobs?clientId=${client.id}`} className="text-brand-600 hover:underline">
              {client.jobCount} jobs
            </Link>
          </p>
        </div>
        {canManage && (
          <div className="flex flex-col gap-2 sm:flex-row sm:shrink-0">
            <Button variant="secondary" className="w-full sm:w-auto" onClick={() => setModal({ kind: 'client', form: clientToForm(client) })}>
              <Pencil className="h-4 w-4" /> Edit
            </Button>
            {client.isActive ? (
              <Button variant="secondary" className="w-full sm:w-auto" onClick={() => setConfirm({ kind: 'client' })}>
                Deactivate
              </Button>
            ) : (
              <Button className="w-full sm:w-auto" loading={busy === 'client-status'} onClick={() => run('client-status', () => clientsApi.setStatus(id, true))}>
                Activate
              </Button>
            )}
          </div>
        )}
      </div>

      {!client.isActive && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {/* This client is inactive. It can't be picked for new jobs; existing jobs keep their link. */}
          This company is inactive. It can't be picked for new jobs; existing jobs keep their link.
        </div>
      )}
      {actionError && <p className="mb-4 text-sm text-red-600">{actionError}</p>}
      {/* Build plan P8 */}
      {inviteNotice && (
        <div className="mb-4">
          <SetupLinkNotice email={inviteNotice.email} link={inviteNotice.link} who="the Company HR" />
        </div>
      )}

      {/* Tabs — horizontally scrollable on very small screens */}
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`min-h-[44px] shrink-0 border-b-2 px-4 text-sm font-medium ${
              tab === t.key ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
            {t.key === 'departments' && ` (${departments.length})`}
            {t.key === 'hr' && ` (${hiringPersons.length})`}
            {t.key === 'recruiters' && ` (${client.recruiters?.length || 0})`}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <Card className="p-4 sm:p-6">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Detail label="Industry">{client.industry}</Detail>
            <Detail label="Website">
              {client.website && (
                <a href={client.website} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
                  {client.website}
                </a>
              )}
            </Detail>
            <Detail label="Contact person">{client.contactName}</Detail>
            <Detail label="Contact email">{client.contactEmail}</Detail>
            <Detail label="Contact phone">{client.contactPhone}</Detail>
            <Detail label="Address">{client.address}</Detail>
            <div className="sm:col-span-2">
              <Detail label="Description">{client.description && <span className="whitespace-pre-line">{client.description}</span>}</Detail>
            </div>
          </dl>
        </Card>
      )}

      {/* Company HR — directly under the company; department is only a label */}
      {tab === 'hr' && (
        <div className="space-y-3">
          {canManage && (
            <Button variant="secondary" className="w-full sm:w-auto" onClick={() => setModal({ kind: 'person', form: EMPTY_PERSON })}>
              <Plus className="h-4 w-4" /> Add Company HR
            </Button>
          )}
          {hiringPersons.length === 0 ? (
            <Card className="p-6 text-center text-sm text-slate-500">No Company HR yet.</Card>
          ) : (
            <Card className="overflow-hidden">
              <ul className="divide-y divide-slate-100">
                {hiringPersons.map((p) => (
                  <li key={p.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <UserRound className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900">
                          {p.fullName} {!p.isActive && <span className="text-xs font-normal text-slate-400">(inactive)</span>}
                          {p.department?.name && (
                            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{p.department.name}</span>
                          )}
                          {portalOn && p.portalStatus === 'ACTIVE' && (
                            <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">Portal</span>
                          )}
                          {portalOn && p.portalStatus === 'INVITED' && (
                            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">Invited</span>
                          )}
                        </p>
                        <p className="break-all text-xs text-slate-500">{[p.designation, p.email, p.phone].filter(Boolean).join(' · ')}</p>
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex flex-wrap gap-2 pl-8 sm:pl-0">
                        <Button variant="ghost" onClick={() => setModal({ kind: 'person', person: p, form: personForm(p) })}>
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          loading={busy === `p:${p.id}`}
                          onClick={() => run(`p:${p.id}`, () => clientsApi.setHiringPersonStatus(p.id, !p.isActive))}
                        >
                          {p.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                        {portalOn && p.isActive && p.portalStatus !== 'ACTIVE' && (
                          <Button variant="ghost" loading={busy === `inv:${p.id}`} onClick={() => invite(p)}>
                            {p.portalStatus === 'INVITED' ? 'Resend invite' : 'Invite to portal'}
                          </Button>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      {tab === 'departments' && (
        <div className="space-y-3">
          {canManage && (
            <Button variant="secondary" className="w-full sm:w-auto" onClick={() => setModal({ kind: 'department', name: '' })}>
              <Plus className="h-4 w-4" /> Add department
            </Button>
          )}
          {departments.length === 0 && (
            <Card className="p-6 text-center text-sm text-slate-500">No departments yet — e.g. IT, Finance, Sales.</Card>
          )}
          {departments.map((d) => {
            const expanded = open[d.id] ?? open[`new:${d.name}`] ?? departments.length === 1;
            return (
              <Card key={d.id} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpen((o) => ({ ...o, [d.id]: !expanded }))}
                  className="flex min-h-[56px] w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
                  aria-expanded={expanded}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {expanded ? <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />}
                    <span className="truncate font-medium text-slate-900">{d.name}</span>
                    {!d.isActive && <StatusBadge status="INACTIVE" />}
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {/* {d.hiringPersons.length} HR · {d.jobCount} jobs */}
                    {d.jobCount} jobs
                  </span>
                </button>

                {expanded && (
                  <div className="border-t border-slate-100 px-4 py-3">
                    {SHOW_HR_IN_DEPARTMENTS && d.hiringPersons.length === 0 && <p className="mb-3 text-sm text-slate-500">No Company HR yet.</p>}
                    {SHOW_HR_IN_DEPARTMENTS && (
                    <ul className="divide-y divide-slate-100">
                      {d.hiringPersons.map((p) => (
                        <li key={p.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 items-start gap-3">
                            <UserRound className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-900">
                                {p.fullName} {!p.isActive && <span className="text-xs font-normal text-slate-400">(inactive)</span>}
                                {/* Build plan P8 */}
                                {portalOn && p.portalStatus === 'ACTIVE' && (
                                  <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">Portal</span>
                                )}
                                {portalOn && p.portalStatus === 'INVITED' && (
                                  <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">Invited</span>
                                )}
                              </p>
                              <p className="break-all text-xs text-slate-500">
                                {[p.designation, p.email, p.phone].filter(Boolean).join(' · ')}
                              </p>
                            </div>
                          </div>
                          {canManage && (
                            <div className="flex gap-2 pl-8 sm:pl-0">
                              <Button
                                variant="ghost"
                                onClick={() =>
                                  setModal({
                                    kind: 'person',
                                    person: p,
                                    form: { fullName: p.fullName, email: p.email, phone: p.phone || '', designation: p.designation || '' },
                                  })
                                }
                              >
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                loading={busy === `p:${p.id}`}
                                onClick={() => run(`p:${p.id}`, () => clientsApi.setHiringPersonStatus(p.id, !p.isActive))}
                              >
                                {p.isActive ? 'Deactivate' : 'Activate'}
                              </Button>
                              {/* Build plan P8: client HR portal login */}
                              {portalOn && p.isActive && p.portalStatus !== 'ACTIVE' && (
                                <Button variant="ghost" loading={busy === `inv:${p.id}`} onClick={() => invite(p)}>
                                  {p.portalStatus === 'INVITED' ? 'Resend invite' : 'Invite to portal'}
                                </Button>
                              )}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                    )}
                    {canManage && (
                      // <div className="mt-2 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                      <div className="flex flex-wrap gap-2">
                        {SHOW_HR_IN_DEPARTMENTS && (
                        <Button variant="secondary" onClick={() => setModal({ kind: 'person', departmentId: d.id, form: EMPTY_PERSON })}>
                          <Plus className="h-4 w-4" /> Add Company HR
                        </Button>
                        )}
                        <Button variant="ghost" onClick={() => setModal({ kind: 'department', department: d, name: d.name })}>
                          Rename
                        </Button>
                        <Button
                          variant="ghost"
                          loading={busy === `d:${d.id}`}
                          onClick={() => run(`d:${d.id}`, () => clientsApi.setDepartmentStatus(d.id, !d.isActive))}
                        >
                          {d.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {tab === 'recruiters' && (
        <Card className="p-4 sm:p-6">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">Agency recruiters assigned here see every job of this company.</p>
            {canAssign && (
              <Button variant="secondary" onClick={openRecruiters} className="w-full sm:w-auto">
                <UserCog className="h-4 w-4" /> Change
              </Button>
            )}
          </div>
          {(client.recruiters || []).length === 0 ? (
            <p className="text-sm text-slate-500">No agency recruiters assigned — only the agency owner works this company.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {client.recruiters.map((r) => (
                <span key={r.id} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                  <UserCog className="h-3.5 w-3.5" />
                  {r.fullName || r.email}
                  {!r.isActive && <span className="text-slate-400">(inactive)</span>}
                </span>
              ))}
            </div>
          )}
          <Link to={`/company/jobs?clientId=${client.id}`} className="mt-4 inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-brand-600 hover:underline">
            <Briefcase className="h-4 w-4" /> View this company's jobs
          </Link>
        </Card>
      )}

      {/* ─── Modals ─── */}
      <Modal
        open={modal?.kind === 'client'}
        title="Edit company"
        onClose={() => setModal(null)}
        footer={<ModalFooter onCancel={() => setModal(null)} onSave={saveModal} saving={busy === 'modal'} />}
      >
        {modal?.kind === 'client' && <ClientForm value={modal.form} onChange={(form) => setModal((m) => ({ ...m, form }))} />}
        {modalError && <p className="text-sm text-red-600">{modalError}</p>}
      </Modal>

      <Modal
        open={modal?.kind === 'department'}
        title={modal?.department ? 'Rename department' : 'Add department'}
        onClose={() => setModal(null)}
        footer={<ModalFooter onCancel={() => setModal(null)} onSave={saveModal} saving={busy === 'modal'} label={modal?.department ? 'Save' : 'Add'} />}
      >
        <FormField label="Department name">
          <input
            autoFocus
            className={`${inputClass} min-h-[44px]`}
            value={modal?.name || ''}
            onChange={(e) => setModal((m) => ({ ...m, name: e.target.value }))}
            onKeyDown={(e) => e.key === 'Enter' && saveModal()}
            placeholder="e.g. IT, Finance, Sales"
          />
        </FormField>
        {modalError && <p className="text-sm text-red-600">{modalError}</p>}
      </Modal>

      {/* was: title={modal?.person ? 'Edit HR person' : 'Add HR / hiring person'} */}
      <Modal
        open={modal?.kind === 'person'}
        title={modal?.person ? 'Edit Company HR' : 'Add Company HR'}
        onClose={() => setModal(null)}
        footer={<ModalFooter onCancel={() => setModal(null)} onSave={saveModal} saving={busy === 'modal'} label={modal?.person ? 'Save' : 'Add'} />}
      >
        {modal?.kind === 'person' && (
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            {[
              ['fullName', 'Full name *', 'text'],
              ['email', 'Email *', 'email'],
              ['phone', 'Phone', 'tel'],
              ['designation', 'Designation', 'text'],
            ].map(([key, label, type]) => (
              <FormField key={key} label={label}>
                <input
                  type={type}
                  inputMode={type === 'email' ? 'email' : type === 'tel' ? 'tel' : undefined}
                  className={`${inputClass} min-h-[44px]`}
                  value={modal.form[key]}
                  onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, [key]: e.target.value } }))}
                />
              </FormField>
            ))}
            {/* Optional label — HR belongs to the company either way */}
            {departments.length > 0 && (
              <FormField label="Department (optional)">
                <select
                  className={`${inputClass} min-h-[44px]`}
                  value={modal.form.departmentId || ''}
                  onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, departmentId: e.target.value } }))}
                >
                  <option value="">No department</option>
                  {departments
                    .filter((d) => d.isActive || d.id === modal.form.departmentId)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                </select>
              </FormField>
            )}
          </div>
        )}
        {modalError && <p className="text-sm text-red-600">{modalError}</p>}
      </Modal>

      <Modal
        open={modal?.kind === 'recruiters'}
        title="Assign agency recruiters"
        onClose={() => setModal(null)}
        footer={<ModalFooter onCancel={() => setModal(null)} onSave={saveModal} saving={busy === 'modal'} />}
      >
        {allRecruiters.length === 0 ? (
          <p className="text-sm text-slate-500">
            No agency recruiters yet.{' '}
            <Link to="/company/recruiters" className="font-medium text-brand-600 hover:underline">
              Invite one
            </Link>
          </p>
        ) : (
          <div className="space-y-1">
            {allRecruiters.map((r) => (
              <label key={r.id} className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50">
                <input
                  type="checkbox"
                  className="h-5 w-5 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  checked={modal?.selected?.includes(r.id) || false}
                  onChange={() =>
                    setModal((m) => ({
                      ...m,
                      selected: m.selected.includes(r.id) ? m.selected.filter((x) => x !== r.id) : [...m.selected, r.id],
                    }))
                  }
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-800">{r.fullName || r.email}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {r.email}
                    {!r.isActive && ' · inactive'}
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}
        {modalError && <p className="mt-3 text-sm text-red-600">{modalError}</p>}
      </Modal>

      <ConfirmDialog
        open={confirm?.kind === 'client'}
        title={`Deactivate ${client.name}?`}
        description="It can't be picked for new jobs. Existing jobs, departments and HR contacts are kept."
        confirmLabel="Deactivate"
        loading={busy === 'client-status'}
        onConfirm={() => run('client-status', () => clientsApi.setStatus(id, false))}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
