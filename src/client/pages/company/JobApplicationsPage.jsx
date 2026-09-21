import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Sparkles, Eye, Users } from 'lucide-react';
import { screeningApi } from '../../services/screening.js';
import { jobsApi } from '../../services/jobs.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import LoadingState from '../../components/ui/LoadingState.jsx';
import ErrorState from '../../components/ui/ErrorState.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import ScoreRing from '../../components/ui/ScoreRing.jsx';

export default function JobApplicationsPage() {
  const { id: jobId } = useParams();
  const [job, setJob] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const [showTop10Only, setShowTop10Only] = useState(false);

  const load = () => {
    setError('');
    Promise.all([jobsApi.get(jobId), screeningApi.getRanked(jobId)])
      .then(([jobRes, rankedRes]) => {
        setJob(jobRes.job);
        setData(rankedRes);
      })
      .catch((err) => setError(err.message));
  };

  useEffect(load, [jobId]);

  const handleRunScreening = async () => {
    setRunning(true);
    setError('');
    try {
      await screeningApi.runForJob(jobId);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  if (error && !data) return <ErrorState message={error} onRetry={load} />;
  if (!data || !job) return <LoadingState />;

  const rows = showTop10Only ? data.ranked.slice(0, 10) : data.ranked;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Applications — {job.title}</h2>
          <p className="text-sm text-slate-500">
            {data.totalScreened} screened · {data.unscreened.length} pending screening
          </p>
        </div>
        <Button onClick={handleRunScreening} loading={running} disabled={data.unscreened.length === 0}>
          <Sparkles className="h-4 w-4" />
          {data.unscreened.length === 0 ? 'All screened' : `Run AI Screening (${data.unscreened.length})`}
        </Button>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {data.ranked.length === 0 && data.unscreened.length === 0 && (
        <EmptyState icon={Users} title="No applications yet" description="Candidates who apply to this job will show up here." />
      )}

      {data.ranked.length > 0 && (
        <Card className="mb-6 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <h3 className="font-semibold text-slate-900">Ranked candidates</h3>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={showTop10Only} onChange={(e) => setShowTop10Only(e.target.checked)} />
              Top 10 only
            </label>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Rank</th>
                <th className="px-5 py-3">Candidate</th>
                <th className="px-5 py-3">Match</th>
                <th className="px-5 py-3">Matched skills</th>
                <th className="px-5 py-3">Missing skills</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(({ rank, application }) => (
                <tr key={application.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-900">#{rank}</td>
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-900">{application.candidate.fullName}</p>
                    <StatusBadge status={application.status} />
                  </td>
                  <td className="px-5 py-3">
                    <ScoreRing score={application.screeningResult?.overallScore ?? 0} size={36} />
                  </td>
                  <td className="max-w-xs px-5 py-3 text-slate-600">
                    {(application.screeningResult?.matchedSkills || []).slice(0, 4).join(', ') || '—'}
                  </td>
                  <td className="max-w-xs px-5 py-3 text-slate-600">
                    {(application.screeningResult?.missingSkills || []).slice(0, 4).join(', ') || '—'}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      to={`/company/jobs/${jobId}/candidates/${application.candidate.id}`}
                      className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-700"
                    >
                      <Eye className="h-4 w-4" /> View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {data.unscreened.length > 0 && (
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-3">
            <h3 className="font-semibold text-slate-900">Awaiting screening</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Candidate</th>
                <th className="px-5 py-3">Applied</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.unscreened.map((application) => (
                <tr key={application.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-900">{application.candidate.fullName}</td>
                  <td className="px-5 py-3 text-slate-500">{new Date(application.createdAt).toLocaleDateString()}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={application.status} />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      to={`/company/jobs/${jobId}/candidates/${application.candidate.id}`}
                      className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-700"
                    >
                      <Eye className="h-4 w-4" /> View
                    </Link>
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
