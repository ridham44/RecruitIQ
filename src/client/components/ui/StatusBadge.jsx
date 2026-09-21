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
};

export default function StatusBadge({ status }) {
  const style = STYLES[status] || 'bg-slate-100 text-slate-700';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${style}`}>
      {status?.toLowerCase().replace(/_/g, ' ')}
    </span>
  );
}
