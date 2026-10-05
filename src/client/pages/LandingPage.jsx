import { Link } from 'react-router-dom';
import {
  PlayCircle,
  Link2,
  ScanSearch,
  MailCheck,
  Mic,
  FileBarChart2,
  Building2,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';

// Build plan P9: the agency-link flow — a candidate gets a private agency or
// job link, passes the resume match, verifies the email on their resume and
// takes an AI voice interview; the agency reviews reports and decides.
const STEPS = [
  { icon: Link2, title: 'Share your link', text: 'Send candidates your agency link or a link to one job.' },
  { icon: ScanSearch, title: 'Resume match', text: 'AI scores the resume against each role in seconds.' },
  { icon: MailCheck, title: 'Email verified', text: 'A one-time code goes to the email on the resume.' },
  { icon: Mic, title: 'AI voice interview', text: 'Eligible candidates interview right away, in your window.' },
  { icon: FileBarChart2, title: 'Review & decide', text: 'Reports, transcripts and final scores — you choose.' },
];

const FEATURES = [
  {
    icon: ShieldCheck,
    title: 'Private, agency-only links',
    description: 'No public job board. Candidates see only the open roles of the agency that invited them — enforced on the server.',
  },
  {
    icon: ScanSearch,
    title: 'AI resume matching',
    description: 'Skills, experience and education checked against each job. Candidates who don’t meet your minimum stop right there.',
  },
  {
    icon: MailCheck,
    title: 'Verified applicants',
    description: 'The verification code is sent only to the email on the resume, so nobody can apply in someone else’s name.',
  },
  {
    icon: Mic,
    title: 'AI voice interviews',
    description: 'Your interviewer persona, custom questions, answer time and evaluation criteria — with adaptive follow-ups.',
  },
  {
    icon: FileBarChart2,
    title: 'Reports and final scores',
    description: 'Scores, strengths, criteria met / not met, the full transcript and a final score combining CV and interview.',
  },
  {
    icon: Building2,
    title: 'Client HR hand-off',
    description: 'Send selected candidates to your client’s HR, who see only what you shared — CV, scores and summary.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-5 sm:px-6">
        <div className="flex shrink-0 items-center gap-2">
          <img src="/Logo.png" alt="RecruitIQ" className="h-10 w-10 shrink-0 object-contain" />
          <span className="hidden text-lg font-semibold sm:inline">RecruitIQ</span>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          {/* Live demo: every role, demo login and public link (/live-demo) */}
          <Link
            to="/live-demo"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-brand-600 hover:bg-brand-50 hover:text-brand-700 sm:px-3"
          >
            <PlayCircle className="h-4 w-4" />
            Live Demo
          </Link>
          <Link to="/auth/login" className="inline-flex min-h-[44px] items-center px-2 text-sm font-medium text-slate-600 hover:text-slate-900">
            Log in
          </Link>
          <Link
            to="/auth/register"
            className="hidden min-h-[44px] items-center rounded-lg bg-brand-600 px-3 text-sm font-medium text-white hover:bg-brand-700 min-[360px]:inline-flex sm:px-4"
          >
            Get started
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-4 pb-14 pt-12 text-center sm:px-6 sm:pb-16 sm:pt-20">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
          <Mic className="h-3.5 w-3.5" /> AI interviews from a single agency link
        </span>
        <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Hire faster with AI resume matching and voice interviews
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">
          Share one private link. Candidates upload a resume, see their match, verify their email and take an AI interview — no
          screening backlog, no scheduling. You review the reports and decide.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            to="/auth/register?role=company"
            className="inline-flex min-h-[48px] items-center justify-center rounded-lg bg-brand-600 px-6 text-sm font-semibold text-white hover:bg-brand-700"
          >
            I'm hiring
          </Link>
          <Link
            to="/live-demo"
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg border border-slate-300 px-6 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <PlayCircle className="h-4 w-4" /> See the live demo
          </Link>
        </div>
        <p className="mx-auto mt-5 max-w-xl text-sm text-slate-500">
          Looking for a job? Use the link your recruitment agency sent you — RecruitIQ has no public job board.
        </p>
      </section>

      {/* How it works */}
      <section className="border-y border-slate-100 bg-slate-50/70">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
          <h2 className="text-center text-xl font-semibold text-slate-900 sm:text-2xl">How it works</h2>
          <ol className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="relative flex gap-3 rounded-xl border border-slate-200 bg-white p-4 lg:flex-col lg:gap-2">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Step {i + 1}</p>
                  <p className="font-semibold text-slate-900">{title}</p>
                  <p className="mt-1 text-sm text-slate-600">{text}</p>
                </div>
                {i < STEPS.length - 1 && (
                  <ArrowRight className="absolute -right-3.5 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-slate-300 lg:block" aria-hidden="true" />
                )}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, description }) => (
          <div key={title} className="rounded-xl border border-slate-200 p-5 sm:p-6">
            <Icon className="h-6 w-6 text-brand-600" />
            <h3 className="mt-3 font-semibold text-slate-900">{title}</h3>
            <p className="mt-2 text-sm text-slate-600">{description}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-slate-100 py-8 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} RecruitIQ · AI recruitment for agencies
      </footer>
    </div>
  );
}
