import { Check } from 'lucide-react';

// Build plan P9 (§13/§35) — a compact, mobile-first progress trail for the
// apply flow. `current` is the 0-based index of the active step.
export default function StepTrail({ steps, current, className = '' }) {
  return (
    <ol className={`flex items-center ${className}`}>
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition-colors
                  ${done ? 'bg-brand-600 text-white' : active ? 'bg-brand-100 text-brand-700 ring-2 ring-brand-500' : 'bg-slate-100 text-slate-400'}`}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className={`text-[10px] font-medium ${active ? 'text-brand-700' : 'text-slate-400'}`}>{label}</span>
            </div>
            {i < steps.length - 1 && (
              <span className={`mx-1 mb-4 h-0.5 flex-1 rounded ${done ? 'bg-brand-500' : 'bg-slate-200'}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
