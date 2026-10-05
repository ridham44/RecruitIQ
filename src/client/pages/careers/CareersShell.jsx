import { Link } from 'react-router-dom';
import { Building } from 'lucide-react';
import { safeHttpUrl } from '../../utils/safeUrl.js';

// Build plan P4 — public careers portal frame: the recruitment company's
// name/logo on top, content below. Mobile-first, no app navigation.
export default function CareersShell({ company, slug, children, narrow = false }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4 sm:px-6">
          {safeHttpUrl(company?.logoUrl) ? (
            <img src={safeHttpUrl(company.logoUrl)} alt="" className="h-10 w-10 shrink-0 rounded-lg object-contain" />
          ) : (
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <Building className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0">
            {slug ? (
              <Link to={`/careers/${slug}`} className="block truncate text-base font-semibold text-slate-900 hover:text-brand-700 sm:text-lg">
                {company?.name || 'Careers'}
              </Link>
            ) : (
              <span className="block truncate text-base font-semibold text-slate-900 sm:text-lg">{company?.name || 'Careers'}</span>
            )}
            <span className="block text-xs text-slate-500">Careers</span>
          </div>
        </div>
      </header>
      <main className={`mx-auto px-4 py-6 sm:px-6 sm:py-8 ${narrow ? 'max-w-2xl' : 'max-w-5xl'}`}>{children}</main>
      <footer className="pb-8 text-center text-xs text-slate-400">
        Powered by{' '}
        <Link to="/" className="font-medium text-slate-500 hover:text-slate-700">
          RecruitIQ
        </Link>
      </footer>
    </div>
  );
}
