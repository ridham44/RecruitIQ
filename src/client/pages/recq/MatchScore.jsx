import { Check, X } from 'lucide-react';

function tone(score) {
  if (score >= 80) return { ring: 'text-emerald-500', label: 'Strong match' };
  if (score >= 65) return { ring: 'text-brand-500', label: 'Good match' };
  if (score >= 50) return { ring: 'text-amber-500', label: 'Partial match' };
  return { ring: 'text-slate-400', label: 'Low match' };
}

// A circular score dial (candidate-facing — number + simple label only, no AI
// reasoning, §16).
function Dial({ score, pass }) {
  const t = tone(score);
  const r = 52;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.max(0, Math.min(100, score)) / 100) * c;
  return (
    <div className="relative h-32 w-32">
      <svg viewBox="0 0 120 120" className="h-32 w-32 -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="10" className="stroke-slate-100" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className={pass ? t.ring : 'text-slate-300'}
          stroke="currentColor"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-slate-900">{Math.round(score)}%</span>
      </div>
    </div>
  );
}

function Row({ ok, label }) {
  return (
    <li className="flex items-center gap-2 text-sm text-slate-700">
      {ok ? (
        <Check className="h-4 w-4 shrink-0 text-emerald-500" />
      ) : (
        <X className="h-4 w-4 shrink-0 text-slate-300" />
      )}
      {label}
    </li>
  );
}

// Build plan P9 (§4/§16) — candidate-facing resume match result.
export default function MatchScore({ match, jobTitle, threshold = 60 }) {
  const { score, pass, breakdown } = match;
  const t = tone(score);
  const b = breakdown || {};
  return (
    <div className="flex flex-col items-center text-center">
      <p className="text-sm font-medium text-slate-500">Resume Match</p>
      <div className="mt-3">
        <Dial score={score} pass={pass} />
      </div>
      <p className={`mt-3 text-base font-semibold ${pass ? 'text-slate-900' : 'text-slate-500'}`}>
        {pass ? t.label : 'Below the requirement'}
      </p>

      {pass ? (
        <>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            Your resume is a {score >= 80 ? 'strong' : 'good'} match{jobTitle ? ` for ${jobTitle}` : ' for this position'}.
          </p>
          <ul className="mt-4 w-full max-w-xs space-y-2 text-left">
            <Row ok={b.skills >= 50} label="Skills match" />
            <Row ok={b.experience >= 50} label="Experience match" />
            <Row ok={b.education >= 50} label="Education match" />
          </ul>
        </>
      ) : (
        <p className="mt-1 max-w-sm text-sm text-slate-500">
          Sorry, your resume doesn&apos;t currently meet the requirements for this position.
        </p>
      )}
    </div>
  );
}
