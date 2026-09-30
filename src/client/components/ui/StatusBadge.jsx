const STYLES = {
  APPLIED: 'bg-slate-100 text-slate-700',
  SCREENING: 'bg-amber-100 text-amber-700',
  SHORTLISTED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-red-100 text-red-700',
  INTERVIEW_SCHEDULED: 'bg-blue-100 text-blue-700',
  INTERVIEW_COMPLETED: 'bg-purple-100 text-purple-700',
  OPEN: 'bg-emerald-100 text-emerald-700',
  CLOSED: 'bg-slate-200 text-slate-600',
  DRAFT: 'bg-amber-100 text-amber-700',
  PENDING: 'bg-slate-100 text-slate-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  FAILED: 'bg-red-100 text-red-700',
  AVAILABLE: 'bg-emerald-100 text-emerald-700',
  BOOKED: 'bg-blue-100 text-blue-700',
  CANCELLED: 'bg-slate-200 text-slate-600',
  SCHEDULED: 'bg-blue-100 text-blue-700',
  // Build plan P1 — company / user status (admin pages)
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  SUSPENDED: 'bg-red-100 text-red-700',
  INACTIVE: 'bg-slate-200 text-slate-600',
  INVITED: 'bg-amber-100 text-amber-700',
  // Build plan P2 — company members
  OWNER: 'bg-brand-50 text-brand-700',
  // Build plan P7 — post-interview decisions / client submissions
  QUALIFIED: 'bg-teal-100 text-teal-700',
  NOT_QUALIFIED: 'bg-orange-100 text-orange-700',
  SUBMITTED_TO_CLIENT: 'bg-violet-100 text-violet-700',
  SENT: 'bg-blue-100 text-blue-700',
  VIEWED: 'bg-emerald-100 text-emerald-700',
  // Build plan P4 — CV pool
  MATCHED: 'bg-emerald-100 text-emerald-700',
  NO_MATCH: 'bg-slate-200 text-slate-600',
  MATCHING: 'bg-amber-100 text-amber-700',
};

export default function StatusBadge({ status }) {
  const style = STYLES[status] || 'bg-slate-100 text-slate-700';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${style}`}>
      {status?.toLowerCase().replace(/_/g, ' ')}
    </span>
  );
}
