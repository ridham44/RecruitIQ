import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Search, CheckCircle2, CalendarClock, User } from 'lucide-react';
import { applicationsApi } from '../../services/applications.js';
import { candidateProfileApi } from '../../services/profile.js';
import { useAuth } from '../../hooks/useAuth.jsx';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import LoadingState from '../../components/ui/LoadingState.jsx';
import ErrorState from '../../components/ui/ErrorState.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';

/** Calculate profile completeness 0–100 based on which key fields are filled. */
function calcCompleteness(candidate) {
  const checks = [
    !!candidate?.fullName,
    !!candidate?.phone,
    !!candidate?.location,
    !!candidate?.headline,
    (candidate?.skills?.length ?? 0) > 0,
    (candidate?.educations?.length ?? 0) > 0,
  ];
  const filled = checks.filter(Boolean).length;
  return Math.round((filled / checks.length) * 100);
}

function CompletenessBar({ pct }) {
  const color =
    pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : 'bg-rose-400';
  return (
    <Card className="mb-8 p-5">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-700">Profile completeness</span>
        </div>
        <span className="text-sm font-semibold text-slate-900">{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {pct < 100 && (
        <p className="mt-2 text-xs text-slate-400">
          {pct < 50
            ? 'Complete your profile to get better job matches.'
            : pct < 80
            ? 'Almost there — add more info to stand out to recruiters.'
            : 'Looking great! A complete profile boosts your visibility.'}
        </p>
      )}
    </Card>
  );
}

export default function CandidateDashboardPage() {
  const { user } = useAuth();
  const [applications, setApplications] = useState(null);
  const [candidate, setCandidate] = useState(null);
  const [error, setError] = useState('');

  const load = () => {
    setError('');
    Promise.all([applicationsApi.listMine(), candidateProfileApi.get()])
      .then(([appData, profileData]) => {
        setApplications(appData.applications);
        setCandidate(profileData.candidate);
      })
      .catch((err) => setError(err.message));
  };

  useEffect(load, []);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!applications || !candidate) return <LoadingState />;

  const shortlisted = applications.filter((a) => a.status === 'SHORTLISTED').length;
  const interviews = applications.filter((a) =>
    ['INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED'].includes(a.status),
  ).length;
  const completeness = calcCompleteness(candidate);

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

      {/* Stat cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="flex items-center gap-4 p-5">
          <div className="rounded-lg bg-brand-50 p-3">
            <FileText className="h-5 w-5 text-brand-600" />
          </div>
          <div>
            <p className="text-2xl font-semibold text-slate-900">{applications.length}</p>
            <p className="text-sm text-slate-500">Applications</p>
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
        <Card className="flex items-center gap-4 p-5">
          <div className="rounded-lg bg-violet-50 p-3">
            <CalendarClock className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <p className="text-2xl font-semibold text-slate-900">{interviews}</p>
            <p className="text-sm text-slate-500">Interviews</p>
          </div>
        </Card>
      </div>

      {/* Profile completeness */}
      <CompletenessBar pct={completeness} />

      {/* Recent applications */}
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
