import { CheckCircle2, CalendarClock, ArrowRight, Clock3 } from 'lucide-react';

function fmt(d) {
  if (!d) return null;
  return new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// Build plan P9 (§18) — interview access for one application. `app` is one
// item from the apply response: { jobTitle, eligible, alreadyApplied,
// matchScore, interview: { link, status } | null, window: { start, end } }.
export default function InterviewAccessCard({ app, agencyName }) {
  const { jobTitle, eligible, alreadyApplied, interview, window: win } = app;
  const notOpenYet = win?.start && new Date(win.start) > new Date();
  const expired = win?.end && new Date(win.end) < new Date();

  if (!eligible && !interview) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <p className="font-semibold text-slate-900">{jobTitle}</p>
        <p className="mt-1 text-sm text-slate-500">
          This role didn&apos;t meet the match requirement, so an interview isn&apos;t available for it.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-slate-900">{jobTitle}</p>
          {agencyName && <p className="text-sm text-slate-500">{agencyName}</p>}
          {alreadyApplied && (
            <p className="mt-1 text-xs font-medium text-amber-600">You had already applied for this position.</p>
          )}
        </div>
      </div>

      {(win?.start || win?.end) && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <span>
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-400">Interview window</span>
            {fmt(win.start) || 'Now'} &nbsp;—&nbsp; {fmt(win.end) || 'open'}
          </span>
        </div>
      )}

      <div className="mt-4">
        {expired ? (
          <p className="rounded-lg bg-slate-100 px-3 py-2.5 text-sm text-slate-500">
            Your interview window has expired. Please contact {agencyName || 'the recruitment agency'} if you need assistance.
          </p>
        ) : notOpenYet ? (
          <p className="inline-flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-700">
            <Clock3 className="h-4 w-4" />
            Your interview isn&apos;t available yet — we&apos;ll email you when it opens.
          </p>
        ) : interview?.link ? (
          <a
            href={interview.link}
            className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 sm:w-auto"
          >
            Start Interview
            <ArrowRight className="h-4 w-4" />
          </a>
        ) : (
          <p className="text-sm text-slate-500">Your interview link is being prepared — check your email shortly.</p>
        )}
      </div>
    </div>
  );
}
