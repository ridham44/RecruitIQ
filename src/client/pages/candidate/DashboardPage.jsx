import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Search, CheckCircle2 } from 'lucide-react';
import { applicationsApi } from '../../services/applications.js';
import { useAuth } from '../../hooks/useAuth.jsx';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import LoadingState from '../../components/ui/LoadingState.jsx';
import ErrorState from '../../components/ui/ErrorState.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';

export default function CandidateDashboardPage() {
  const { user } = useAuth();
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

  const shortlisted = applications.filter((a) => a.status === 'SHORTLISTED').length;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Welcome{user?.candidate?.fullName ? `, ${user.candidate.fullName.split(' ')[0]}` : ''}
          </h2>
          <p className="text-sm text-slate-500">Track your applications and discover new roles.</p>
        </div>
        <Link to="/candidate/jobs">
          <Button>
            <Search className="h-4 w-4" /> Find Jobs
          </Button>
        </Link>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <Card className="flex items-center gap-4 p-5">
          <div className="rounded-lg bg-brand-50 p-3">
            <FileText className="h-5 w-5 text-brand-600" />
          </div>
          <div>
            <p className="text-2xl font-semibold text-slate-900">{applications.length}</p>
            <p className="text-sm text-slate-500">Applications submitted</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-5">
          <div className="rounded-lg bg-emerald-50 p-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-2xl font-semibold text-slate-900">{shortlisted}</p>
            <p className="text-sm text-slate-500">Shortlisted</p>
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="mb-4 font-semibold text-slate-900">Recent applications</h3>
        {applications.length === 0 ? (
          <p className="text-sm text-slate-500">You haven't applied to any jobs yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {applications.slice(0, 5).map((app) => (
              <Link
                key={app.id}
                to={`/candidate/applications/${app.id}`}
                className="flex items-center justify-between py-3 hover:bg-slate-50"
              >
                <div>
                  <p className="font-medium text-slate-900">{app.job.title}</p>
                  <p className="text-xs text-slate-500">{app.job.company.name}</p>
                </div>
                <StatusBadge status={app.status} />
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
