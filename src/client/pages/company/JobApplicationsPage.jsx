import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Sparkles, Eye, Users, SlidersHorizontal, X, Save, RefreshCw } from 'lucide-react';
import { screeningApi } from '../../services/screening.js';
import { jobsApi } from '../../services/jobs.js';
import { applicationsApi } from '../../services/applications.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import LoadingState from '../../components/ui/LoadingState.jsx';
import ErrorState from '../../components/ui/ErrorState.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import ScoreRing from '../../components/ui/ScoreRing.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import { inputClass } from '../../components/ui/FormField.jsx';

const SCORE_PRESETS = [
  { key: 'all', label: 'All' },
  { key: '90', label: '90+' },
  { key: '80', label: '80+' },
  { key: '75', label: '75+' },
  { key: 'below75', label: 'Below 75' },
  { key: 'custom', label: 'Custom' },
];

const EXPERIENCE_PRESETS = [
  { key: 'all', label: 'All' },
  { key: '0', label: '0+ yrs' },
  { key: '1', label: '1+ yrs' },
  { key: '2', label: '2+ yrs' },
  { key: '3', label: '3+ yrs' },
];

const STATUS_OPTIONS = ['APPLIED', 'SCREENING', 'SHORTLISTED', 'REJECTED'];

const SORT_OPTIONS = [
  { key: 'score', label: 'AI Score' },
  { key: 'experience', label: 'Experience' },
  { key: 'newest', label: 'Newest' },
];

const DEFAULT_FILTERS = {
  scorePreset: 'all',
  scoreMin: '',
  scoreMax: '',
  experience: 'all',
  skills: [],
  education: [],
  statuses: [],
  sortBy: 'score',
  top10Only: false,
};

function getScore(app) {
  return app.screeningResult?.status === 'COMPLETED' ? app.screeningResult.overallScore : null;
}
function getExperience(app) {
  return app.resume?.parsedData?.totalExperienceYears ?? 0;
}
function getDegree(app) {
  return app.candidate?.degree || app.resume?.parsedData?.degree || '';
}
function getSkillPool(app) {
  const matched = app.screeningResult?.matchedSkills || [];
  const resumeSkills = app.resume?.parsedData?.skills || [];
  return new Set([...matched, ...resumeSkills].map((s) => s.toLowerCase()));
}

function applyFilters(applications, filters) {
  let list = applications.filter((app) => {
    const score = getScore(app);

    if (filters.scorePreset !== 'all') {
      if (score == null) return false;
      if (filters.scorePreset === '90' && score < 90) return false;
      if (filters.scorePreset === '80' && score < 80) return false;
      if (filters.scorePreset === '75' && score < 75) return false;
      if (filters.scorePreset === 'below75' && score >= 75) return false;
      if (filters.scorePreset === 'custom') {
        const min = filters.scoreMin === '' ? -Infinity : Number(filters.scoreMin);
        const max = filters.scoreMax === '' ? Infinity : Number(filters.scoreMax);
        if (score < min || score > max) return false;
      }
    }

    if (filters.experience !== 'all' && getExperience(app) < Number(filters.experience)) return false;

    if (filters.skills.length > 0) {
      const pool = getSkillPool(app);
      if (!filters.skills.every((s) => pool.has(s.toLowerCase()))) return false;
    }

    if (filters.education.length > 0 && !filters.education.includes(getDegree(app))) return false;

    if (filters.statuses.length > 0 && !filters.statuses.includes(app.status)) return false;

    return true;
  });

  list = [...list].sort((a, b) => {
    if (filters.sortBy === 'experience') return getExperience(b) - getExperience(a);
    if (filters.sortBy === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
    return (getScore(b) ?? -1) - (getScore(a) ?? -1);
  });

  return filters.top10Only ? list.slice(0, 10) : list;
}

export default function JobApplicationsPage() {
  const { id: jobId } = useParams();
  const [job, setJob] = useState(null);
  const [applications, setApplications] = useState(null);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [selected, setSelected] = useState(new Set());
  const [confirmBulk, setConfirmBulk] = useState(null); // 'SHORTLISTED' | 'REJECTED' | null
  const [bulkLoading, setBulkLoading] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [confirmRerun, setConfirmRerun] = useState(false);

  const [settings, setSettings] = useState(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const load = () => {
    setError('');
    Promise.all([jobsApi.get(jobId), applicationsApi.listForJob(jobId)])
      .then(([jobRes, appsRes]) => {
        setJob(jobRes.job);
        setSettings({
          minAcceptableScore: jobRes.job.minAcceptableScore,
          autoRejectBelowMinScore: jobRes.job.autoRejectBelowMinScore,
        });
        setApplications(appsRes.applications);
        setSelected(new Set());
      })
      .catch((err) => setError(err.message));
  };

  useEffect(load, [jobId]);

  const pendingCount = useMemo(
    () => (applications || []).filter((a) => a.screeningResult?.status !== 'COMPLETED').length,
    [applications]
  );

  // Eligible for a forced re-screen: already scored, but not a manual
  // SHORTLISTED decision (screening never revisits those — see
  // screening.service.js).
  const rerunnableCount = useMemo(
    () => (applications || []).filter((a) => a.screeningResult?.status === 'COMPLETED' && a.status !== 'SHORTLISTED').length,
    [applications]
  );

  const skillOptions = useMemo(
    () => Array.from(new Set([...(job?.requiredSkills || []), ...(job?.preferredSkills || [])])),
    [job]
  );

  const educationOptions = useMemo(() => {
    if (!applications) return [];
    return Array.from(new Set(applications.map(getDegree).filter(Boolean)));
  }, [applications]);

  const filtered = useMemo(() => (applications ? applyFilters(applications, filters) : []), [applications, filters]);

  const filtersActive =
    filters.scorePreset !== 'all' ||
    filters.experience !== 'all' ||
    filters.skills.length > 0 ||
    filters.education.length > 0 ||
    filters.statuses.length > 0 ||
    filters.top10Only;

  const handleRunScreening = async () => {
    setRunning(true);
    setError('');
    try {
      await screeningApi.runForJob(jobId);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  const handleRerunScreening = async () => {
    setRerunning(true);
    setError('');
    try {
      await screeningApi.runForJob(jobId, true);
      setConfirmRerun(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setRerunning(false);
    }
  };

  const handleSaveSettings = async () => {
    setSettingsSaving(true);
    setSettingsSaved(false);
    setError('');
    try {
      const { job: updated } = await jobsApi.update(jobId, {
        minAcceptableScore: Number(settings.minAcceptableScore),
        autoRejectBelowMinScore: settings.autoRejectBelowMinScore,
      });
      setJob(updated);
      setSettingsSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSettingsSaving(false);
    }
  };

  const toggleSelected = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allVisibleSelected = filtered.length > 0 && filtered.every((a) => selected.has(a.id));
  const toggleSelectAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) filtered.forEach((a) => next.delete(a.id));
      else filtered.forEach((a) => next.add(a.id));
      return next;
    });
  };

  const runBulkAction = async () => {
    setBulkLoading(true);
    setError('');
    try {
      await applicationsApi.bulkUpdateStatus(jobId, Array.from(selected), confirmBulk);
      setConfirmBulk(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBulkLoading(false);
    }
  };

  const toggleMulti = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: prev[key].includes(value) ? prev[key].filter((v) => v !== value) : [...prev[key], value],
    }));
  };

  if (error && !applications) return <ErrorState message={error} onRetry={load} />;
  if (!applications || !job || !settings) return <LoadingState />;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Applications — {job.title}</h2>
          <p className="text-sm text-slate-500">
            {applications.length} total · {pendingCount} pending screening
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={handleRunScreening} loading={running} disabled={pendingCount === 0} className="w-full sm:w-auto">
            <Sparkles className="h-4 w-4" />
            {pendingCount === 0 ? 'All screened' : `Run AI Screening (${pendingCount})`}
          </Button>
          {rerunnableCount > 0 && (
            <Button variant="secondary" onClick={() => setConfirmRerun(true)} className="w-full sm:w-auto">
              <RefreshCw className="h-4 w-4" /> Re-run Screening ({rerunnableCount})
            </Button>
          )}
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {/* Job-level screening decision settings */}
      <Card className="mb-6 p-5">
        <h3 className="mb-3 font-semibold text-slate-900">Screening settings</h3>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-6">
          <div className="w-full sm:w-48">
            <label className="mb-1 block text-sm font-medium text-slate-700">Minimum acceptable score</label>
            <input
              type="number"
              min={0}
              max={100}
              className={inputClass}
              value={settings.minAcceptableScore}
              onChange={(e) => setSettings({ ...settings, minAcceptableScore: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={settings.autoRejectBelowMinScore}
              onChange={(e) => setSettings({ ...settings, autoRejectBelowMinScore: e.target.checked })}
            />
            Automatically reject candidates below this score
          </label>
          <Button variant="secondary" onClick={handleSaveSettings} loading={settingsSaving} className="sm:ml-auto">
            <Save className="h-4 w-4" /> Save
          </Button>
        </div>
        {settingsSaved && (
          <p className="mt-2 text-sm text-emerald-600">
            Settings saved.{' '}
            {rerunnableCount > 0 && (
              <button type="button" onClick={() => setConfirmRerun(true)} className="font-medium underline underline-offset-2">
                Re-run screening for {rerunnableCount} already-scored candidate{rerunnableCount === 1 ? '' : 's'} to apply it
              </button>
            )}
          </p>
        )}
        <p className="mt-2 text-xs text-slate-400">
          When enabled, screened applications scoring below this threshold are auto-marked Rejected. When disabled
          (default), all screened applications stay available for manual review — use the checkboxes below to
          Shortlist or Reject in bulk.
        </p>
      </Card>

      {/* Filters */}
      <Card className="mb-6 p-5">
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className="flex w-full items-center justify-between text-left"
        >
          <span className="flex items-center gap-2 font-semibold text-slate-900">
            <SlidersHorizontal className="h-4 w-4" /> Filters {filtersActive && <span className="h-2 w-2 rounded-full bg-brand-600" />}
          </span>
          <span className="text-sm text-brand-600">{showFilters ? 'Hide' : 'Show'}</span>
        </button>

        {showFilters && (
          <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <FilterGroup label="AI Score">
              <ChipGroup
                options={SCORE_PRESETS}
                selected={filters.scorePreset}
                onSelect={(key) => setFilters({ ...filters, scorePreset: key })}
              />
              {filters.scorePreset === 'custom' && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    className={`${inputClass} w-20`}
                    value={filters.scoreMin}
                    onChange={(e) => setFilters({ ...filters, scoreMin: e.target.value })}
                  />
                  <span className="text-slate-400">–</span>
                  <input
                    type="number"
                    placeholder="Max"
                    className={`${inputClass} w-20`}
                    value={filters.scoreMax}
                    onChange={(e) => setFilters({ ...filters, scoreMax: e.target.value })}
                  />
                </div>
              )}
            </FilterGroup>

            <FilterGroup label="Experience">
              <ChipGroup
                options={EXPERIENCE_PRESETS}
                selected={filters.experience}
                onSelect={(key) => setFilters({ ...filters, experience: key })}
              />
            </FilterGroup>

            <FilterGroup label="Sort by">
              <select
                className={inputClass}
                value={filters.sortBy}
                onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={filters.top10Only}
                  onChange={(e) => setFilters({ ...filters, top10Only: e.target.checked })}
                />
                Limit to top 10
              </label>
            </FilterGroup>

            {skillOptions.length > 0 && (
              <FilterGroup label="Skills">
                <MultiChipGroup options={skillOptions} selected={filters.skills} onToggle={(v) => toggleMulti('skills', v)} />
              </FilterGroup>
            )}

            {educationOptions.length > 0 && (
              <FilterGroup label="Education">
                <MultiChipGroup
                  options={educationOptions}
                  selected={filters.education}
                  onToggle={(v) => toggleMulti('education', v)}
                />
              </FilterGroup>
            )}

            <FilterGroup label="Application status">
              <MultiChipGroup
                options={STATUS_OPTIONS}
                selected={filters.statuses}
                onToggle={(v) => toggleMulti('statuses', v)}
                formatLabel={(v) => v.charAt(0) + v.slice(1).toLowerCase()}
              />
            </FilterGroup>

            <div className="flex items-end sm:col-span-2 lg:col-span-3">
              <Button variant="ghost" onClick={() => setFilters(DEFAULT_FILTERS)}>
                <X className="h-4 w-4" /> Clear all filters
              </Button>
            </div>
          </div>
        )}
      </Card>

      {selected.size > 0 && (
        <div className="mb-4 flex flex-col gap-3 rounded-lg border border-brand-200 bg-brand-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm font-medium text-brand-800">{selected.size} candidate(s) selected</span>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setConfirmBulk('SHORTLISTED')}>
              Shortlist selected
            </Button>
            <Button variant="danger" onClick={() => setConfirmBulk('REJECTED')}>
              Reject selected
            </Button>
            <Button variant="ghost" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {applications.length === 0 ? (
        <EmptyState icon={Users} title="No applications yet" description="Candidates who apply to this job will show up here." />
      ) : filtered.length === 0 ? (
        <EmptyState icon={SlidersHorizontal} title="No candidates match these filters" description="Try adjusting or clearing your filters." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">
                  <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAllVisible} />
                </th>
                <th className="px-4 py-3">Rank</th>
                <th className="px-4 py-3">Candidate</th>
                <th className="px-4 py-3">Match</th>
                <th className="px-4 py-3">Experience</th>
                <th className="px-4 py-3">Education</th>
                <th className="px-4 py-3">Matched skills</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((app, index) => (
                <tr key={app.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selected.has(app.id)} onChange={() => toggleSelected(app.id)} />
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">#{index + 1}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{app.candidate.fullName}</p>
                    <StatusBadge status={app.status} />
                  </td>
                  <td className="px-4 py-3">
                    {getScore(app) != null ? <ScoreRing score={getScore(app)} size={36} /> : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{getExperience(app)} yrs</td>
                  <td className="max-w-[160px] px-4 py-3 text-slate-600">{getDegree(app) || '—'}</td>
                  <td className="max-w-xs px-4 py-3 text-slate-600">
                    {(app.screeningResult?.matchedSkills || []).slice(0, 4).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/company/jobs/${jobId}/candidates/${app.candidate.id}`}
                      className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-700"
                    >
                      <Eye className="h-4 w-4" /> View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <ConfirmDialog
        open={confirmBulk !== null}
        title={confirmBulk === 'SHORTLISTED' ? 'Shortlist selected candidates?' : 'Reject selected candidates?'}
        description={`This will update ${selected.size} application(s).`}
        confirmLabel={confirmBulk === 'SHORTLISTED' ? 'Shortlist' : 'Reject'}
        onConfirm={runBulkAction}
        onCancel={() => setConfirmBulk(null)}
        loading={bulkLoading}
      />

      <ConfirmDialog
        open={confirmRerun}
        title="Re-run screening?"
        description={`This re-scores ${rerunnableCount} already-screened candidate(s) using the current job requirements and screening settings. Shortlisted candidates are never touched. This calls the AI again and may take a moment.`}
        confirmLabel="Re-run"
        onConfirm={handleRerunScreening}
        onCancel={() => setConfirmRerun(false)}
        loading={rerunning}
      />
    </div>
  );
}

function FilterGroup({ label, children }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      {children}
    </div>
  );
}

function ChipGroup({ options, selected, onSelect }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onSelect(opt.key)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            selected === opt.key ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function MultiChipGroup({ options, selected, onToggle, formatLabel = (v) => v }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onToggle(opt)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            selected.includes(opt) ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          {formatLabel(opt)}
        </button>
      ))}
    </div>
  );
}
