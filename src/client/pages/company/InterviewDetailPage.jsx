import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ShieldAlert, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import { interviewsApi } from '../../services/interviews.js';
import Card from '../../components/ui/Card.jsx';
import LoadingState from '../../components/ui/LoadingState.jsx';
import ErrorState from '../../components/ui/ErrorState.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import ScoreRing from '../../components/ui/ScoreRing.jsx';

const VOICE_LABELS = { FEMALE: 'Female', MALE: 'Male', NEUTRAL: 'Neutral / default' };
const DIFFICULTY_STYLES = { EASY: 'bg-emerald-50 text-emerald-700', MEDIUM: 'bg-amber-50 text-amber-700', HARD: 'bg-red-50 text-red-700' };

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatDuration(startedAt, endedAt) {
  if (!startedAt || !endedAt) return '—';
  const minutes = Math.round((new Date(endedAt) - new Date(startedAt)) / 60000);
  return `${minutes} min`;
}

export default function InterviewDetailPage() {
  const { interviewId } = useParams();
  const navigate = useNavigate();
  const [interview, setInterview] = useState(null);
  const [error, setError] = useState('');
  const [expandedRaw, setExpandedRaw] = useState({});
  const [expandedScore, setExpandedScore] = useState({});

  const load = () => {
    setError('');
    interviewsApi
      .getDetail(interviewId)
      .then((data) => setInterview(data.interview))
      .catch((err) => setError(err.message));
  };

  useEffect(load, [interviewId]);

  const analysisByQuestion = useMemo(
    () => Object.fromEntries((interview?.report?.questionAnalysis || []).map((a) => [a.questionId, a])),
    [interview]
  );

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!interview) return <LoadingState />;

  const report = interview.report;

  return (
    <div className="mx-auto max-w-3xl">
      <button onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{interview.candidate.fullName}</h2>
          <p className="text-sm text-slate-500">{interview.job.title}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={interview.status} />
          <StatusBadge status={interview.stage} />
        </div>
      </div>

      <Card className="mb-6 grid grid-cols-1 gap-4 p-6 sm:grid-cols-3">
        <div>
          <p className="text-xs text-slate-400">Started</p>
          <p className="text-sm font-medium text-slate-900">{formatDateTime(interview.startedAt)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Ended</p>
          <p className="text-sm font-medium text-slate-900">{formatDateTime(interview.endedAt)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Duration</p>
          <p className="text-sm font-medium text-slate-900">{formatDuration(interview.startedAt, interview.endedAt)}</p>
        </div>
      </Card>

      <Card className="mb-6 p-6">
        <h3 className="mb-4 font-semibold text-slate-900">Interview configuration</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-slate-400">AI interviewer</p>
            <p className="text-sm font-medium text-slate-900">
              {interview.aiName} — {interview.aiTitle}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Voice</p>
            <p className="text-sm font-medium text-slate-900">{VOICE_LABELS[interview.voiceGender] || 'Default'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Questions</p>
            <p className="text-sm font-medium text-slate-900">{interview.questionCount ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Answer time</p>
            <p className="text-sm font-medium text-slate-900">{interview.answerTimeSeconds ? `${interview.answerTimeSeconds}s` : '—'}</p>
          </div>
          {interview.difficultyStrategy && (
            <div>
              <p className="text-xs text-slate-400">Difficulty strategy</p>
              <p className="text-sm font-medium capitalize text-slate-900">{interview.difficultyStrategy.toLowerCase()}</p>
            </div>
          )}
        </div>
      </Card>

      {report && report.status === 'COMPLETED' && (
        <Card className="mb-6 p-6">
          <h3 className="mb-4 font-semibold text-slate-900">AI Interview Report</h3>
          <div className="mb-4 grid grid-cols-3 gap-4 text-center">
            <div>
              <ScoreRing score={report.overallScore} size={56} />
              <p className="mt-1 text-xs text-slate-500">Overall</p>
            </div>
            <div>
              <ScoreRing score={report.technicalScore} size={56} />
              <p className="mt-1 text-xs text-slate-500">Technical</p>
            </div>
            <div>
              <ScoreRing score={report.communicationScore} size={56} />
              <p className="mt-1 text-xs text-slate-500">Communication</p>
            </div>
          </div>

          {report.reasoning && <p className="mb-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">{report.reasoning}</p>}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h4 className="mb-2 text-sm font-semibold text-emerald-700">Strengths</h4>
              {report.strengths?.length ? (
                <ul className="list-inside list-disc text-sm text-slate-600">
                  {report.strengths.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-400">None noted</p>
              )}
            </div>
            <div>
              <h4 className="mb-2 text-sm font-semibold text-amber-700">Areas for improvement</h4>
              {report.areasForImprovement?.length ? (
                <ul className="list-inside list-disc text-sm text-slate-600">
                  {report.areasForImprovement.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-400">None noted</p>
              )}
            </div>
          </div>

          {report.resumeAlignment && (
            <div className="mt-4">
              <h4 className="mb-2 text-sm font-semibold text-slate-900">Resume / job requirement alignment</h4>
              <p className="text-xs text-slate-400">Computed deterministically from required/preferred skills — not LLM-judged.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(report.resumeAlignment.requiredSkillsMatched || []).map((s) => (
                  <span key={s} className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    {s}
                  </span>
                ))}
                {(report.resumeAlignment.requiredSkillsMissing || []).map((s) => (
                  <span key={s} className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                    {s} (missing)
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}
      {report && report.status === 'FAILED' && (
        <Card className="mb-6 p-6">
          <p className="text-sm text-red-600">Report generation failed: {report.errorMessage}</p>
        </Card>
      )}
      {!report && interview.status !== 'COMPLETED' && (
        <Card className="mb-6 p-6">
          <p className="text-sm text-slate-400">The AI report will be generated once the interview is completed.</p>
        </Card>
      )}

      <Card className="mb-6 p-6">
        <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
          <MessageSquare className="h-4 w-4" /> Transcript
        </h3>
        {interview.questions.length === 0 ? (
          <p className="text-sm text-slate-400">The candidate hasn't joined yet.</p>
        ) : (
          <div className="space-y-4">
            {interview.questions.map((q) => {
              const analysis = analysisByQuestion[q.id];
              const displayed = q.answer && (q.answer.correctedTranscript || q.answer.normalizedTranscript || q.answer.transcript);
              const hasDistinctRaw = q.answer && q.answer.rawTranscript && q.answer.rawTranscript !== displayed;
              return (
                <div key={q.id} className={`rounded-lg border p-4 ${q.type === 'FOLLOW_UP' ? 'ml-4 border-slate-100 bg-slate-50' : 'border-slate-200'}`}>
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium capitalize">{q.type.toLowerCase().replace(/_/g, ' ')}</span>
                    <span>{q.stage.toLowerCase().replace(/_/g, ' ')}</span>
                    {q.difficulty && (
                      <span className={`rounded-full px-2 py-0.5 font-medium capitalize ${DIFFICULTY_STYLES[q.difficulty] || 'bg-slate-100 text-slate-600'}`}>
                        {q.difficulty.toLowerCase()}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-slate-900">{q.text}</p>
                  {q.answer ? (
                    <div className="mt-2">
                      {q.answer.timedOut && <p className="text-sm italic text-amber-600">No answer (timed out).</p>}
                      <p className="text-sm text-slate-600">
                        {displayed || <span className="italic text-slate-400">No response given.</span>}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        {q.answer.manuallyCorrected && (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700">Candidate corrected transcription</span>
                        )}
                        {typeof q.answer.sttConfidence === 'number' && (
                          <span className="text-slate-400">STT confidence: {Math.round(q.answer.sttConfidence * 100)}%</span>
                        )}
                        {hasDistinctRaw && (
                          <button
                            type="button"
                            onClick={() => setExpandedRaw((prev) => ({ ...prev, [q.id]: !prev[q.id] }))}
                            className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-700"
                          >
                            {expandedRaw[q.id] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            {expandedRaw[q.id] ? 'Hide raw transcript' : 'Show raw transcript'}
                          </button>
                        )}
                      </div>
                      {expandedRaw[q.id] && <p className="mt-1 rounded bg-slate-50 p-2 text-xs text-slate-500">{q.answer.rawTranscript}</p>}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm italic text-slate-400">Not yet answered</p>
                  )}

                  {analysis && (
                    <div className="mt-2 border-t border-slate-100 pt-2">
                      <button
                        type="button"
                        onClick={() => setExpandedScore((prev) => ({ ...prev, [q.id]: !prev[q.id] }))}
                        className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700"
                      >
                        {expandedScore[q.id] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        {expandedScore[q.id] ? 'Hide score breakdown' : 'Show score breakdown'}
                        {typeof analysis.score === 'number' && (
                          <span className="ml-1 font-semibold text-slate-700">({Math.round(analysis.score)}/100)</span>
                        )}
                      </button>
                      {expandedScore[q.id] && (
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                          {['correctness', 'relevance', 'technicalDepth', 'communication'].map(
                            (key) =>
                              typeof analysis[key] === 'number' && (
                                <div key={key}>
                                  <p className="capitalize text-slate-400">{key.replace(/([A-Z])/g, ' $1')}</p>
                                  <p className="font-medium text-slate-800">{Math.round(analysis[key])}</p>
                                </div>
                              )
                          )}
                          {analysis.missingConcepts?.length > 0 && (
                            <div className="col-span-2 sm:col-span-4">
                              <p className="text-slate-400">Missing concepts</p>
                              <p className="text-slate-700">{analysis.missingConcepts.join(', ')}</p>
                            </div>
                          )}
                          {(analysis.evaluationReason || analysis.notes) && (
                            <p className="col-span-2 text-slate-600 sm:col-span-4">{analysis.evaluationReason || analysis.notes}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
          <ShieldAlert className="h-4 w-4" /> Interview & security events
        </h3>
        {interview.events.length === 0 ? (
          <p className="text-sm text-slate-400">No events recorded.</p>
        ) : (
          <ul className="space-y-1 text-sm text-slate-600">
            {interview.events.map((e) => (
              <li key={e.id} className="flex items-center justify-between border-b border-slate-50 py-1.5 last:border-0">
                <span className="capitalize">{e.type.toLowerCase().replace(/_/g, ' ')}</span>
                <span className="text-xs text-slate-400">{formatDateTime(e.occurredAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
