import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Search, MapPin, Briefcase, FileUp, ChevronRight } from 'lucide-react';
import { publicApi } from '../../services/public.js';
import CareersShell from './CareersShell.jsx';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import LoadingState from '../../components/ui/LoadingState.jsx';
import ErrorState from '../../components/ui/ErrorState.jsx';
import { inputClass } from '../../components/ui/FormField.jsx';

const label = (s) => String(s || '').replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

// Build plan P4 — /careers/:slug: a recruitment company's open jobs.
export default function CareersPage() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    setError('');
    publicApi
      .getPortal(slug)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [slug]);

  const jobs = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!data) return [];
    if (!term) return data.jobs;
    return data.jobs.filter((j) => [j.title, j.location, ...(j.requiredSkills || [])].some((v) => String(v || '').toLowerCase().includes(term)));
  }, [data, q]);

  if (error) {
    return (
      <CareersShell>
        <ErrorState message={error} />
      </CareersShell>
    );
  }
  if (!data) {
    return (
      <CareersShell>
        <LoadingState />
      </CareersShell>
    );
  }

  return (
    <CareersShell company={data.company} slug={slug}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Open positions</h1>
        {data.company.description && <p className="mt-2 max-w-3xl whitespace-pre-line text-sm text-slate-600">{data.company.description}</p>}
      </div>

      <Card className="mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <FileUp className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
          <div>
            <p className="text-sm font-medium text-slate-900">Don't see the right role?</p>
            <p className="text-sm text-slate-500">Upload your CV and our AI will match you to the best open job.</p>
          </div>
        </div>
        <Link to={`/careers/${slug}/submit-cv`} className="sm:shrink-0">
          <Button variant="secondary" className="w-full sm:w-auto">
            Submit your CV
          </Button>
        </Link>
      </Card>

      {data.jobs.length > 0 && (
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            className={`${inputClass} min-h-[44px] pl-9`}
            placeholder="Search by title, skill or location"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      )}

      {data.jobs.length === 0 && (
        <Card className="p-8 text-center text-sm text-slate-500">There are no open positions right now — you can still submit your CV above.</Card>
      )}
      {data.jobs.length > 0 && jobs.length === 0 && <Card className="p-8 text-center text-sm text-slate-500">No jobs match "{q}".</Card>}

      <div className="space-y-3">
        {jobs.map((job) => (
          <Link key={job.id} to={`/careers/${slug}/jobs/${job.id}`} className="block">
            <Card className="flex items-center gap-3 p-4 transition-colors hover:border-brand-200 active:bg-slate-50 sm:p-5">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{job.title}</p>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> {job.location || job.workMode || 'Location not specified'}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Briefcase className="h-3.5 w-3.5" /> {label(job.employmentType)} · {job.jobLevel}
                  </span>
                  {job.workMode && job.location && <span>{job.workMode}</span>}
                </div>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
            </Card>
          </Link>
        ))}
      </div>
    </CareersShell>
  );
}
