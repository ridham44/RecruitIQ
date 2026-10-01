// import { useEffect, useRef, useState } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
// import { Loader2, PartyPopper, Clock3, MailCheck, SearchX, CircleCheck, CircleX } from 'lucide-react';
import { Loader2, PartyPopper, Clock3, MailCheck, SearchX, CircleCheck, CircleX, CalendarDays, Video, Check } from 'lucide-react';
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
        // body: `${matchedLine}Your profile is a strong match for ${where}. We've emailed you the next steps for your interview.`,
        body: app.usesSlots
          ? `${matchedLine}Your profile is a strong match for ${where}. Pick a time below for your AI interview.`
          : `${matchedLine}Your profile is a strong match for ${where}. We've emailed you the next steps for your interview.`,
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
      // return { icon: CircleCheck, tone: 'emerald', title: 'Your interview is set up', body: `${matchedLine}Log in to see the details for ${where}.` };
      return {
        icon: CircleCheck,
        tone: 'emerald',
        title: 'Your interview is booked',
        body: app.hasBookedSlot
          ? `${matchedLine}Your AI interview for ${where} is booked. The time and the join button are below.`
          : `${matchedLine}Your interview for ${where} is set up. We've emailed you the details.`,
      };
    case 'interview_completed':
      // return { icon: CircleCheck, tone: 'emerald', title: 'Your interview is set up', body: `${matchedLine}Log in to see the details for ${where}.` };
      return {
        icon: CircleCheck,
        tone: 'emerald',
        title: 'Interview completed — thank you!',
        body: `${matchedLine}${app.company.name} is reviewing your interview for ${app.job.title} and will contact you about the next steps.`,
      };
    default:
      return {
        icon: Clock3,
        tone: 'brand',
        title: 'Your application is under review',
        body: `${matchedLine}The recruiting team for ${where} will review your profile and contact you.`,
      };
  }
}

// Progress steps shown to the candidate (no scores, no results).
const STEPS = ['Applied', 'CV review', 'Shortlisted', 'Interview', 'Interview completed', 'Under review'];
// Index of the step the candidate is on now.
function currentStep(stage) {
  switch (stage) {
    case 'shortlisted':
      return 2;
    case 'interview_scheduled':
      return 3;
    case 'interview_completed':
      return 5;
    default:
      // received / screening / under_review
      return 1;
  }
}

function ProgressSteps({ stage }) {
  if (stage === 'not_selected') return null;
  const now = currentStep(stage);
  return (
    <Card className="mt-4 p-4 sm:p-6">
      <h2 className="mb-4 text-sm font-semibold text-slate-900">Your progress</h2>
      <ol className="space-y-3">
        {STEPS.map((label, i) => {
          const done = i < now;
          const current = i === now;
          return (
            <li key={label} className="flex items-center gap-3">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  done ? 'bg-emerald-500 text-white' : current ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-400'
                }`}
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span className={`text-sm ${current ? 'font-semibold text-slate-900' : done ? 'text-slate-700' : 'text-slate-400'}`}>
                {label}
                {current && <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">Now</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

const dayLabel = (iso) => new Date(iso).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
const timeLabel = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

// SLOT-booking jobs: pick / change a time and join — all from this link.
function SlotBooking({ token, onChanged }) {
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(() => {
    publicApi
      .getTrackBooking(token)
      .then(setBooking)
      .catch((err) => setError(err.message));
  }, [token]);
  useEffect(load, [load]);

  const act = async (key, fn) => {
    setBusy(key);
    setError('');
    try {
      setBooking(await fn());
      onChanged?.();
    } catch (err) {
      setError(err.message);
      load();
    } finally {
      setBusy('');
    }
  };

  if (!booking) return error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null;
  if (!booking.usesSlots || (!booking.canBook && !booking.booked)) return null;

  if (booking.booked) {
    const b = booking.booked;
    return (
      <Card className="mt-4 p-4 sm:p-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <CalendarDays className="h-4 w-4 text-brand-600" /> Your interview
        </h2>
        <p className="mt-2 text-lg font-semibold text-slate-900">{dayLabel(b.startTime)}</p>
        <p className="text-sm text-slate-600">
          {timeLabel(b.startTime)} – {timeLabel(b.endTime)}
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          {b.joinLink && (
            <a href={b.joinLink} className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto">
                <Video className="h-4 w-4" /> {b.status === 'IN_PROGRESS' ? 'Rejoin interview' : 'Join interview'}
              </Button>
            </a>
          )}
          {booking.canChange && (
            <Button
              variant="secondary"
              className="w-full sm:w-auto"
              loading={busy === 'cancel'}
              onClick={() => act('cancel', () => publicApi.cancelFromTrack(token))}
            >
              Change time
            </Button>
          )}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Join at your booked time from a quiet room, with a working camera and microphone. We've also emailed you this link.
        </p>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </Card>
    );
  }

  const byDay = booking.slots.reduce((acc, sl) => {
    const key = dayLabel(sl.startTime);
    (acc[key] = acc[key] || []).push(sl);
    return acc;
  }, {});
  return (
    <Card className="mt-4 p-4 sm:p-6">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <CalendarDays className="h-4 w-4 text-brand-600" /> Book your interview time
      </h2>
      {booking.slots.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">No times are open right now. Please check this page again later — the recruiter will add more.</p>
      ) : (
        <div className="mt-3 space-y-4">
          {Object.entries(byDay).map(([day, list]) => (
            <div key={day}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{day}</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {list.map((sl) => (
                  <Button
                    key={sl.id}
                    variant="secondary"
                    className="w-full"
                    loading={busy === sl.id}
                    disabled={Boolean(busy)}
                    onClick={() => act(sl.id, () => publicApi.bookFromTrack(token, sl.id))}
                  >
                    {timeLabel(sl.startTime)}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </Card>
  );
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

  // useEffect(() => {
  //   if (!token) {
  //     setError('This link is missing its tracking code.');
  //     return undefined;
  //   }
  //   if (started.current) return undefined;
  //   started.current = true;

  //   let cancelled = false;
  //   let polls = 0;
  //   const poll = async () => {
  //     if (cancelled) return;
  //     try {
  //       const s = await publicApi.getTrackStatus(token);
  //       if (cancelled) return;
  //       setStatus(s);
  //       if (!s.done && ++polls < MAX_POLLS) setTimeout(poll, POLL_MS);
  //       else if (!s.done) setTimedOut(true);
  //     } catch (err) {
  //       if (!cancelled) setError(err.message);
  //     }
  //   };

  //   publicApi
  //     .processTracked(token)
  //     .then((s) => {
  //       if (cancelled) return;
  //       setStatus(s);
  //       if (!s.done) setTimeout(poll, POLL_MS);
  //     })
  //     // Processing may take longer than the request allows — keep polling.
  //     .catch(() => !cancelled && setTimeout(poll, POLL_MS));

  //   return () => {
  //     cancelled = true;
  //   };
  // }, [token]);

  // In React StrictMode (local dev) the effect runs mount → cleanup → mount.
  // The old version cancelled the first run and skipped the second, so the
  // page never left "Reviewing your CV…" locally. `alive` tracks whether the
  // page is mounted *now*, so the single processing run still updates it.
  const alive = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (!token) {
      setError('This link is missing its tracking code.');
      return;
    }
    if (started.current) return;
    started.current = true;

    let polls = 0;
    const poll = async () => {
      if (!alive.current) return;
      try {
        const s = await publicApi.getTrackStatus(token);
        if (!alive.current) return;
        setStatus(s);
        if (!s.done && ++polls < MAX_POLLS) setTimeout(poll, POLL_MS);
        else if (!s.done) setTimedOut(true);
      } catch (err) {
        if (alive.current) setError(err.message);
      }
    };

    publicApi
      .processTracked(token)
      .then((s) => {
        if (!alive.current) return;
        setStatus(s);
        if (!s.done) setTimeout(poll, POLL_MS);
      })
      // Processing may take longer than the request allows — keep polling.
      .catch(() => alive.current && setTimeout(poll, POLL_MS));
  }, [token]);

  const result = status?.done ? outcome(status) : null;
  // The application this link tracks (CV-only submissions: the matched one).
  const app = status ? (status.kind === 'application' ? status : status.match) : null;
  const refresh = useCallback(() => {
    publicApi
      .getTrackStatus(token)
      .then(setStatus)
      .catch(() => {});
  }, [token]);
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

      {/* Progress timeline + slot booking (no login needed) */}
      {result && app && <ProgressSteps stage={app.stage} />}
      {result && app?.usesSlots && (app.stage === 'shortlisted' || app.stage === 'interview_scheduled') && (
        <SlotBooking token={token} onChanged={refresh} />
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
