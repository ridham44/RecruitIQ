import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserCog, Pencil } from 'lucide-react';
import { recruitersApi } from '../../services/recruiters.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';

// Build plan P2 — "Assigned recruiters" on the job detail page. Only
// rendered for the owner / recruiters with MANAGE_RECRUITERS.
export default function JobRecruitersCard({ jobId }) {
  const [assigned, setAssigned] = useState(null);
  const [all, setAll] = useState([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([recruitersApi.listForJob(jobId), recruitersApi.list()])
      .then(([a, m]) => {
        setAssigned(a.recruiters);
        setAll(m.members.filter((x) => x.role === 'RECRUITER'));
      })
      .catch((err) => setError(err.message));
  }, [jobId]);

  const openEdit = () => {
    setSelected((assigned || []).map((r) => r.id));
    setError('');
    setOpen(true);
  };

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const { recruiters } = await recruitersApi.setForJob(jobId, selected);
      setAssigned(recruiters);
      setOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mt-4 p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900">Assigned agency recruiters</h3>
        {assigned && all.length > 0 && (
          <Button variant="secondary" onClick={openEdit}>
            <Pencil className="h-4 w-4" /> Change
          </Button>
        )}
      </div>
      {error && !open && <p className="text-sm text-red-600">{error}</p>}
      {!assigned && !error && <p className="text-sm text-slate-400">Loading…</p>}
      {assigned && assigned.length === 0 && (
        <p className="text-sm text-slate-500">
          {all.length ? 'Nobody assigned yet — only the agency owner works this job.' : 'No agency recruiters in your agency yet.'}{' '}
          {!all.length && (
            <Link to="/company/recruiters" className="font-medium text-brand-600 hover:underline">
              Invite one
            </Link>
          )}
        </p>
      )}
      {assigned && assigned.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {assigned.map((r) => (
            <span key={r.id} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              <UserCog className="h-3.5 w-3.5" />
              {r.fullName || r.email}
              {!r.isActive && <span className="text-slate-400">(inactive)</span>}
            </span>
          ))}
        </div>
      )}

      <Modal
        open={open}
        title="Assign agency recruiters"
        onClose={() => setOpen(false)}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setOpen(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={save} loading={saving} className="w-full sm:w-auto">
              Save
            </Button>
          </div>
        }
      >
        <div className="space-y-1">
          {all.map((r) => (
            <label key={r.id} className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50">
              <input
                type="checkbox"
                className="h-5 w-5 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                checked={selected.includes(r.id)}
                onChange={() => toggle(r.id)}
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
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </Modal>
    </Card>
  );
}
