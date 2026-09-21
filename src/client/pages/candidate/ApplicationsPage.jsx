import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Search } from 'lucide-react';
import { applicationsApi } from '../../services/applications.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import LoadingState from '../../components/ui/LoadingState.jsx';
import ErrorState from '../../components/ui/ErrorState.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';

export default function ApplicationsPage() {
  const [applications, setApplications] = useState(null);
  const [error, setError] = useState('');

  const load = () => {
    setError('');
    applicationsApi
      .listMine()
      .then((data) => setApplications(data.applications))
      .catch((err) => setError(err.message));
  };

  useEffect(load, []);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!applications) return <LoadingState />;

  if (applications.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No applications yet"
        description="Browse open jobs and apply to get started."
        action={
          <Link to="/candidate/jobs">
            <Button>
              <Search className="h-4 w-4" /> Find jobs
            </Button>
          </Link>
        }
      />
    );
  }

  return (
    <div>
      <h2 className="mb-6 text-xl font-semibold text-slate-900">My applications</h2>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">Job</th>
              <th className="px-5 py-3">Company</th>
              <th className="px-5 py-3">Applied</th>
              <th className="px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {applications.map((app) => (
              <tr key={app.id} className="cursor-pointer hover:bg-slate-50">
                <td className="px-5 py-3">
                  <Link to={`/candidate/applications/${app.id}`} className="font-medium text-slate-900 hover:text-brand-600">
                    {app.job.title}
                  </Link>
                </td>
                <td className="px-5 py-3 text-slate-500">{app.job.company.name}</td>
                <td className="px-5 py-3 text-slate-500">{new Date(app.createdAt).toLocaleDateString()}</td>
                <td className="px-5 py-3">
                  <StatusBadge status={app.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
