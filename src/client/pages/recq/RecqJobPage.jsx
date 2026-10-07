import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapPin, Briefcase, Clock, ArrowLeft, GraduationCap } from 'lucide-react';
import RecqShell from './RecqShell.jsx';
import Button from '../../components/ui/Button.jsx';
import LoadingState from '../../components/ui/LoadingState.jsx';
import ErrorState from '../../components/ui/ErrorState.jsx';
import ResumeDropzone from './ResumeDropzone.jsx';
import MatchScore from './MatchScore.jsx';
import OtpForm from './OtpForm.jsx';
import InterviewAccessCard from './InterviewAccessCard.jsx';
import StepTrail from './StepTrail.jsx';
import { employmentLabel, experienceLabel } from './JobCard.jsx';
import { recqApi } from '../../services/recq.js';

// Build plan P9 (§3, §11, §43) — /recq/:agencySlug/:jobSlug. One OPEN job;
// upload resume → match → (pass) → email OTP → interview access.
export default function RecqJobPage() {
  const { slug: agencySlug, jobSlug } = useParams();
  const [state, setState] = useState({ loading: true, error: null, agency: null, job: null });
  const [step, setStep] = useState('intro'); // intro | upload | result | otp | done
  const [matching, setMatching] = useState(false);
  const [flowError, setFlowError] = useState('');
  const [upload, setUpload] = useState(null); // { uploadId, resumeEmail, hasResumeEmail, match }
  const [recqToken, setRecqToken] = useState('');
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState(null); // apply response

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    recqApi
      .getAgencyJob(agencySlug, jobSlug)
      .then((d) => alive && setState({ loading: false, error: null, agency: d.agency, job: d.job }))
      .catch((err) => alive && setState({ loading: false, error: err, agency: null, job: null }));
    return () => {
      alive = false;
    };
  }, [agencySlug, jobSlug]);

  async function onUpload(file) {
    setMatching(true);
    setFlowError('');
    try {
      const res = await recqApi.matchForJob(agencySlug, jobSlug, file);
      setUpload(res);
      setStep('result');
    } catch (err) {
      setFlowError(err.message || "We couldn't read your resume. Please try again.");
    } finally {
      setMatching(false);
    }
  }

  async function onVerified(token) {
    setRecqToken(token);
    setApplying(true);
    setFlowError('');
    try {
      const res = await recqApi.apply(agencySlug, { uploadId: upload.uploadId, jobSlugs: [jobSlug], recqToken: token });
      setResult(res);
      setStep('done');
    } catch (err) {
      setFlowError(err.message || 'Something went wrong. Please try again.');
      setApplying(false);
    }
  }

  const { loading, error, agency, job } = state;
  if (loading) {
    return (
      <RecqShell agencySlug={agencySlug} narrow>
        <LoadingState label="Loading job…" />
      </RecqShell>
    );
  }
  if (error || !job) {
    return (
      <RecqShell agency={agency} agencySlug={agencySlug} narrow>
        <ErrorState message={error?.message || 'This job is no longer accepting applications.'} />
        <div className="mt-4 text-center">
          <Link to={`/recq/${agencySlug}`} className="text-sm font-medium text-brand-600 hover:underline">
            See other open roles
          </Link>
        </div>
      </RecqShell>
    );
  }

  const stepIndex = { intro: 0, upload: 0, result: 1, otp: 2, done: 3 }[step];

  return (
    <RecqShell agency={agency} agencySlug={agencySlug} narrow>
      <Link to={`/recq/${agencySlug}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> All roles
      </Link>

      {step !== 'intro' && <StepTrail steps={['Resume', 'Match', 'Verify', 'Interview']} current={stepIndex} className="mt-4" />}

      {/* ---- Intro: job detail ---- */}
      {step === 'intro' && (
        <div className="mt-4">
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{job.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{agency?.name}</p>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-slate-600">
            {job.location && (
              <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4 text-slate-400" />{job.location}</span>
            )}
            {(job.employmentType || job.workMode) && (
              <span className="inline-flex items-center gap-1.5">
                <Briefcase className="h-4 w-4 text-slate-400" />
                {[employmentLabel(job.employmentType), job.workMode].filter(Boolean).join(' · ')}
              </span>
            )}
            {experienceLabel(job.minimumExperience, job.maximumExperience) && (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-slate-400" />
                {experienceLabel(job.minimumExperience, job.maximumExperience)}
              </span>
            )}
          </div>

          {job.requiredSkills?.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {job.requiredSkills.map((s) => (
                <span key={s} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{s}</span>
              ))}
            </div>
          )}

          {job.educationRequirements?.length > 0 && (
            <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-slate-500">
              <GraduationCap className="h-4 w-4 text-slate-400" />
              {job.educationRequirements.join(', ')}
            </p>
          )}

          {job.description && (
            <div className="mt-5 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{job.description}</div>
          )}

          <div className="sticky bottom-0 -mx-4 mt-6 border-t border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
            <Button onClick={() => setStep('upload')} className="w-full sm:w-auto">Apply for this role</Button>
          </div>
        </div>
      )}

      {/* ---- Upload ---- */}
      {step === 'upload' && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold text-slate-900">Apply for {job.title}</h2>
          <p className="mt-1 text-sm text-slate-500">Upload your resume — we&apos;ll check how well it matches this role.</p>
          <div className="mt-5">
            <ResumeDropzone onSubmit={onUpload} loading={matching} ctaLabel="Check my match" />
          </div>
          {flowError && <p className="mt-3 text-sm text-red-600">{flowError}</p>}
        </div>
      )}

      {/* ---- Match result ---- */}
      {step === 'result' && upload && (
        <div className="mt-6">
          <MatchScore match={upload.match} jobTitle={job.title} />
          <div className="mt-6">
            {upload.match.pass ? (
              upload.hasResumeEmail ? (
                <Button onClick={() => setStep('otp')} className="w-full">Continue</Button>
              ) : (
                <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-center text-sm text-amber-700">
                  We couldn&apos;t find an email on your resume, so we can&apos;t verify you. Please upload a resume that lists your email.
                </p>
              )
            ) : null}
            <button
              type="button"
              onClick={() => {
                setUpload(null);
                setFlowError('');
                setStep('upload');
              }}
              className="mt-3 w-full text-sm font-medium text-slate-500 hover:text-slate-700"
            >
              {upload.match.pass ? 'Use a different resume' : 'Try another resume'}
            </button>
            {!upload.match.pass && (
              <Link
                to={`/recq/${agencySlug}`}
                className="mt-3 flex min-h-[44px] w-full items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Browse other open roles
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ---- OTP ---- */}
      {step === 'otp' && upload && (
        <div className="mt-8">
          {applying ? (
            <LoadingState label="Setting up your interview…" />
          ) : (
            <OtpForm
              agencySlug={agencySlug}
              uploadId={upload.uploadId}
              jobSlug={jobSlug}
              emailMasked={upload.resumeEmail}
              onVerified={onVerified}
            />
          )}
          {flowError && <p className="mt-3 text-center text-sm text-red-600">{flowError}</p>}
        </div>
      )}

      {/* ---- Done ---- */}
      {step === 'done' && result && (
        <div className="mt-6">
          <h2 className="text-center text-lg font-semibold text-slate-900">You&apos;re all set ✓</h2>
          <p className="mt-1 text-center text-sm text-slate-500">Your interview is ready. We&apos;ve also emailed you the link.</p>
          <div className="mt-5 space-y-3">
            {result.applications.map((a) => (
              <InterviewAccessCard key={a.jobSlug} app={a} agencyName={agency?.name} />
            ))}
          </div>
        </div>
      )}
    </RecqShell>
  );
}
