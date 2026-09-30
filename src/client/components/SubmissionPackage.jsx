import { useState } from 'react';
import { Mail, Phone, MapPin, ChevronDown, ChevronRight } from 'lucide-react';
import Card from './ui/Card.jsx';

const VERDICT = {
  MET: ['Met', 'bg-emerald-100 text-emerald-700'],
  PARTLY: ['Partly met', 'bg-amber-100 text-amber-700'],
  NOT_MET: ['Not met', 'bg-red-100 text-red-700'],
};

function ScoreTile({ label, value, highlight }) {
  return (
    <div className={`rounded-xl p-3 text-center ${highlight ? 'bg-brand-600 text-white' : 'bg-white ring-1 ring-slate-200'}`}>
      <p className={`text-xs ${highlight ? 'text-brand-100' : 'text-slate-500'}`}>{label}</p>
      <p className="text-2xl font-bold">{value != null ? Math.round(value) : '—'}</p>
    </div>
  );
}

function List({ title, items, tone = 'slate' }) {
  if (!items?.length) return null;
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-slate-900">{title}</h3>
      <ul className="space-y-1">
        {items.map((s) => (
          <li key={s} className={`rounded-lg px-3 py-1.5 text-sm ${tone === 'green' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Build plan P7/P8 — the frozen candidate package a client HR person sees:
// contact details, CV actions, CV match, interview evaluation, recruiter
// criteria and question-by-question summaries. Shared by the emailed
// read-only link (/submission/:token) and the client portal.
export default function SubmissionPackage({ snapshot: s, cvActions, footer }) {
  const [openQ, setOpenQ] = useState(null);

  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-sm text-slate-500">
        Candidate for <strong className="text-slate-700">{s.job.title}</strong>
        {s.client && ` · ${s.client.name}${s.client.department ? ` — ${s.client.department}` : ''}`}
      </p>
      <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-bold text-slate-900">{s.candidate.fullName}</h1>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
            <a href={`mailto:${s.candidate.email}`} className="inline-flex items-center gap-1 break-all hover:text-brand-600">
              <Mail className="h-4 w-4 shrink-0" /> {s.candidate.email}
            </a>
            {s.candidate.phone && (
              <a href={`tel:${s.candidate.phone}`} className="inline-flex items-center gap-1 hover:text-brand-600">
                <Phone className="h-4 w-4" /> {s.candidate.phone}
              </a>
            )}
            {s.candidate.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-4 w-4" /> {s.candidate.location}
              </span>
            )}
          </div>
        </div>
        {cvActions && <div className="flex flex-col gap-2 sm:flex-row sm:shrink-0">{cvActions}</div>}
      </div>

      {s.note && <Card className="mt-4 border-brand-100 bg-brand-50 p-4 text-sm text-slate-700">“{s.note}”</Card>}

      <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
        <ScoreTile label="CV match" value={s.cvMatch?.score} />
        <ScoreTile label="Interview" value={s.interview?.overallScore} />
        <ScoreTile label="Final score" value={s.finalScore} highlight />
      </div>

      {s.interview && (
        <Card className="mt-4 p-4 sm:p-6">
          <h2 className="mb-2 font-semibold text-slate-900">Interview evaluation</h2>
          <p className="text-sm text-slate-600">{s.interview.reasoning}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:max-w-sm">
            <ScoreTile label="Technical" value={s.interview.technicalScore} />
            <ScoreTile label="Communication" value={s.interview.communicationScore} />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <List title="Strengths" items={s.interview.strengths} tone="green" />
            <List title="Areas to probe" items={s.interview.areasForImprovement} />
          </div>

          {s.interview.criteriaAssessment?.length > 0 && (
            <div className="mt-5">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Hiring criteria</h3>
              <ul className="space-y-2">
                {s.interview.criteriaAssessment.map((c, i) => {
                  const [label, cls] = VERDICT[c.verdict] || VERDICT.PARTLY;
                  return (
                    <li key={i} className="rounded-lg border border-slate-100 p-3">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                        <p className="text-sm font-medium text-slate-900">{c.criterion}</p>
                        <span className={`w-fit shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{label}</span>
                      </div>
                      {c.evidence && <p className="mt-1 text-sm text-slate-600">{c.evidence}</p>}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {s.interview.questions?.length > 0 && (
            <div className="mt-5">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Question by question</h3>
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
                {s.interview.questions.map((q, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => setOpenQ(openQ === i ? null : i)}
                      className="flex min-h-[48px] w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
                      aria-expanded={openQ === i}
                    >
                      {openQ === i ? <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />}
                      <span className="min-w-0 flex-1 text-slate-800">{q.question}</span>
                      {q.score != null && <span className="shrink-0 text-xs font-semibold text-slate-600">{Math.round(q.score)}</span>}
                    </button>
                    {openQ === i && (
                      <div className="space-y-1 px-9 pb-3 text-sm text-slate-600">
                        {q.answerSummary && (
                          <p>
                            <span className="font-medium text-slate-700">Answer: </span>
                            {q.answerSummary}
                          </p>
                        )}
                        {q.evaluation && (
                          <p>
                            <span className="font-medium text-slate-700">Evaluation: </span>
                            {q.evaluation}
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {s.cvMatch && (
        <Card className="mt-4 p-4 sm:p-6">
          <h2 className="mb-2 font-semibold text-slate-900">CV match</h2>
          {s.cvMatch.reasoning && <p className="text-sm text-slate-600">{s.cvMatch.reasoning}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {(s.cvMatch.matchedSkills || []).map((k) => (
              <span key={k} className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                {k}
              </span>
            ))}
            {(s.cvMatch.missingSkills || []).map((k) => (
              <span key={k} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                {k} (not shown)
              </span>
            ))}
          </div>
        </Card>
      )}

      {footer}
    </div>
  );
}
