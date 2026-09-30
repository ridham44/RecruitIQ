import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Inbox, BadgeCheck, Plus } from 'lucide-react';
import { careersAdminApi } from '../../services/public.js';
import { jobsApi } from '../../services/jobs.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import LoadingState from '../../components/ui/LoadingState.jsx';
import ErrorState from '../../components/ui/ErrorState.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import FormField, { inputClass } from '../../components/ui/FormField.jsx';

const formatDate = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

function Placement({ s }) {
  if (!s.placement) return <span className="text-slate-400">—</span>;
  if (!s.placement.ownJob) return <span className="text-slate-500">Matched to a job at another company</span>;
  return (
    <span>
      {s.placement.jobTitle} <StatusBadge status={s.placement.status} />
    </span>
  );
}

function TopMatches({ s }) {
  const own = s.matches.filter((m) => m.ownJob && m.score != null).slice(0, 3);
  if (!own.length) return <span className="text-xs text-slate-400">No scored matches with your jobs</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {own.map((m) => (
        <span
          key={m.jobId}
          className={`rounded px-2 py-0.5 text-xs font-medium ${m.passes ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}
          title={`Needs ${m.threshold}`}
        >
          {m.jobTitle}: {m.score}
        </span>
      ))}
    </div>
  );
}

// Build plan P4 (§6B) — CVs submitted on the careers page without choosing
// a job, with their AI matches. Recruiters can add a CV to a job by hand.
export default function CvPoolPage() {
  const [items, setItems] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [placing, setPlacing] = useState(null);
  const [jobId, setJobId] = useState('');
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  const load = () => {
    setError('');
    careersAdminApi
      .listPool(status)
      .then((data) => setItems(data.submissions))
      .catch((err) => setError(err.message));
  };

  useEffect(load, [status]);
  useEffect(() => {
    jobsApi
      .listMine()
      .then((data) => setJobs(data.jobs.filter((j) => j.status === 'OPEN')))
      .catch(() => setJobs([]));
  }, []);

  const place = async () => {
    if (!jobId) return setModalError('Choose a job');
    setSaving(true);
    setModalError('');
    try {
      const { submission } = await careersAdminApi.placeFromPool(placing.id, jobId);
      setItems((list) => list.map((x) => (x.id === submission.id ? submission : x)));
      setPlacing(null);
    } catch (err) {
      setModalError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">CV pool</h2>
          <p className="text-sm text-slate-500">CVs submitted on your careers page without choosing a job</p>
        </div>
        <select className={`${inputClass} min-h-[44px] sm:w-48`} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          <option value="">All</option>
          <option value="MATCHED">Matched</option>
          <option value="NO_MATCH">No match</option>
          <option value="PENDING">Pending</option>
          <option value="FAILED">Failed</option>
        </select>
      </div>

      {error && <ErrorState message={error} onRetry={load} />}
      {!error && !items && <LoadingState />}
      {items && items.length === 0 && (
        <EmptyState icon={Inbox} title="No CVs yet" description='Candidates can upload a CV from the "Submit your CV" button on your careers page.' />
      )}

      {items && items.length > 0 && (
        <>
          {/* Mobile: cards */}
          <div className="space-y-3 md:hidden">
            {items.map((s) => (
              <Card key={s.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{s.candidate.fullName}</p>
                    <p className="truncate text-xs text-slate-500">{s.candidate.email}</p>
                    <p className="text-xs text-slate-500">
                      {s.candidate.phone} {s.candidate.phoneVerified && <BadgeCheck className="inline h-3.5 w-3.5 text-emerald-600" aria-label="verified" />}
                    </p>
                  </div>
                  <StatusBadge status={s.status} />
                </div>
                <div className="mt-3 space-y-2 text-sm">
                  <div>
                    <span className="text-xs font-medium text-slate-500">Placed on: </span>
                    <Placement s={s} />
                  </div>
                  <TopMatches s={s} />
                  <p className="text-xs text-slate-400">Received {formatDate(s.createdAt)}</p>
                </div>
                <Button variant="secondary" className="mt-3 w-full" onClick={() => { setPlacing(s); setJobId(''); setModalError(''); }}>
                  <Plus className="h-4 w-4" /> Add to a job
                </Button>
              </Card>
            ))}
          </div>

          {/* Tablet/desktop: table */}
          <Card className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Candidate</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Placed on</th>
                  <th className="px-5 py-3">Your top matches</th>
                  <th className="px-5 py-3">Received</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((s) => (
                  <tr key={s.id} className="align-top hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-900">{s.candidate.fullName}</p>
                      <p className="text-xs text-slate-500">{s.candidate.email}</p>
                      <p className="text-xs text-slate-500">
                        {s.candidate.phone} {s.candidate.phoneVerified && <BadgeCheck className="inline h-3.5 w-3.5 text-emerald-600" aria-label="verified" />}
                      </p>
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="max-w-[220px] px-5 py-3 text-slate-700">
                      <Placement s={s} />
                    </td>
                    <td className="max-w-[260px] px-5 py-3">
                      <TopMatches s={s} />
                    </td>
                    <td className="px-5 py-3 text-slate-500">{formatDate(s.createdAt)}</td>
                    <td className="px-5 py-3 text-right">
                      <Button variant="secondary" onClick={() => { setPlacing(s); setJobId(''); setModalError(''); }}>
                        <Plus className="h-4 w-4" /> Add to job
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      <Modal
        open={Boolean(placing)}
        title={placing ? `Add ${placing.candidate.fullName} to a job` : ''}
        onClose={() => setPlacing(null)}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setPlacing(null)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={place} loading={saving} className="w-full sm:w-auto">
              Add &amp; screen
            </Button>
          </div>
        }
      >
        {jobs.length === 0 ? (
          <p className="text-sm text-slate-500">
            You have no open jobs.{' '}
            <Link to="/company/jobs" className="font-medium text-brand-600 hover:underline">
              Go to jobs
            </Link>
          </p>
        ) : (
          <FormField label="Job">
            <select className={`${inputClass} min-h-[44px]`} value={jobId} onChange={(e) => setJobId(e.target.value)}>
              <option value="">Choose a job…</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                </option>
              ))}
            </select>
          </FormField>
        )}
        <p className="text-xs text-slate-500">The CV is added as an application and screened by AI right away.</p>
        {modalError && <p className="mt-3 text-sm text-red-600">{modalError}</p>}
      </Modal>
    </div>
  );
}
