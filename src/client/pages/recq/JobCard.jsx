import { MapPin, Briefcase, Clock } from 'lucide-react';
import Button from '../../components/ui/Button.jsx';

// Formats FULL_TIME → "Full-time", INTERNSHIP → "Internship", etc.
export function employmentLabel(type) {
  if (!type) return '';
  return String(type)
    .toLowerCase()
    .split('_')
    .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join('-');
}

export function experienceLabel(min, max) {
  const lo = Number(min) || 0;
  if (max != null && max !== '') return `${lo}–${max} yrs`;
  return lo > 0 ? `${lo}+ yrs` : null;
}

// Build plan P9 (§14) — a clean, professional mobile job card.
export default function JobCard({ job, onApply }) {
  const exp = experienceLabel(job.minimumExperience, job.maximumExperience);
  const skills = (job.requiredSkills?.length ? job.requiredSkills : job.preferredSkills) || [];
  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5">
      <h3 className="text-base font-semibold text-slate-900 sm:text-lg">{job.title}</h3>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-slate-600">
        {job.location && (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-slate-400" />
            {job.location}
          </span>
        )}
        {(job.employmentType || job.workMode) && (
          <span className="inline-flex items-center gap-1.5">
            <Briefcase className="h-4 w-4 text-slate-400" />
            {[employmentLabel(job.employmentType), job.workMode].filter(Boolean).join(' · ')}
          </span>
        )}
        {exp && (
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-slate-400" />
            {exp}
          </span>
        )}
      </div>

      {job.description && (
        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-500">{job.description}</p>
      )}

      {skills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {skills.slice(0, 6).map((s) => (
            <span key={s} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
              {s}
            </span>
          ))}
          {skills.length > 6 && <span className="px-1 py-1 text-xs text-slate-400">+{skills.length - 6}</span>}
        </div>
      )}

      <div className="mt-4 pt-1">
        <Button onClick={() => onApply(job)} className="w-full sm:w-auto">
          View &amp; Apply
        </Button>
      </div>
    </div>
  );
}
