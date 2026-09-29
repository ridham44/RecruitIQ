import { useEffect, useState } from 'react';
// import { Link } from 'react-router-dom';
import { Link, useSearchParams } from 'react-router-dom';
import { clientsApi } from '../../services/clients.js';
import { inputClass } from '../../components/ui/FormField.jsx';
import { Plus, Briefcase } from 'lucide-react';
import { jobsApi } from '../../services/jobs.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import LoadingState from '../../components/ui/LoadingState.jsx';
import ErrorState from '../../components/ui/ErrorState.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import { usePermissions } from '../../hooks/usePermissions.js';

export default function JobsListPage() {
  const { can } = usePermissions();
  const [jobs, setJobs] = useState(null);
  const [error, setError] = useState('');
  // Build plan P3: filter by client (?clientId= in the URL, "none" = no client).
  const [searchParams, setSearchParams] = useSearchParams();
  const clientId = searchParams.get('clientId') || '';
  const [clients, setClients] = useState([]);

  const load = () => {
    setError('');
    jobsApi
      // .listMine()
      .listMine(clientId)
      .then((data) => setJobs(data.jobs))
      .catch((err) => setError(err.message));
  };

  // useEffect(load, []);
  useEffect(load, [clientId]);

  useEffect(() => {
    clientsApi
      .list()
      .then((data) => setClients(data.clients))
      .catch(() => setClients([]));
  }, []);

  const setClientFilter = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set('clientId', value);
    else next.delete('clientId');
    setSearchParams(next, { replace: true });
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">Jobs</h2>
        {/* Build plan P2: hidden for recruiters without MANAGE_JOBS */}
        {can('MANAGE_JOBS') && (
          <Link to="/company/jobs/new">
            <Button>
              <Plus className="h-4 w-4" /> New Job
            </Button>
          </Link>
        )}
      </div>

      {/* Build plan P3 */}
      {clients.length > 0 && (
        <div className="mb-4">
          <select
            className={`${inputClass} min-h-[44px] sm:w-64`}
            value={clientId}
            onChange={(e) => setClientFilter(e.target.value)}
            aria-label="Filter by client"
          >
            <option value="">All clients</option>
            <option value="none">No client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && <ErrorState message={error} onRetry={load} />}
      {!error && !jobs && <LoadingState />}
      {jobs && jobs.length === 0 && (
        <EmptyState
          icon={Briefcase}
          // title="No jobs yet"
          title={clientId ? 'No jobs for this client' : 'No jobs yet'}
          // description="Create your first job posting to start receiving applications."
          description={
            clientId
              ? 'Pick another client, or create a job linked to this one.'
              : can('MANAGE_JOBS')
              ? 'Create your first job posting to start receiving applications.'
              : "You haven't been assigned to any jobs yet. Ask your company owner."
          }
          action={
            can('MANAGE_JOBS') && (
              <Link to="/company/jobs/new">
                <Button>Create a job</Button>
              </Link>
            )
          }
        />
      )}

      {jobs && jobs.length > 0 && (
        <Card className="overflow-x-auto">
          {/* <table className="w-full min-w-[560px] text-sm"> */}
          <table className="w-full min-w-[680px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Title</th>
                {/* Build plan P3 */}
                <th className="px-5 py-3">Client</th>
                <th className="px-5 py-3">Work Mode</th>
                <th className="px-5 py-3">Openings</th>
                <th className="px-5 py-3">Location</th>
                <th className="px-5 py-3">Applications</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jobs.map((job) => (
                <tr key={job.id} className="cursor-pointer hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <Link to={`/company/jobs/${job.id}`} className="font-medium text-slate-900 hover:text-brand-600">
                      {job.title}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {job.clientCompany ? (
                      <>
                        {job.clientCompany.name}
                        {job.department && <span className="block text-xs text-slate-400">{job.department.name}</span>}
                      </>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {job.workMode || 'On-site'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{job.openings ?? 1}</td>
                  <td className="px-5 py-3 text-slate-500">{job.location || '—'}</td>
                  <td className="px-5 py-3 text-slate-500">{job._count?.applications ?? 0}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={job.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
