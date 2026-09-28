import { Phone, Video } from 'lucide-react';

// Telephonic interviews — shared UI pieces for the ONLINE/PHONE interview
// mode (company picks it per slot) and the phone call's status.

const MODE_OPTIONS = [
  { value: 'ONLINE', label: 'Online (in app)', hint: 'Candidate joins the AI interview room in the browser', icon: Video },
  { value: 'PHONE', label: 'Telephonic', hint: 'AI calls the candidate on their phone at slot time', icon: Phone },
];

// Two large, touch-friendly choice cards; stacks on narrow phones.
export function InterviewModePicker({ value, onChange, label = 'Interview type' }) {
  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label={label}>
        {MODE_OPTIONS.map(({ value: optionValue, label: optionLabel, hint, icon: Icon }) => {
          const selected = value === optionValue;
          return (
            <button
              key={optionValue}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(optionValue)}
              className={`flex min-h-[44px] items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                selected ? 'border-brand-600 bg-brand-50' : 'border-slate-300 hover:bg-slate-50'
              }`}
            >
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${selected ? 'text-brand-600' : 'text-slate-400'}`} />
              <span>
                <span className={`block text-sm font-medium ${selected ? 'text-brand-700' : 'text-slate-700'}`}>{optionLabel}</span>
                <span className="block text-xs text-slate-500">{hint}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function InterviewModeBadge({ mode }) {
  const isPhone = mode === 'PHONE';
  const Icon = isPhone ? Phone : Video;
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${
        isPhone ? 'bg-indigo-100 text-indigo-700' : 'bg-sky-100 text-sky-700'
      }`}
    >
      <Icon className="h-3 w-3" />
      {isPhone ? 'Telephonic' : 'Online'}
    </span>
  );
}

const CALL_STATUS_META = {
  PENDING: { label: 'Call scheduled', style: 'bg-slate-100 text-slate-700' },
  DIALING: { label: 'Calling…', style: 'bg-amber-100 text-amber-700' },
  IN_CALL: { label: 'On call', style: 'bg-emerald-100 text-emerald-700' },
  COMPLETED: { label: 'Call completed', style: 'bg-purple-100 text-purple-700' },
  NO_ANSWER: { label: 'No answer', style: 'bg-red-100 text-red-700' },
  FAILED: { label: 'Call failed', style: 'bg-red-100 text-red-700' },
};

export function CallStatusBadge({ status }) {
  if (!status) return null;
  const meta = CALL_STATUS_META[status] || { label: status, style: 'bg-slate-100 text-slate-700' };
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.style}`}>
      <Phone className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

// A call is "live" while it's being dialed or talked on — pages poll for
// updates during that window so the status changes without a refresh.
export function isCallLive(status) {
  return status === 'DIALING' || status === 'IN_CALL';
}
