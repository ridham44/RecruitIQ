import { Link } from 'react-router-dom';
import { Sparkles, ScanSearch, Target, ListChecks } from 'lucide-react';

const FEATURES = [
  {
    icon: ScanSearch,
    title: 'AI Resume Parsing',
    description: 'Upload a PDF or DOCX resume and let AI extract skills, experience, and education automatically.',
  },
  {
    icon: Target,
    title: 'Smart Candidate Matching',
    description: 'Combine deterministic rule checks with AI reasoning to score every applicant against your job requirements.',
  },
  {
    icon: ListChecks,
    title: 'Ranked Shortlists',
    description: 'See your top candidates ranked by match score, with matched and missing skills laid out clearly.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-brand-600" />
          <span className="text-lg font-semibold">RecruitIQ</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/auth/login" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            Log in
          </Link>
          <Link
            to="/auth/register"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Get started
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-20 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Hire faster with AI-powered candidate screening
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
          Post a job, let candidates apply with their resume, and get an AI-ranked shortlist of your best-fit
          applicants in minutes.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            to="/auth/register?role=company"
            className="rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-700"
          >
            I'm hiring
          </Link>
          <Link
            to="/auth/register?role=candidate"
            className="rounded-lg border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            I'm looking for a job
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-6 px-6 pb-24 sm:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, description }) => (
          <div key={title} className="rounded-xl border border-slate-200 p-6">
            <Icon className="h-6 w-6 text-brand-600" />
            <h3 className="mt-3 font-semibold text-slate-900">{title}</h3>
            <p className="mt-2 text-sm text-slate-600">{description}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
