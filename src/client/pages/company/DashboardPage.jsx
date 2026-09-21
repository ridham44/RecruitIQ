import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, Users, Plus, TrendingUp } from 'lucide-react';
import { jobsApi } from '../../services/jobs.js';
import { useAuth } from '../../hooks/useAuth.jsx';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import LoadingState from '../../components/ui/LoadingState.jsx';
import ErrorState from '../../components/ui/ErrorState.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';

export default function CompanyDashboardPage() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState(null);
  const [error, setError] = useState('');

  const load = () => {
    setError('');
    jobsApi
      .listMine()
      .then((data) => setJobs(data.jobs))
      .catch((err) => setError(err.message));
  };

  useEffect(load, []);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!jobs) return <LoadingState />;

  const openJobs = jobs.filter((j) => j.status === 'OPEN');
  const totalApplications = jobs.reduce((sum, j) => sum + (j._count?.applications || 0), 0);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Welcome back{user?.company?.name ? `, ${user.company.name}` : ''}</h2>
          <p className="text-sm text-slate-500">Here's what's happening with your hiring.</p>
        </div>
        <Link to="/company/jobs/new" className="w-full sm:w-auto">
          <Button className="w-full sm:w-auto">
            <Plus className="h-4 w-4" /> New Job
          </Button>
        </Link>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard icon={Briefcase} label="Open jobs" value={openJobs.length} />
        <StatCard icon={Users} label="Total applications" value={totalApplications} />
        <StatCard icon={TrendingUp} label="Total jobs posted" value={jobs.length} />
      </div>

      <Card className="p-5">
        <h3 className="mb-4 font-semibold text-slate-900">Recent jobs</h3>
        {jobs.length === 0 ? (
          <p className="text-sm text-slate-500">You haven't posted any jobs yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {jobs.slice(0, 5).map((job) => (
              <Link
                key={job.id}
                to={`/company/jobs/${job.id}`}
                className="flex items-center justify-between py-3 hover:bg-slate-50"
              >
                <div>
                  <p className="font-medium text-slate-900">{job.title}</p>
                  <p className="text-xs text-slate-500">{job._count?.applications || 0} applications</p>
                </div>
                <StatusBadge status={job.status} />
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <div className="rounded-lg bg-brand-50 p-3">
        <Icon className="h-5 w-5 text-brand-600" />
      </div>
      <div>
        <p className="text-2xl font-semibold text-slate-900">{value}</p>
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </Card>
  );
}
