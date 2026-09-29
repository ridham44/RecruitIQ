import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Briefcase, Users, IndianRupee } from 'lucide-react';
import { publicApi } from '../../services/public.js';
import CareersShell from './CareersShell.jsx';
import ApplyWizard from './ApplyWizard.jsx';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import LoadingState from '../../components/ui/LoadingState.jsx';
import ErrorState from '../../components/ui/ErrorState.jsx';

const label = (s) => String(s || '').replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

// Build plan P4 — /careers/:slug/jobs/:jobId: job details + apply wizard.
export default function CareersJobPage() {
  const { slug, jobId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    publicApi
      .getPortalJob(slug, jobId)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [slug, jobId]);

  if (error || !data) {
    return (
      <CareersShell slug={slug}>
        {error ? (
          <div className="space-y-4">
            <ErrorState message={error} />
            <Link to={`/careers/${slug}`} className="inline-flex min-h-[44px] items-center gap-1 text-sm text-brand-600">
              <ArrowLeft className="h-4 w-4" /> See all open jobs
            </Link>
          </div>
        ) : (
          <LoadingState />
        )}
      </CareersShell>
    );
  }

  const { company, job } = data;
  const experience =
    job.maximumExperience != null ? `${job.minimumExperience}–${job.maximumExperience} years` : job.minimumExperience ? `${job.minimumExperience}+ years` : null;

  return (
    <CareersShell company={company} slug={slug} narrow>
      <Link to={`/careers/${slug}`} className="mb-4 inline-flex min-h-[44px] items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> All jobs
      </Link>

      {applying ? (
        <ApplyWizard slug={slug} company={company} job={job} />
      ) : (
        <>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{job.title}</h1>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-4 w-4" /> {job.location || 'Location not specified'} · {job.workMode}
            </span>
            <span className="inline-flex items-center gap-1">
              <Briefcase className="h-4 w-4" /> {label(job.employmentType)} · {job.jobLevel}
            </span>
            {job.openings > 1 && (
              <span className="inline-flex items-center gap-1">
                <Users className="h-4 w-4" /> {job.openings} openings
              </span>
            )}
            {job.salaryRange && (
              <span className="inline-flex items-center gap-1">
                <IndianRupee className="h-4 w-4" /> {job.salaryRange}
              </span>
            )}
          </div>

          <Button onClick={() => setApplying(true)} className="mt-5 w-full sm:w-auto">
            Apply now
          </Button>

          <Card className="mt-6 p-4 sm:p-6">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">About the role</h2>
            <p className="whitespace-pre-wrap text-sm text-slate-600">{job.description}</p>
            {experience && (
              <>
                <h2 className="mb-1 mt-5 text-sm font-semibold text-slate-900">Experience</h2>
                <p className="text-sm text-slate-600">{experience}</p>
              </>
            )}
            {job.requiredSkills?.length > 0 && (
              <>
                <h2 className="mb-2 mt-5 text-sm font-semibold text-slate-900">Skills</h2>
                <div className="flex flex-wrap gap-2">
                  {[...job.requiredSkills, ...(job.preferredSkills || [])].map((s) => (
                    <span key={s} className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
                      {s}
                    </span>
                  ))}
                </div>
              </>
            )}
          </Card>

          <div className="sticky bottom-0 -mx-4 mt-6 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:hidden">
            <Button onClick={() => setApplying(true)} className="w-full">
              Apply now
            </Button>
          </div>
        </>
      )}
    </CareersShell>
  );
}
