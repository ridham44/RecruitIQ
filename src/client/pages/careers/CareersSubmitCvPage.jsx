import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { publicApi } from '../../services/public.js';
import CareersShell from './CareersShell.jsx';
import ApplyWizard from './ApplyWizard.jsx';
import LoadingState from '../../components/ui/LoadingState.jsx';
import ErrorState from '../../components/ui/ErrorState.jsx';

// Build plan P4 (§6B) — /careers/:slug/submit-cv: CV without choosing a job.
export default function CareersSubmitCvPage() {
  const { slug } = useParams();
  const [company, setCompany] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    publicApi
      .getPortal(slug)
      .then((data) => setCompany(data.company))
      .catch((err) => setError(err.message));
  }, [slug]);

  return (
    <CareersShell company={company} slug={slug} narrow>
      <Link to={`/careers/${slug}`} className="mb-4 inline-flex min-h-[44px] items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> All jobs
      </Link>
      {error && <ErrorState message={error} />}
      {!error && !company && <LoadingState />}
      {company && <ApplyWizard slug={slug} company={company} job={null} />}
    </CareersShell>
  );
}
