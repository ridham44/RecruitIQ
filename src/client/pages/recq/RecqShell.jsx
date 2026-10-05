import { Link } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { safeHttpUrl } from '../../utils/safeUrl.js';

// Build plan P9 — public /recq frame. Mobile-first, agency-branded, no app
// nav. `to` links the header back to the agency page when a slug is given.
export default function RecqShell({ agency, agencySlug, children, narrow = false }) {
  const logo = safeHttpUrl(agency?.logoUrl);
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3.5 sm:px-6">
          {logo ? (
            <img src={logo} alt="" className="h-9 w-9 shrink-0 rounded-lg object-contain" />
          ) : (
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <Building2 className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            {agencySlug ? (
              <Link to={`/recq/${agencySlug}`} className="block truncate text-[15px] font-semibold text-slate-900 hover:text-brand-700 sm:text-base">
                {agency?.name || 'Recruitment'}
              </Link>
            ) : (
              <span className="block truncate text-[15px] font-semibold text-slate-900 sm:text-base">{agency?.name || 'Recruitment'}</span>
            )}
            <span className="block text-[11px] uppercase tracking-wide text-slate-400">Careers</span>
          </div>
        </div>
      </header>
      <main className={`mx-auto w-full flex-1 px-4 py-6 sm:px-6 sm:py-8 ${narrow ? 'max-w-xl' : 'max-w-5xl'}`}>{children}</main>
      <footer className="pb-7 pt-2 text-center text-xs text-slate-400">
        Powered by{' '}
        <Link to="/" className="font-medium text-slate-500 hover:text-slate-700">
          RecruitIQ
        </Link>
      </footer>
    </div>
  );
}
