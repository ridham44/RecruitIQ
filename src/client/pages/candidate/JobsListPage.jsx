import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, MapPin, Briefcase } from 'lucide-react';
import { jobsApi } from '../../services/jobs.js';
import Card from '../../components/ui/Card.jsx';
import { inputClass } from '../../components/ui/FormField.jsx';
import LoadingState from '../../components/ui/LoadingState.jsx';
import ErrorState from '../../components/ui/ErrorState.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';

export default function JobsListPage() {
  const [jobs, setJobs] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = (q) => {
    setError('');
    jobsApi
      .listOpen(q)
      .then((data) => setJobs(data.jobs))
      .catch((err) => setError(err.message));
  };

  useEffect(() => load(''), []);

  const handleSearch = (e) => {
    e.preventDefault();
    load(search);
  };

  return (
    <div>
      <h2 className="mb-6 text-xl font-semibold text-slate-900">Find jobs</h2>

      <form onSubmit={handleSearch} className="relative mb-6 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className={`${inputClass} pl-9`}
          placeholder="Search by title or location"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </form>

      {error && <ErrorState message={error} onRetry={() => load(search)} />}
      {!error && !jobs && <LoadingState />}
      {jobs && jobs.length === 0 && <EmptyState icon={Briefcase} title="No jobs found" description="Try a different search." />}

      <div className="grid gap-4 sm:grid-cols-2">
        {jobs?.map((job) => (
          <Link key={job.id} to={`/candidate/jobs/${job.id}`}>
            <Card className="h-full p-5 transition-shadow hover:shadow-md">
              <p className="font-semibold text-slate-900">{job.title}</p>
              <p className="text-sm text-slate-500">{job.company?.name}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                {job.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> {job.location}
                  </span>
                )}
                <span>{job.employmentType.replace('_', ' ')}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {job.requiredSkills.slice(0, 4).map((skill) => (
                  <span key={skill} className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                    {skill}
                  </span>
                ))}
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
