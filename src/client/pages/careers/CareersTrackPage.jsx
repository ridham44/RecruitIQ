import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2, PartyPopper, Clock3, MailCheck, SearchX, CircleCheck, CircleX } from 'lucide-react';
import { publicApi } from '../../services/public.js';
import CareersShell from './CareersShell.jsx';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import ErrorState from '../../components/ui/ErrorState.jsx';

const POLL_MS = 3000;
const MAX_POLLS = 40; // ~2 minutes

// What to tell the candidate for each stage. No scores are ever shown.
function outcome(status) {
  const app = status.kind === 'application' ? status : status.match;

  if (status.kind === 'submission' && status.status === 'NO_MATCH') {
    return {
      icon: SearchX,
      tone: 'slate',
      title: "No matching role right now",
      body: "We couldn't find an open role that fits your CV today. We've kept your CV, and recruiters can still reach out to you.",
    };
  }
  if (status.kind === 'submission' && status.status === 'FAILED') {
    return { icon: Clock3, tone: 'slate', title: 'We received your CV', body: 'A recruiter will review it and get back to you.' };
  }
  if (!app) return null;

  const where = `${app.job.title} at ${app.company.name}`;
  const matchedLine = status.kind === 'submission' ? `We matched your CV to ${where}. ` : '';
  switch (app.stage) {
    case 'shortlisted':
      return {
        icon: PartyPopper,
        tone: 'emerald',
        title: "You've been shortlisted!",
        body: `${matchedLine}Your profile is a strong match for ${where}. We've emailed you the next steps for your interview.`,
      };
    case 'not_selected':
      return {
        icon: CircleX,
        tone: 'slate',
        title: 'Thank you for applying',
        body: `${matchedLine}After reviewing your CV, ${app.company.name} won't be moving forward for ${app.job.title} at this time. We've sent you an email.`,
      };
    case 'interview_scheduled':
      // Build plan P5: instant-link interviews can start right here.
      if (app.interview?.link) {
        return {
          icon: PartyPopper,
          tone: 'emerald',
          title: "You've been shortlisted!",
          body: `${matchedLine}Your AI interview for ${where} is ready — start now, or later from the link in your email.`,
        };
      }
      return { icon: CircleCheck, tone: 'emerald', title: 'Your interview is set up', body: `${matchedLine}Log in to see the details for ${where}.` };
    case 'interview_completed':
      return { icon: CircleCheck, tone: 'emerald', title: 'Your interview is set up', body: `${matchedLine}Log in to see the details for ${where}.` };
    default:
      return {
        icon: Clock3,
        tone: 'brand',
        title: 'Your application is under review',
        body: `${matchedLine}The recruiting team for ${where} will review your profile and contact you.`,
      };
  }
}

const TONES = {
  emerald: 'bg-emerald-50 text-emerald-600',
  brand: 'bg-brand-50 text-brand-600',
  slate: 'bg-slate-100 text-slate-500',
};

// Build plan P4 — /careers/track?token=…: runs screening / best-job matching
// (inside a request), then polls until there is a result.
export default function CareersTrackPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const slug = params.get('slug') || '';
  const account = params.get('account') || '';
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [timedOut, setTimedOut] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!token) {
      setError('This link is missing its tracking code.');
      return undefined;
    }
    if (started.current) return undefined;
    started.current = true;

    let cancelled = false;
    let polls = 0;
    const poll = async () => {
      if (cancelled) return;
      try {
        const s = await publicApi.getTrackStatus(token);
        if (cancelled) return;
        setStatus(s);
        if (!s.done && ++polls < MAX_POLLS) setTimeout(poll, POLL_MS);
        else if (!s.done) setTimedOut(true);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    };

    publicApi
      .processTracked(token)
      .then((s) => {
        if (cancelled) return;
        setStatus(s);
        if (!s.done) setTimeout(poll, POLL_MS);
      })
      // Processing may take longer than the request allows — keep polling.
      .catch(() => !cancelled && setTimeout(poll, POLL_MS));

    return () => {
      cancelled = true;
    };
  }, [token]);

  const result = status?.done ? outcome(status) : null;
  // Build plan P5
  const interviewLink = (status?.kind === 'application' ? status.interview : status?.match?.interview)?.link;
  const companyName = status?.portalCompany?.name || status?.company?.name || status?.match?.company?.name;

  return (
    <CareersShell company={companyName ? { name: companyName } : null} slug={slug || undefined} narrow>
      {error && <ErrorState message={error} />}

      {!error && !result && (
        <Card className="flex flex-col items-center gap-3 p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
          <p className="font-medium text-slate-900">{status?.kind === 'submission' ? 'Finding your best match…' : 'Reviewing your CV…'}</p>
          <p className="max-w-sm text-sm text-slate-500">
            {timedOut
              ? "This is taking longer than usual. You can close this page — we'll email you, and this link keeps working."
              : 'Our AI is comparing your CV with the role. This usually takes less than a minute.'}
          </p>
        </Card>
      )}

      {result && (
        <Card className="p-6 text-center sm:p-8">
          <span className={`mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full ${TONES[result.tone]}`}>
            <result.icon className="h-7 w-7" />
          </span>
          <h1 className="text-xl font-semibold text-slate-900">{result.title}</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">{result.body}</p>
          {/* Build plan P5: instant interview link, right away */}
          {interviewLink && (
            <div className="mt-5 flex flex-col items-center gap-2">
              <a href={interviewLink} className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto">Start your interview</Button>
              </a>
              <p className="text-xs text-slate-500">Not ready? The link is in your email — open it any time before it expires.</p>
            </div>
          )}
        </Card>
      )}

      {!error && (
        <Card className="mt-4 flex items-start gap-3 p-4 text-sm text-slate-600">
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
          <div>
            {account === 'existing' ? (
              <p>
                You already have a RecruitIQ account with this email.{' '}
                <Link to="/auth/login" className="font-medium text-brand-600 hover:underline">
                  Log in
                </Link>{' '}
                to track your applications.
              </p>
            ) : (
              <p>We've emailed you a link to set a password, so you can track this application and attend interviews from your account.</p>
            )}
          </div>
        </Card>
      )}

      {slug && (
        <div className="mt-6 text-center">
          <Link to={`/careers/${slug}`}>
            <Button variant="secondary" className="w-full sm:w-auto">
              See other open jobs
            </Button>
          </Link>
        </div>
      )}
    </CareersShell>
  );
}
