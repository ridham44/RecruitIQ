import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase,
  Users,
  Plus,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowRight,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  Bot,
  Sparkles,
  RefreshCw,
  FileText,
  Target,
  MessageSquareText,
  ChevronRight,
} from 'lucide-react';
import { companiesApi } from '../../services/companies.js';
import { useAuth } from '../../hooks/useAuth.jsx';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import LoadingState from '../../components/ui/LoadingState.jsx';
import ErrorState from '../../components/ui/ErrorState.jsx';

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Compact Low/Medium/High badge — keeps the recent-interviews table scannable
// instead of a large per-row score circle (Section 4 of the redesign brief).
function scoreTier(score) {
  if (score >= 75) return { label: 'High', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  if (score >= 50) return { label: 'Medium', className: 'bg-amber-50 text-amber-700 border-amber-200' };
  return { label: 'Low', className: 'bg-red-50 text-red-700 border-red-200' };
}

function ScoreBadge({ score }) {
  if (score == null) return <span className="text-xs text-slate-400">—</span>;
  const tier = scoreTier(score);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${tier.className}`}>
      {Math.round(score)} · {tier.label}
    </span>
  );
}

// Short, action-oriented copy per attention-item type so the left column
// reads as "candidate → reason → action" instead of a full sentence.
const ATTENTION_META = {
  SCREENING_PENDING: { reason: () => 'Screening required', action: 'Review Candidate' },
  SCREENED_AWAITING_REVIEW: { reason: (i) => `Screening complete · ${i.badge}`, action: 'Review Candidate' },
  SHORTLISTED_PENDING_SCHEDULE: { reason: () => 'Shortlisted · awaiting interview booking', action: 'Schedule Interview' },
  INTERVIEW_TODAY: { reason: () => 'Interview scheduled today', action: 'View Interview' },
  INTERVIEW_AWAITING_DECISION: {
    reason: (i) => `AI interview completed · Score ${i.badge.replace('/100', '')}`,
    action: 'Review Report',
  },
};

const PRIORITY_WEIGHT = { high: 0, medium: 1, low: 2 };

const ATTENTION_ICON = {
  SCREENING_PENDING: AlertCircle,
  SCREENED_AWAITING_REVIEW: AlertCircle,
  SHORTLISTED_PENDING_SCHEDULE: Clock,
  INTERVIEW_TODAY: Calendar,
  INTERVIEW_AWAITING_DECISION: Bot,
};

const EVALUATION_CATEGORIES = [
  {
    icon: Target,
    name: 'Technical Competency',
    blurb: 'Accuracy and depth of technical answers, scored independently of delivery style.',
  },
  {
    icon: MessageSquareText,
    name: 'Communication & Structure',
    blurb: 'Clarity, relevance, and logical flow of each response.',
  },
  {
    icon: FileText,
    name: 'Requirement & Skill Alignment',
    blurb: 'Deterministic overlap between resume skills and job requirements.',
  },
  {
    icon: ShieldCheck,
    name: 'Security & Proctoring',
    blurb: 'Tab switches, camera/mic presence, and fullscreen exits during the session.',
  },
];

export default function CompanyDashboardPage() {
  const { user } = useAuth();
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAllAttention, setShowAllAttention] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState('');

  const loadData = () => {
    setLoading(true);
    setError('');
    companiesApi
      .getDashboardOverview()
      .then((data) => {
        setOverview(data.overview);
        if (data.overview.candidateChecklistList?.length > 0) {
          setSelectedCandidateId((prev) => prev || data.overview.candidateChecklistList[0].candidateId);
        }
      })
      .catch((err) => setError(err.message || 'Failed to load recruitment overview'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const sortedAttention = useMemo(() => {
    if (!overview?.needsAttention) return [];
    return [...overview.needsAttention].sort(
      (a, b) => (PRIORITY_WEIGHT[a.priority] ?? 2) - (PRIORITY_WEIGHT[b.priority] ?? 2),
    );
  }, [overview?.needsAttention]);

  const visibleAttention = showAllAttention ? sortedAttention : sortedAttention.slice(0, 5);

  const selectedCandidateChecklist = useMemo(() => {
    if (!overview?.candidateChecklistList?.length) return null;
    return (
      overview.candidateChecklistList.find((c) => c.candidateId === selectedCandidateId) ||
      overview.candidateChecklistList[0]
    );
  }, [overview?.candidateChecklistList, selectedCandidateId]);

  if (loading && !overview) return <LoadingState />;
  if (error && !overview) return <ErrorState message={error} onRetry={loadData} />;
  if (!overview) return null;

  const companyName = overview.company?.name || user?.company?.name || 'Recruiter';
  const firstJobId = overview.jobsSummary?.[0]?.id;

  return (
    <div className="space-y-6 pb-12">
      {/* ─── HEADER ─── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Welcome back{companyName ? `, ${companyName}` : ''}
          </h1>
          <p className="text-sm text-slate-500">Here's what needs your attention today.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={loadData} title="Refresh dashboard metrics" className="text-xs">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <Link to="/company/jobs/new">
            <Button className="text-xs">
              <Plus className="h-4 w-4" />
              New Job Posting
            </Button>
          </Link>
        </div>
      </div>

      {/* ─── KPI ROW ─── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Briefcase}
          iconBg="bg-blue-50 text-blue-600"
          value={overview.openJobsCount}
          label="Open Jobs"
          subtext={`${overview.totalJobsCount} total postings`}
          to="/company/jobs"
        />
        <StatCard
          icon={Users}
          iconBg="bg-brand-50 text-brand-600"
          value={overview.totalApplications}
          label="Total Candidates"
          subtext={`Across ${overview.openJobsCount} open job${overview.openJobsCount === 1 ? '' : 's'}`}
          to={firstJobId ? `/company/jobs/${firstJobId}/applications` : '/company/jobs'}
        />
        <StatCard
          icon={Calendar}
          iconBg="bg-amber-50 text-amber-600"
          value={overview.interviewsTodayCount}
          label="Interviews Today"
          subtext={`${overview.scheduledTodayCount} scheduled · ${overview.completedTodayCount} done`}
          to={firstJobId ? `/company/jobs/${firstJobId}/interviews` : '/company/jobs'}
        />
        <StatCard
          icon={Bot}
          iconBg="bg-emerald-50 text-emerald-600"
          value={overview.completedInterviewsCount}
          label="Completed Interviews"
          subtext={
            overview.evaluationOverview?.stats?.avgOverallScore != null
              ? `Avg score ${overview.evaluationOverview.stats.avgOverallScore}/100`
              : 'Evaluated & reported'
          }
          to="#recent-interviews"
        />
      </div>

      {/* ─── NEEDS ATTENTION + PIPELINE ─── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start">
        {/* LEFT: Needs Your Attention */}
        <Card className="p-4 sm:p-5 lg:col-span-7">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Needs Your Attention</h2>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
              {sortedAttention.length}
            </span>
          </div>

          <div className="mt-3 space-y-2">
            {visibleAttention.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center">
                <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-500" />
                <p className="mt-2 text-sm font-medium text-slate-800">All caught up!</p>
                <p className="text-xs text-slate-500">No pending items right now.</p>
              </div>
            ) : (
              visibleAttention.map((item) => {
                const Icon = ATTENTION_ICON[item.type] || AlertCircle;
                const meta = ATTENTION_META[item.type];
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2.5 transition-colors hover:border-brand-200 hover:bg-slate-50/60"
                  >
                    <div className="flex min-w-0 items-start gap-2.5">
                      <div
                        className={`mt-0.5 shrink-0 rounded-md p-1.5 ${
                          item.priority === 'high' ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-500'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{item.candidateName}</p>
                        <p className="truncate text-xs text-slate-500">{item.jobTitle}</p>
                        <p className="truncate text-xs text-slate-600">{meta ? meta.reason(item) : item.description}</p>
                      </div>
                    </div>
                    <Link
                      to={item.targetUrl}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-brand-600 hover:text-white"
                    >
                      {meta ? meta.action : 'Review'}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                );
              })
            )}
          </div>

          {sortedAttention.length > 5 && (
            <button
              type="button"
              onClick={() => setShowAllAttention((s) => !s)}
              className="mt-3 w-full rounded-lg border border-slate-100 py-1.5 text-xs font-medium text-brand-600 hover:bg-slate-50"
            >
              {showAllAttention ? 'Show less' : `View all (${sortedAttention.length})`}
            </button>
          )}
        </Card>

        {/* RIGHT: Candidate Pipeline */}
        <Card className="p-4 sm:p-5 lg:col-span-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Candidate Pipeline</h2>
            <Link
              to={firstJobId ? `/company/jobs/${firstJobId}/applications` : '/company/jobs'}
              className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="mt-3 space-y-2.5">
            {overview.pipeline?.map((stage) => (
              <div key={stage.key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">{stage.label}</span>
                  <span className="font-semibold text-slate-900">
                    {stage.count} <span className="font-normal text-slate-400">({stage.percentage}%)</span>
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      stage.key === 'SHORTLISTED'
                        ? 'bg-amber-500'
                        : stage.key === 'INTERVIEW_COMPLETED'
                          ? 'bg-emerald-500'
                          : stage.key === 'INTERVIEW_SCHEDULED'
                            ? 'bg-blue-500'
                            : stage.key === 'REJECTED'
                              ? 'bg-red-400'
                              : 'bg-slate-400'
                    }`}
                    style={{ width: `${Math.max(stage.percentage, stage.count > 0 ? 4 : 0)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ─── RECENT AI INTERVIEWS ─── */}
      <Card id="recent-interviews" className="p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Recent AI Interviews</h2>
          {firstJobId && (
            <Link
              to={`/company/jobs/${firstJobId}/interviews`}
              className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              View all interviews <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>

        {overview.recentCompleted?.length === 0 ? (
          <div className="p-6 text-center">
            <Bot className="mx-auto h-6 w-6 text-slate-400" />
            <p className="mt-2 text-sm font-medium text-slate-800">No completed interviews yet</p>
            <p className="text-xs text-slate-500">Completed AI interviews will appear here with their scores.</p>
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                <tr className="border-b border-slate-100">
                  <th className="py-2 pr-3">Candidate</th>
                  <th className="py-2 pr-3">Job</th>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Score</th>
                  <th className="py-2 pr-3">Technical</th>
                  <th className="py-2 pr-3">Communication</th>
                  <th className="py-2 pr-3">Security</th>
                  <th className="py-2 pl-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {overview.recentCompleted?.slice(0, 5).map((interview) => (
                  <tr key={interview.interviewId} className="hover:bg-slate-50/70">
                    <td className="py-2.5 pr-3 font-medium text-slate-900">
                      <Link
                        to={`/company/jobs/${interview.jobId}/candidates/${interview.candidateId}`}
                        className="hover:text-brand-600 hover:underline"
                      >
                        {interview.candidateName}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-slate-600">{interview.jobTitle}</td>
                    <td className="py-2.5 pr-3 text-xs text-slate-500">{formatDateTime(interview.date)}</td>
                    <td className="py-2.5 pr-3">
                      <ScoreBadge score={interview.overallScore} />
                    </td>
                    <td className="py-2.5 pr-3 text-xs font-medium text-slate-700">
                      {interview.technicalScore != null ? `${Math.round(interview.technicalScore)}%` : '—'}
                    </td>
                    <td className="py-2.5 pr-3 text-xs font-medium text-slate-700">
                      {interview.communicationScore != null ? `${Math.round(interview.communicationScore)}%` : '—'}
                    </td>
                    <td className="py-2.5 pr-3">
                      {interview.tabSwitches > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                          <ShieldAlert className="h-3 w-3" />
                          {interview.tabSwitches} flag{interview.tabSwitches === 1 ? '' : 's'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                          <ShieldCheck className="h-3 w-3 text-emerald-600" />
                          Clean
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pl-3 text-right">
                      <Link
                        to={interview.detailUrl}
                        className="inline-flex items-center rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100"
                      >
                        View Report
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ─── AI EVALUATION INSIGHTS + RECRUITER REVIEW ─── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start">
        {/* LEFT: AI Interview Evaluation (compact, informational) */}
        <Card className="p-4 sm:p-5 lg:col-span-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-600" />
            <h2 className="text-sm font-semibold text-slate-900">AI Interview Evaluation</h2>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {overview.evaluationOverview?.stats?.totalEvaluated || 0} interviews evaluated with this rubric.
          </p>

          <div className="mt-3 space-y-2.5">
            {EVALUATION_CATEGORIES.map((cat) => (
              <div key={cat.name} className="flex items-start gap-2.5">
                <div className="mt-0.5 shrink-0 rounded-md bg-slate-50 p-1.5 text-slate-500">
                  <cat.icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{cat.name}</p>
                  <p className="text-xs text-slate-500">{cat.blurb}</p>
                </div>
              </div>
            ))}
          </div>

          {firstJobId && (
            <Link
              to={`/company/jobs/${firstJobId}/interviews`}
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              View evaluation details <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </Card>

        {/* RIGHT: Candidate Review (recruiter readiness checklist) */}
        <Card className="p-4 sm:p-5 lg:col-span-6">
          <h2 className="text-sm font-semibold text-slate-900">Candidate Review</h2>

          {overview.candidateChecklistList?.length > 0 ? (
            <>
              <select
                value={selectedCandidateId}
                onChange={(e) => setSelectedCandidateId(e.target.value)}
                className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-xs focus:border-brand-500 focus:outline-hidden"
              >
                {overview.candidateChecklistList.map((c) => (
                  <option key={c.candidateId} value={c.candidateId}>
                    {c.candidateName} — {c.jobTitle}
                  </option>
                ))}
              </select>

              {selectedCandidateChecklist && (
                <>
                  <div className="mt-3 divide-y divide-slate-100">
                    {selectedCandidateChecklist.checks.map((chk) => (
                      <div key={chk.id} className="flex items-center justify-between py-1.5 text-sm" title={chk.detail}>
                        <span className="text-slate-700">{chk.name}</span>
                        <span
                          className={`flex items-center gap-1 text-xs font-semibold ${
                            chk.status === 'passed' ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {chk.status === 'passed' ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5" /> {chk.readyLabel}
                            </>
                          ) : (
                            <>
                              <AlertCircle className="h-3.5 w-3.5" /> Needs Review
                            </>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 flex gap-2">
                    <Link
                      to={selectedCandidateChecklist.targetCandidateUrl}
                      className="flex-1 rounded-lg bg-slate-100 px-3 py-1.5 text-center text-xs font-medium text-slate-700 hover:bg-slate-200"
                    >
                      View Candidate
                    </Link>
                    {selectedCandidateChecklist.targetInterviewUrl && (
                      <Link
                        to={selectedCandidateChecklist.targetInterviewUrl}
                        className="flex-1 rounded-lg bg-brand-600 px-3 py-1.5 text-center text-xs font-medium text-white hover:bg-brand-700"
                      >
                        View Interview Report
                      </Link>
                    )}
                  </div>
                </>
              )}
            </>
          ) : (
            <p className="mt-3 text-xs text-slate-400">No candidates to review yet.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, iconBg, label, value, subtext, to }) {
  const CardWrapper = to ? Link : 'div';
  return (
    <CardWrapper to={to} className={`block ${to ? 'cursor-pointer' : ''}`}>
      <Card className={`p-3.5 transition-colors ${to ? 'hover:border-brand-200' : ''}`}>
        <div className="flex items-center gap-3">
          <div className={`shrink-0 rounded-lg p-2 ${iconBg}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-bold leading-tight text-slate-900">{value}</p>
            <p className="truncate text-xs font-medium text-slate-600">{label}</p>
          </div>
        </div>
        {subtext && <p className="mt-1.5 truncate text-xs text-slate-400">{subtext}</p>}
      </Card>
    </CardWrapper>
  );
}
