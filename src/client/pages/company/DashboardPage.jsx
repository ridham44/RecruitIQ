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
  ExternalLink,
  AlertCircle,
  ShieldAlert,
  Bot,
  Sparkles,
  RefreshCw,
  FileText,
  Award,
  Check,
  X,
  ChevronRight,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';
import { companiesApi } from '../../services/companies.js';
import { useAuth } from '../../hooks/useAuth.jsx';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import LoadingState from '../../components/ui/LoadingState.jsx';
import ErrorState from '../../components/ui/ErrorState.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import ScoreRing from '../../components/ui/ScoreRing.jsx';

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function CompanyDashboardPage() {
  const { user } = useAuth();
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attentionFilter, setAttentionFilter] = useState('ALL');
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

  // Filtered actionable attention items
  const filteredAttention = useMemo(() => {
    if (!overview?.needsAttention) return [];
    if (attentionFilter === 'ALL') return overview.needsAttention;
    if (attentionFilter === 'SHORTLISTED') {
      return overview.needsAttention.filter((i) => i.type === 'SHORTLISTED_PENDING_SCHEDULE');
    }
    if (attentionFilter === 'REVIEW') {
      return overview.needsAttention.filter((i) => i.type === 'SCREENED_AWAITING_REVIEW' || i.type === 'SCREENING_PENDING');
    }
    if (attentionFilter === 'TODAY') {
      return overview.needsAttention.filter((i) => i.type === 'INTERVIEW_TODAY');
    }
    if (attentionFilter === 'DECISION') {
      return overview.needsAttention.filter((i) => i.type === 'INTERVIEW_AWAITING_DECISION');
    }
    return overview.needsAttention;
  }, [overview?.needsAttention, attentionFilter]);

  // Selected candidate for recruiter checklist
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

  return (
    <div className="space-y-8 pb-12">
      {/* ─── HEADER / WELCOME ─── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Welcome back{companyName ? `, ${companyName}` : ''}
            </h1>
            <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700 border border-brand-200">
              Recruiter Command Center
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Real-time recruitment intelligence, candidate pipeline health, and actionable next steps.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            onClick={loadData}
            title="Refresh dashboard metrics"
            className="flex items-center gap-1.5 text-xs font-medium"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <Link to="/company/jobs/new">
            <Button className="flex items-center gap-1.5 text-xs font-medium">
              <Plus className="h-4 w-4" />
              New Job Posting
            </Button>
          </Link>
        </div>
      </div>

      {/* ─── TOP SECTION: 4 KEY METRICS CARDS ─── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. Open Jobs */}
        <StatCard
          icon={Briefcase}
          iconBg="bg-blue-50 text-blue-600 border-blue-100"
          value={overview.openJobsCount}
          label="Open Active Jobs"
          subtext={`${overview.totalJobsCount} total postings created`}
          to="/company/jobs"
        />

        {/* 2. Total Candidates */}
        <StatCard
          icon={Users}
          iconBg="bg-brand-50 text-brand-600 border-brand-100"
          value={overview.totalApplications}
          label="Total Candidates"
          subtext={`Across ${overview.openJobsCount} open job${overview.openJobsCount === 1 ? '' : 's'}`}
          to={overview.jobsSummary?.[0] ? `/company/jobs/${overview.jobsSummary[0].id}/applications` : '/company/jobs'}
        />

        {/* 3. Interviews Today */}
        <StatCard
          icon={Calendar}
          iconBg="bg-amber-50 text-amber-600 border-amber-100"
          value={overview.interviewsTodayCount}
          label="Interviews Today"
          subtext={`${overview.scheduledTodayCount} scheduled · ${overview.completedTodayCount} completed`}
          highlight={overview.interviewsTodayCount > 0}
          to={overview.jobsSummary?.[0] ? `/company/jobs/${overview.jobsSummary[0].id}/interviews` : '/company/jobs'}
        />

        {/* 4. Completed AI Interviews */}
        <StatCard
          icon={Bot}
          iconBg="bg-emerald-50 text-emerald-600 border-emerald-100"
          value={overview.completedInterviewsCount}
          label="Completed AI Interviews"
          subtext={
            overview.evaluationOverview?.stats?.avgOverallScore != null
              ? `Avg score: ${overview.evaluationOverview.stats.avgOverallScore}/100`
              : 'Evaluated & reported'
          }
          to="#recent-interviews"
        />
      </div>

      {/* ─── MIDDLE SECTION: ACTIONABLE ATTENTION & PIPELINE BY STAGE ─── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* LEFT (Col 7): Needs Your Attention Today */}
        <div className="lg:col-span-7">
          <Card className="h-full p-5 flex flex-col justify-between">
            <div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-slate-900">Who Needs Your Attention Today</h2>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                      {overview.needsAttention?.length || 0}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    High-priority candidates and interview milestones requiring immediate action.
                  </p>
                </div>
              </div>

              {/* Action Category Filter Tabs */}
              <div className="mt-3 flex flex-wrap gap-1.5 pb-2">
                {[
                  { key: 'ALL', label: `All (${overview.needsAttention?.length || 0})` },
                  {
                    key: 'SHORTLISTED',
                    label: `Shortlisted (${overview.needsAttention?.filter((i) => i.type === 'SHORTLISTED_PENDING_SCHEDULE').length || 0})`,
                  },
                  {
                    key: 'DECISION',
                    label: `AI Decisions (${overview.needsAttention?.filter((i) => i.type === 'INTERVIEW_AWAITING_DECISION').length || 0})`,
                  },
                  {
                    key: 'TODAY',
                    label: `Today (${overview.needsAttention?.filter((i) => i.type === 'INTERVIEW_TODAY').length || 0})`,
                  },
                  {
                    key: 'REVIEW',
                    label: `Review (${overview.needsAttention?.filter((i) => i.type.includes('SCREEN')).length || 0})`,
                  },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setAttentionFilter(tab.key)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                      attentionFilter === tab.key
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Action Items List */}
              <div className="mt-3 space-y-2.5">
                {filteredAttention.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
                    <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
                    <p className="mt-2 text-sm font-medium text-slate-800">All caught up!</p>
                    <p className="text-xs text-slate-500">No pending items in this category.</p>
                  </div>
                ) : (
                  filteredAttention.slice(0, 5).map((item) => (
                    <div
                      key={item.id}
                      className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white p-3.5 shadow-xs transition-all hover:border-brand-200 hover:shadow-sm"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 rounded-lg p-2 ${
                            item.priority === 'high'
                              ? 'bg-amber-50 text-amber-600'
                              : 'bg-slate-50 text-slate-600'
                          }`}
                        >
                          {item.type === 'SHORTLISTED_PENDING_SCHEDULE' ? (
                            <Clock className="h-4 w-4" />
                          ) : item.type === 'INTERVIEW_TODAY' ? (
                            <Calendar className="h-4 w-4" />
                          ) : item.type === 'INTERVIEW_AWAITING_DECISION' ? (
                            <Bot className="h-4 w-4" />
                          ) : (
                            <AlertCircle className="h-4 w-4" />
                          )}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900">{item.candidateName}</span>
                            <span className="text-xs text-slate-400">for {item.jobTitle}</span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                              {item.badge}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-slate-600 line-clamp-2">{item.description}</p>
                        </div>
                      </div>
                      <Link
                        to={item.targetUrl}
                        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors group-hover:bg-brand-600 group-hover:text-white"
                      >
                        Action <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  ))
                )}
              </div>
            </div>

            {filteredAttention.length > 5 && (
              <div className="mt-4 border-t border-slate-100 pt-3 text-center">
                <p className="text-xs text-slate-500">
                  Showing 5 of {filteredAttention.length} actionable items.
                </p>
              </div>
            )}
          </Card>
        </div>

        {/* RIGHT (Col 5): Candidate Pipeline by Stage */}
        <div className="lg:col-span-5">
          <Card className="h-full p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Candidate Pipeline by Stage</h2>
                  <p className="text-xs text-slate-500">
                    Distribution of {overview.totalApplications} total applicants across all active stages.
                  </p>
                </div>
                <Link
                  to={overview.jobsSummary?.[0] ? `/company/jobs/${overview.jobsSummary[0].id}/applications` : '/company/jobs'}
                  className="text-xs font-medium text-brand-600 hover:text-brand-700 flex items-center gap-1"
                >
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              {/* Pipeline Stage Funnel Breakdown */}
              <div className="mt-4 space-y-3">
                {overview.pipeline?.map((stage) => {
                  const percent = stage.percentage;
                  return (
                    <div key={stage.key} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={stage.key} />
                          <span className="font-medium text-slate-700">{stage.label}</span>
                        </div>
                        <span className="font-semibold text-slate-900">
                          {stage.count}{' '}
                          <span className="font-normal text-slate-400">({percent}%)</span>
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full transition-all duration-500 ${
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
                          style={{ width: `${Math.max(percent, stage.count > 0 ? 4 : 0)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Active Jobs Quick Status */}
            <div className="mt-6 rounded-xl bg-slate-50 p-3.5 border border-slate-100">
              <p className="text-xs font-semibold text-slate-700 mb-2">Active Job Breakdown</p>
              {overview.jobsSummary?.length === 0 ? (
                <p className="text-xs text-slate-500">No active jobs posted yet.</p>
              ) : (
                <div className="divide-y divide-slate-200/60 max-h-36 overflow-y-auto pr-1">
                  {overview.jobsSummary?.map((job) => (
                    <Link
                      key={job.id}
                      to={`/company/jobs/${job.id}/applications`}
                      className="flex items-center justify-between py-2 text-xs hover:text-brand-600 transition-colors"
                    >
                      <span className="font-medium text-slate-900 truncate max-w-[180px]">{job.title}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-slate-500">{job.applicationsCount} candidate{job.applicationsCount === 1 ? '' : 's'}</span>
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* ─── LOWER SECTION 1: RECENT COMPLETED INTERVIEWS TABLE ─── */}
      <div id="recent-interviews">
        <Card className="p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-slate-900">Recent Completed AI Interviews</h2>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                  {overview.recentCompleted?.length || 0}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Completed voice interviews evaluated with question-level analysis and proctoring logs.
              </p>
            </div>
            {overview.jobsSummary?.[0] && (
              <Link to={`/company/jobs/${overview.jobsSummary[0].id}/interviews`}>
                <Button variant="secondary" className="text-xs">
                  Manage Interview Slots & Config
                </Button>
              </Link>
            )}
          </div>

          {overview.recentCompleted?.length === 0 ? (
            <div className="p-8 text-center">
              <Bot className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-2 text-sm font-medium text-slate-800">No completed interviews yet</p>
              <p className="text-xs text-slate-500">
                Candidates who complete their AI interview session will appear here with full evaluation scores.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 tracking-wider">
                  <tr>
                    <th className="px-4 py-3 rounded-l-lg">Candidate</th>
                    <th className="px-4 py-3">Job Posting</th>
                    <th className="px-4 py-3">Interview Date</th>
                    <th className="px-4 py-3 text-center">Overall Score</th>
                    <th className="px-4 py-3 text-center">Technical</th>
                    <th className="px-4 py-3 text-center">Communication</th>
                    <th className="px-4 py-3">Security & Integrity</th>
                    <th className="px-4 py-3 text-right rounded-r-lg">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {overview.recentCompleted?.map((interview) => (
                    <tr key={interview.interviewId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        <Link
                          to={`/company/jobs/${interview.jobId}/candidates/${interview.candidateId}`}
                          className="hover:text-brand-600 hover:underline"
                        >
                          {interview.candidateName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{interview.jobTitle}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(interview.date)}</td>
                      <td className="px-4 py-3 text-center">
                        {interview.overallScore != null ? (
                          <div className="inline-flex justify-center">
                            <ScoreRing score={interview.overallScore} size={36} />
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Pending</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-xs font-medium text-slate-700">
                        {interview.technicalScore != null ? `${Math.round(interview.technicalScore)}%` : '—'}
                      </td>
                      <td className="px-4 py-3 text-center text-xs font-medium text-slate-700">
                        {interview.communicationScore != null ? `${Math.round(interview.communicationScore)}%` : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {interview.tabSwitches > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">
                            <ShieldAlert className="h-3 w-3" />
                            {interview.tabSwitches} tab switch{interview.tabSwitches === 1 ? '' : 'es'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                            <Check className="h-3 w-3 text-emerald-600" />
                            {interview.eventsCount} clean events
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={interview.detailUrl}
                          className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 transition-colors"
                        >
                          View Report <ExternalLink className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* ─── LOWER SECTION 2: WHAT AI EVALUATED & RECRUITER CHECKLIST ─── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Card A (Col 6): What Did the AI Interview Actually Evaluate? */}
        <div className="lg:col-span-6">
          <Card className="h-full p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
                <div className="rounded-lg bg-purple-50 p-2 text-purple-600">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-900">What Did AI Interview Actually Evaluate?</h2>
                  <p className="text-xs text-slate-500">
                    Phase 3 deterministic rubric & LLM evaluation categories stored in RecruitIQ.
                  </p>
                </div>
              </div>

              {/* 4 Pillars Breakdown */}
              <div className="mt-4 space-y-3">
                {overview.evaluationOverview?.pillars?.map((pillar, idx) => (
                  <div key={idx} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">{pillar.name}</span>
                      {pillar.avgScore != null && (
                        <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-800">
                          Cohort Avg: {pillar.avgScore}%
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600">{pillar.description}</p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {pillar.rubric?.map((r, rIdx) => (
                        <span
                          key={rIdx}
                          className="rounded-md bg-white border border-slate-200/80 px-2 py-0.5 text-[11px] text-slate-600 font-medium"
                        >
                          ✓ {r}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Real Strengths Observed */}
              {overview.evaluationOverview?.stats?.commonStrengths?.length > 0 && (
                <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3.5">
                  <p className="text-xs font-bold text-emerald-900 mb-1.5 flex items-center gap-1.5">
                    <Award className="h-3.5 w-3.5 text-emerald-700" />
                    Observed Strengths in Candidate Answers
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {overview.evaluationOverview.stats.commonStrengths.map((str, sIdx) => (
                      <span
                        key={sIdx}
                        className="rounded-full bg-emerald-100/80 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800"
                      >
                        {str}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 border-t border-slate-100 pt-3 flex items-center justify-between text-xs text-slate-500">
              <span>{overview.evaluationOverview?.stats?.totalEvaluated || 0} interviews deeply evaluated</span>
              <span className="text-slate-400">Deterministic check & LLM reasoning</span>
            </div>
          </Card>
        </div>

        {/* Card B (Col 6): What Should I Review Before Moving a Candidate Forward? */}
        <div className="lg:col-span-6">
          <Card className="h-full p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-lg bg-brand-50 p-2 text-brand-600">
                    <SlidersHorizontal className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">Review Before Moving Forward</h2>
                    <p className="text-xs text-slate-500">
                      Recruiter verification checklist before advancing or extending offers.
                    </p>
                  </div>
                </div>
              </div>

              {/* Candidate Selector */}
              {overview.candidateChecklistList?.length > 0 && (
                <div className="mt-4">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Select Candidate to Check Readiness:
                  </label>
                  <select
                    value={selectedCandidateId}
                    onChange={(e) => setSelectedCandidateId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-xs focus:border-brand-500 focus:outline-hidden"
                  >
                    {overview.candidateChecklistList.map((c) => (
                      <option key={c.candidateId} value={c.candidateId}>
                        {c.candidateName} — {c.applicationStatus.replace(/_/g, ' ')} ({c.passedCount}/{c.totalChecks} verified)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Checklist Items for Selected Candidate */}
              {selectedCandidateChecklist ? (
                <div className="mt-4 space-y-2">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">
                      {selectedCandidateChecklist.candidateName} · {selectedCandidateChecklist.jobTitle}
                    </span>
                    <span
                      className={`font-bold ${
                        selectedCandidateChecklist.readyToAdvance ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      {selectedCandidateChecklist.passedCount}/{selectedCandidateChecklist.totalChecks} Verified
                    </span>
                  </div>

                  <div className="space-y-1.5 divide-y divide-slate-100">
                    {selectedCandidateChecklist.checks.map((chk) => (
                      <div key={chk.id} className="pt-1.5 flex items-start justify-between gap-3 text-xs">
                        <div className="flex items-start gap-2">
                          <span
                            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                              chk.status === 'passed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : chk.status === 'warning'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {chk.status === 'passed' ? '✓' : '!'}
                          </span>
                          <div>
                            <span className="font-medium text-slate-900">{chk.name}</span>
                            <p className="text-slate-500 text-[11px]">{chk.detail}</p>
                          </div>
                        </div>
                        <span
                          className={`shrink-0 text-[10px] font-semibold uppercase ${
                            chk.status === 'passed'
                              ? 'text-emerald-700'
                              : chk.status === 'warning'
                                ? 'text-amber-600'
                                : 'text-red-600'
                          }`}
                        >
                          {chk.status === 'passed' ? 'Verified' : 'Check'}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Readiness Banner */}
                  <div
                    className={`mt-4 rounded-xl p-3 border ${
                      selectedCandidateChecklist.readyToAdvance
                        ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                        : 'bg-amber-50/70 border-amber-200 text-amber-900'
                    }`}
                  >
                    <p className="text-xs font-semibold">
                      {selectedCandidateChecklist.readyToAdvance
                        ? 'Candidate meets standard verification criteria for advancement.'
                        : 'Some items require recruiter review before advancing this candidate.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-slate-400">
                  No candidate selected for checklist inspection.
                </div>
              )}
            </div>

            {selectedCandidateChecklist && (
              <div className="mt-4 border-t border-slate-100 pt-3 flex flex-wrap gap-2">
                <Link
                  to={selectedCandidateChecklist.targetCandidateUrl}
                  className="flex-1 text-center rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  Candidate Profile
                </Link>
                {selectedCandidateChecklist.targetInterviewUrl && (
                  <Link
                    to={selectedCandidateChecklist.targetInterviewUrl}
                    className="flex-1 text-center rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 transition-colors"
                  >
                    Interview Report
                  </Link>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, iconBg, label, value, subtext, highlight, to }) {
  const CardWrapper = to ? Link : 'div';
  return (
    <CardWrapper
      to={to}
      className={`block transition-all hover:-translate-y-0.5 ${to ? 'cursor-pointer hover:shadow-md' : ''}`}
    >
      <Card className={`p-4 sm:p-5 h-full flex flex-col justify-between ${highlight ? 'ring-2 ring-amber-400/50' : ''}`}>
        <div className="flex items-center justify-between">
          <div className={`rounded-xl p-2.5 sm:p-3 border ${iconBg}`}>
            <Icon className="h-5 w-5" />
          </div>
          {to && <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500" />}
        </div>
        <div className="mt-3">
          <p className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">{value}</p>
          <p className="text-xs sm:text-sm font-semibold text-slate-800 mt-0.5">{label}</p>
          {subtext && <p className="text-xs text-slate-400 mt-0.5 truncate">{subtext}</p>}
        </div>
      </Card>
    </CardWrapper>
  );
}
