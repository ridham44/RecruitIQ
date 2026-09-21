import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function AuthShell({ title, subtitle, children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <img src="/Logo.png" alt="RecruitIQ" className="h-12 w-12 object-contain" />
          <span className="text-lg font-semibold text-slate-900">RecruitIQ</span>
        </Link>
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
