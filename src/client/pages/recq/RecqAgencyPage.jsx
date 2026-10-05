import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Search, Sparkles, ArrowLeft, Briefcase } from 'lucide-react';
import RecqShell from './RecqShell.jsx';
import Button from '../../components/ui/Button.jsx';
import LoadingState from '../../components/ui/LoadingState.jsx';
import ErrorState from '../../components/ui/ErrorState.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import { inputClass } from '../../components/ui/FormField.jsx';
import JobCard, { employmentLabel } from './JobCard.jsx';
import ResumeDropzone from './ResumeDropzone.jsx';
import OtpForm from './OtpForm.jsx';
import InterviewAccessCard from './InterviewAccessCard.jsx';
import StepTrail from './StepTrail.jsx';
import { recqApi } from '../../services/recq.js';

// Build plan P9 (§2, §8–§10, §43) — /recq/:agencySlug. The agency's OPEN jobs
// (Option A: pick a job → its page) and resume discovery across the agency
// (Option B: upload → matching jobs → select → OTP → interview access).
export default function RecqAgencyPage() {
  const { slug: agencySlug } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, error: null, agency: null, jobs: [] });
  const [query, setQuery] = useState('');

  // Option B flow
  const [flow, setFlow] = useState(null); // null | 'result' | 'otp' | 'done'
  const [matching, setMatching] = useState(false);
  const [flowError, setFlowError] = useState('');
  const [discovery, setDiscovery] = useState(null); // { uploadId, resumeEmail, hasResumeEmail, jobs, anyEligible }
  const [selected, setSelected] = useState([]); // jobSlugs
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    recqApi
      .getAgency(agencySlug)
      .then((d) => alive && setState({ loading: false, error: null, agency: d.agency, jobs: d.jobs }))
      .catch((err) => alive && setState({ loading: false, error: err, agency: null, jobs: [] }));
    return () => {
      alive = false;
    };
  }, [agencySlug]);

  const { loading, error, agency, jobs } = state;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter(
      (j) =>
        j.title?.toLowerCase().includes(q) ||
        j.location?.toLowerCase().includes(q) ||
        (j.requiredSkills || []).some((s) => s.toLowerCase().includes(q)),
    );
  }, [jobs, query]);

  async function onDiscover(file) {
    setMatching(true);
    setFlowError('');
    try {
      const res = await recqApi.discover(agencySlug, file);
      setDiscovery(res);
      setSelected(res.jobs.filter((j) => j.pass).map((j) => j.slug));
      setFlow('result');
    } catch (err) {
      setFlowError(err.message || "We couldn't read your resume. Please try again.");
    } finally {
      setMatching(false);
    }
  }

  function toggle(slug) {
    setSelected((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
  }

  async function onVerified(token) {
    setApplying(true);
    setFlowError('');
    try {
      const res = await recqApi.apply(agencySlug, { uploadId: discovery.uploadId, jobSlugs: selected, recqToken: token });
      setResult(res);
      setFlow('done');
    } catch (err) {
      setFlowError(err.message || 'Something went wrong. Please try again.');
      setApplying(false);
    }
  }

  function resetFlow() {
    setFlow(null);
    setDiscovery(null);
    setSelected([]);
    setResult(null);
    setFlowError('');
  }

  if (loading) {
    return (
      <RecqShell agencySlug={agencySlug}>
        <LoadingState label="Loading open roles…" />
      </RecqShell>
    );
  }
  if (error || !agency) {
    return (
      <RecqShell agencySlug={agencySlug} narrow>
        <ErrorState message={error?.message || 'This recruitment page does not exist.'} />
      </RecqShell>
    );
  }

  // ---------- Option B flow (takes over the page) ----------
  if (flow) {
    const stepIndex = { result: 1, otp: 2, done: 3 }[flow];
    return (
      <RecqShell agency={agency} agencySlug={agencySlug} narrow>
        {flow !== 'done' && (
          <button onClick={resetFlow} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
            <ArrowLeft className="h-4 w-4" /> All roles
          </button>
        )}
        <StepTrail steps={['Resume', 'Matches', 'Verify', 'Interview']} current={stepIndex} className="mt-4" />

        {flow === 'result' && discovery && (
          <div className="mt-6">
            {discovery.anyEligible ? (
              <>
                <h2 className="text-lg font-semibold text-slate-900">Your resume matches</h2>
                <p className="mt-1 text-sm text-slate-500">Select the roles you&apos;d like to apply to.</p>
                <ul className="mt-4 space-y-2.5">
                  {discovery.jobs.map((j) => {
                    const disabled = !j.pass;
                    const checked = selected.includes(j.slug);
                    return (
                      <li key={j.slug}>
                        <label
                          className={`flex items-center gap-3 rounded-xl border p-3.5 ${
                            disabled ? 'border-slate-200 bg-slate-50' : checked ? 'border-brand-400 bg-brand-50/60' : 'border-slate-200 bg-white'
                          } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <input
                            type="checkbox"
                            disabled={disabled}
                            checked={checked}
                            onChange={() => toggle(j.slug)}
                            className="h-5 w-5 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500 disabled:opacity-40"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-slate-900">{j.title}</span>
                            <span className="block truncate text-xs text-slate-500">
                              {[j.location, employmentLabel(j.employmentType)].filter(Boolean).join(' · ')}
                            </span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span className={`block text-sm font-semibold ${j.pass ? 'text-slate-900' : 'text-slate-400'}`}>{j.score}%</span>
                            {!j.pass && <span className="block text-[11px] text-slate-400">Not eligible</span>}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                <Button onClick={() => setFlow('otp')} disabled={selected.length === 0} className="mt-5 w-full">
                  Apply to {selected.length || ''} selected {selected.length === 1 ? 'job' : 'jobs'}
                </Button>
              </>
            ) : (
              <EmptyState
                icon={Briefcase}
                title="No suitable role right now"
                description={`Sorry, we couldn't find an open position that matches your resume at ${agency.name}. Try again later when new positions are available.`}
                action={
                  <button onClick={resetFlow} className="text-sm font-medium text-brand-600 hover:underline">
                    Back to all roles
                  </button>
                }
              />
            )}
            {flowError && <p className="mt-3 text-sm text-red-600">{flowError}</p>}
          </div>
        )}

        {flow === 'otp' && discovery && (
          <div className="mt-8">
            {applying ? (
              <LoadingState label="Setting up your interviews…" />
            ) : (
              <OtpForm agencySlug={agencySlug} uploadId={discovery.uploadId} emailMasked={discovery.resumeEmail} onVerified={onVerified} />
            )}
            {flowError && <p className="mt-3 text-center text-sm text-red-600">{flowError}</p>}
          </div>
        )}

        {flow === 'done' && result && (
          <div className="mt-6">
            <h2 className="text-center text-lg font-semibold text-slate-900">You&apos;re all set ✓</h2>
            <p className="mt-1 text-center text-sm text-slate-500">
              {result.applications.filter((a) => a.eligible).length > 1
                ? 'Your interviews are ready. Each role has its own link — we&apos;ve emailed them too.'
                : 'Your interview is ready. We&apos;ve also emailed you the link.'}
            </p>
            <div className="mt-5 space-y-3">
              {result.applications.map((a) => (
                <InterviewAccessCard key={a.jobSlug} app={a} agencyName={agency.name} />
              ))}
            </div>
          </div>
        )}
      </RecqShell>
    );
  }

  // ---------- Default: browse jobs + discovery CTA ----------
  return (
    <RecqShell agency={agency} agencySlug={agencySlug}>
      <div className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 px-5 py-6 text-white sm:px-7 sm:py-8">
        <h1 className="text-xl font-bold sm:text-2xl">Open roles at {agency.name}</h1>
        <p className="mt-1.5 max-w-lg text-sm text-brand-50/90">
          Find a role, check your resume match in seconds, verify your email, and take your interview — all from here.
        </p>
      </div>

      {/* Option B — discovery */}
      <div className="mt-5 rounded-xl border border-brand-200 bg-brand-50/50 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-brand-600">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-900">Not sure which role fits?</p>
            <p className="text-sm text-slate-500">Upload your resume and we&apos;ll find matching opportunities.</p>
          </div>
        </div>
        <div className="mt-4">
          <ResumeDropzone onSubmit={onDiscover} loading={matching} ctaLabel="Find matching jobs" />
          {flowError && <p className="mt-2 text-sm text-red-600">{flowError}</p>}
        </div>
      </div>

      {/* Option A — browse */}
      <div className="mt-7">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">
            {jobs.length} open {jobs.length === 1 ? 'role' : 'roles'}
          </h2>
        </div>
        {jobs.length > 3 && (
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title, skill or location"
              className={`${inputClass} pl-9`}
            />
          </div>
        )}

        <div className="mt-4">
          {jobs.length === 0 ? (
            <EmptyState icon={Briefcase} title="No open roles right now" description={`${agency.name} isn't hiring at the moment. Please check back later.`} />
          ) : filtered.length === 0 ? (
            <EmptyState icon={Search} title="No roles match your search" description="Try a different title, skill or location." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filtered.map((job) => (
                <JobCard key={job.slug} job={job} onApply={() => navigate(`/recq/${agencySlug}/${job.slug}`)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </RecqShell>
  );
}
