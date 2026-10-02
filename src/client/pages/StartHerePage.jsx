import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Check, LogIn, ExternalLink, ArrowRight, ShieldCheck, Building2, Users, Briefcase, UserRound, GraduationCap } from 'lucide-react';
import { configApi } from '../services/config.js';
import LoadingState from '../components/ui/LoadingState.jsx';
import ErrorState from '../components/ui/ErrorState.jsx';

// "Start here" demo page (/live-demo; /start redirects): every role, its demo login and the public
// links in one place. Credentials appear only while DEMO_PAGE is on.

const ICONS = { admin: ShieldCheck, agency: Building2, recruiter: Users, hr: Briefcase, candidate: GraduationCap };

function CopyButton({ value, label }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      setDone(false);
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy ${label}`}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
    >
      {done ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}

function Credential({ label, value }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-1.5">
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
        <p className="truncate font-mono text-sm text-slate-800">{value}</p>
      </div>
      <CopyButton value={value} label={label} />
    </div>
  );
}

function LinkRow({ to, title, description, external }) {
  const inner = (
    <>
      <div className="min-w-0">
        <p className="font-medium text-slate-900">{title}</p>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
      {external ? <ExternalLink className="h-4 w-4 shrink-0 text-slate-400" /> : <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />}
    </>
  );
  const cls = 'flex min-h-[56px] items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 hover:border-brand-300 hover:bg-brand-50/40';
  return (
    <Link to={to} className={cls}>
      {inner}
    </Link>
  );
}

export default function StartHerePage() {
  const [demo, setDemo] = useState(null);
  const [error, setError] = useState('');

  const load = () => {
    setError('');
    configApi
      .getDemo()
      .then(setDemo)
      .catch((err) => setError(err.message));
  };
  useEffect(load, []);

  if (error) return <div className="mx-auto max-w-3xl px-4 py-10"><ErrorState message={error} onRetry={load} /></div>;
  if (!demo) return <LoadingState />;

  const slug = demo.agencySlug;
  const steps = [
    ['Portal Admin', `sees "${demo.agencyName}" under Agencies (and can add a new agency).`],
    ['Agency owner', `opens Companies → "${demo.companyName}" → Company HR, then Jobs → "${demo.jobTitle}".`],
    ['Candidate', 'applies on the careers page (or logs in and applies from Find Jobs).'],
    ['Agency owner', 'opens the job → Applications: AI match score → Shortlist.'],
    ['Agency owner', 'sends an instant AI interview link (candidate page) — the candidate takes the voice interview.'],
    ['Agency owner', 'reads the interview report and final score → Submit to company.'],
    ['Company HR', 'logs in → Candidates → opens the candidate and the CV.'],
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <img src="/Logo.png" alt="RecruitIQ" className="h-9 w-9 object-contain" />
            <span className="text-lg font-semibold text-slate-900">RecruitIQ</span>
          </Link>
          <Link
            to="/auth/login"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
          >
            <LogIn className="h-4 w-4" /> Log in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Demo — start here</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Every RecruitIQ role and link in one place. Open each role in a separate browser window (or an incognito window) so the logins
          don't replace each other.
        </p>

        {/* How it fits together */}
        <div className="mt-6 flex flex-wrap items-center gap-2 text-sm">
          {['Portal Admin', 'Agency', 'Company', 'Company HR'].map((r, i) => (
            <span key={r} className="flex items-center gap-2">
              {i > 0 && <ArrowRight className="h-4 w-4 text-slate-400" />}
              <span className="rounded-full bg-brand-50 px-3 py-1 font-medium text-brand-700">{r}</span>
            </span>
          ))}
          <span className="text-slate-500">· Candidates apply to the agency's jobs</span>
        </div>

        {demo.enabled ? (
          <div className="mt-6 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-amber-900">
              <strong>Demo accounts only.</strong> All of them use the same password. Please don't put real data into them.
            </p>
            <div className="sm:w-64">
              <Credential label="Password" value={demo.password} />
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            Demo logins are switched off right now. Ask the RecruitIQ team for access.
          </div>
        )}

        {/* Logins */}
        <h2 className="mt-8 text-lg font-semibold text-slate-900">Logins</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {demo.accounts.map((a) => {
            const Icon = ICONS[a.key] || UserRound;
            const portalOff = a.key === 'hr' && !demo.features.clientPortal;
            return (
              <div key={a.key} className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="font-semibold text-slate-900">{a.label}</h3>
                </div>
                <ul className="mt-3 flex-1 list-disc space-y-1 pl-5 text-sm text-slate-600">
                  {a.canDo.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
                {a.email && (
                  <div className="mt-4">
                    <Credential label="Email" value={a.email} />
                  </div>
                )}
                {portalOff && <p className="mt-3 text-xs text-amber-700">The Company HR portal is switched off — HR get candidates by email link instead.</p>}
                <Link
                  to={a.email ? `/auth/login?email=${encodeURIComponent(a.email)}` : '/auth/login'}
                  className="mt-4 inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <LogIn className="h-4 w-4" /> Log in as {a.label}
                </Link>
              </div>
            );
          })}
        </div>

        {/* No-login links */}
        <h2 className="mt-10 text-lg font-semibold text-slate-900">Without login</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <LinkRow to={`/careers/${slug}`} title="Careers page" description={`${demo.agencyName}'s public jobs — apply as a guest`} />
          <LinkRow to={`/careers/${slug}/submit-cv`} title="Submit a CV only" description="RecruitIQ places it on the best-matching job" />
          <LinkRow to="/careers/track" title="Track an application" description="With the phone number used to apply" />
          <LinkRow to="/auth/register" title="Create a new account" description="Register as a candidate or a new agency" />
        </div>
        <p className="mt-3 text-sm text-slate-500">
          The <strong>interview link</strong> and the <strong>candidate package link</strong> for Company HR arrive by email. Demo accounts use
          the {`@${'recruitiq.demo'}`} domain, which has no real inbox — in a demo, copy the interview link from the candidate's page on the
          agency side instead.
        </p>
        {!demo.features.guestApply && (
          <p className="mt-2 text-sm text-amber-700">Guest apply is switched off right now, so the careers page only lists jobs.</p>
        )}

        {/* Suggested flow */}
        <h2 className="mt-10 text-lg font-semibold text-slate-900">Suggested demo flow</h2>
        <ol className="mt-3 space-y-2">
          {steps.map(([who, what], i) => (
            <li key={i} className="flex gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">{i + 1}</span>
              <span className="text-slate-700">
                <strong className="text-slate-900">{who}</strong> {what}
              </span>
            </li>
          ))}
        </ol>
      </main>
    </div>
  );
}
