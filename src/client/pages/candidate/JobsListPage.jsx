import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, MapPin, Briefcase, SlidersHorizontal, X } from 'lucide-react';
import { jobsApi } from '../../services/jobs.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import { inputClass } from '../../components/ui/FormField.jsx';
import LoadingState from '../../components/ui/LoadingState.jsx';
import ErrorState from '../../components/ui/ErrorState.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';

const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE'];
const JOB_LEVELS = ['Entry', 'Junior', 'Mid', 'Senior', 'Lead'];

const DEFAULT_FILTERS = {
  employmentType: '',
  workMode: '',
  jobLevel: '',
  maxExperience: '',
};

// Every token in the query must match somewhere in the job's searchable
// text — so typing "react remote" narrows to jobs matching both words,
// in any order, without waiting for Enter or a round trip to the server.
function matchesSearch(job, query) {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;

  const haystack = [
    job.title,
    job.company?.name,
    job.location,
    job.workMode,
    job.jobLevel,
    job.employmentType,
    ...(job.requiredSkills || []),
    ...(job.preferredSkills || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return tokens.every((token) => haystack.includes(token));
}

export default function JobsListPage() {
  const [jobs, setJobs] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);

  const load = () => {
    setError('');
    jobsApi
      .listOpen()
      .then((data) => setJobs(data.jobs))
      .catch((err) => setError(err.message));
  };

  useEffect(load, []);

  const workModes = useMemo(
    () => Array.from(new Set((jobs || []).map((j) => j.workMode).filter(Boolean))),
    [jobs],
  );

  const filteredJobs = useMemo(() => {
    if (!jobs) return null;
    return jobs.filter((job) => {
      if (!matchesSearch(job, search)) return false;
      if (filters.employmentType && job.employmentType !== filters.employmentType) return false;
      if (filters.workMode && job.workMode !== filters.workMode) return false;
      if (filters.jobLevel && job.jobLevel !== filters.jobLevel) return false;
      if (filters.maxExperience !== '' && job.minimumExperience > Number(filters.maxExperience)) return false;
      return true;
    });
  }, [jobs, search, filters]);

  const activeFilterCount = Object.values(filters).filter((v) => v !== '').length;

  const resetFilters = () => setFilters(DEFAULT_FILTERS);

  return (
    <div>
      <h2 className="mb-6 text-xl font-semibold text-slate-900">Find jobs</h2>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className={`${inputClass} pl-9 ${search ? 'pr-9' : ''}`}
            placeholder="Search by title, company, location, or skill"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <Button
          type="button"
          variant="secondary"
          onClick={() => setShowFilters((s) => !s)}
          className="w-full justify-center sm:w-auto"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-1 rounded-full bg-brand-600 px-1.5 py-0.5 text-xs font-semibold text-white">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </div>

      {showFilters && (
        <Card className="mb-6 p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Employment type
              </label>
              <select
                className={inputClass}
                value={filters.employmentType}
                onChange={(e) => setFilters((f) => ({ ...f, employmentType: e.target.value }))}
              >
                <option value="">Any</option>
                {EMPLOYMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Work mode
              </label>
              <select
                className={inputClass}
                value={filters.workMode}
                onChange={(e) => setFilters((f) => ({ ...f, workMode: e.target.value }))}
              >
                <option value="">Any</option>
                {workModes.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Job level
              </label>
              <select
                className={inputClass}
                value={filters.jobLevel}
                onChange={(e) => setFilters((f) => ({ ...f, jobLevel: e.target.value }))}
              >
                <option value="">Any</option>
                {JOB_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Max experience required (yrs)
              </label>
              <input
                type="number"
                min={0}
                step={0.5}
                className={inputClass}
                placeholder="e.g. 2"
                value={filters.maxExperience}
                onChange={(e) => setFilters((f) => ({ ...f, maxExperience: e.target.value }))}
              />
            </div>
          </div>

          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={resetFilters}
              className="mt-3 text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              Clear filters
            </button>
          )}
        </Card>
      )}

      {error && <ErrorState message={error} onRetry={load} />}
      {!error && !jobs && <LoadingState />}
      {filteredJobs && filteredJobs.length === 0 && (
        <EmptyState icon={Briefcase} title="No jobs found" description="Try a different search or fewer filters." />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {filteredJobs?.map((job) => (
          <Link key={job.id} to={`/candidate/jobs/${job.id}`}>
            <Card className="h-full p-5 transition-shadow hover:shadow-md">
              <p className="font-semibold text-slate-900">{job.title}</p>
              <p className="text-sm text-slate-500">{job.company?.name}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                {job.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> {job.location}
                  </span>
                )}
                <span>{job.employmentType.replace('_', ' ')}</span>
                <span className="rounded bg-blue-50 px-1.5 py-0.5 font-medium text-blue-700">
                  {job.workMode || 'On-site'}
                </span>
                <span className="rounded bg-purple-50 px-1.5 py-0.5 font-medium text-purple-700">
                  {job.jobLevel || 'Mid'}
                </span>
                {job.salaryRange && (
                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-700">
                    {job.salaryRange}
                  </span>
                )}
                {job.openings > 1 && (
                  <span className="rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-700">
                    {job.openings} openings
                  </span>
                )}
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
