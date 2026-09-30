import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, ChevronRight } from 'lucide-react';
import { clientPortalApi } from '../../services/clientPortal.js';
import Card from '../../components/ui/Card.jsx';
import LoadingState from '../../components/ui/LoadingState.jsx';
import ErrorState from '../../components/ui/ErrorState.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import { inputClass } from '../../components/ui/FormField.jsx';

const fmt = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const round = (v) => (v != null ? Math.round(v) : '—');

function NewBadge() {
  return <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">New</span>;
}

// Build plan P8 — /client/candidates: everything shared with this HR person.
export default function ClientCandidatesPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [jobId, setJobId] = useState('');

  const load = () => {
    setError('');
    clientPortalApi
      .list(jobId)
      .then(setData)
      .catch((err) => setError(err.message));
  };

  useEffect(load, [jobId]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <LoadingState />;

  const { me, jobs, submissions } = data;
  const newCount = submissions.filter((s) => s.isNew).length;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900">Candidates</h2>
        <p className="text-sm text-slate-500">
          Shared with you by {me.recruitmentCompany} · {me.clientName} — {me.department}
          {newCount > 0 && ` · ${newCount} new`}
        </p>
      </div>

      {jobs.length > 1 && (
        <select className={`${inputClass} mb-4 min-h-[44px] sm:w-72`} value={jobId} onChange={(e) => setJobId(e.target.value)} aria-label="Filter by job">
          <option value="">All jobs</option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.title}
            </option>
          ))}
        </select>
      )}

      {submissions.length === 0 && (
        <EmptyState icon={Users} title="No candidates yet" description="Candidates your recruitment partner shares with you will appear here." />
      )}

      {submissions.length > 0 && (
        <>
          {/* Mobile: cards */}
          <div className="space-y-3 md:hidden">
            {submissions.map((s) => (
              <Link key={s.id} to={`/client/candidates/${s.id}`} className="block">
                <Card className="flex items-center gap-3 p-4 active:bg-slate-50">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-slate-900">{s.candidateName}</p>
                      {s.isNew && <NewBadge />}
                    </div>
                    <p className="truncate text-sm text-slate-500">{s.job?.title}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Final {round(s.finalScore)} · Shared {fmt(s.submittedAt)}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
                </Card>
              </Link>
            ))}
          </div>

          {/* Tablet/desktop: table */}
          <Card className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Candidate</th>
                  <th className="px-5 py-3">Job</th>
                  <th className="px-5 py-3">CV</th>
                  <th className="px-5 py-3">Interview</th>
                  <th className="px-5 py-3">Final</th>
                  <th className="px-5 py-3">Shared</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {submissions.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <Link to={`/client/candidates/${s.id}`} className="inline-flex items-center gap-2 font-medium text-slate-900 hover:text-brand-600">
                        {s.candidateName} {s.isNew && <NewBadge />}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{s.job?.title}</td>
                    <td className="px-5 py-3 text-slate-600">{round(s.cvScore)}</td>
                    <td className="px-5 py-3 text-slate-600">{round(s.interviewScore)}</td>
                    <td className="px-5 py-3 font-semibold text-slate-900">{round(s.finalScore)}</td>
                    <td className="px-5 py-3 text-slate-500">{fmt(s.submittedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
