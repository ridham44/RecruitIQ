import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { X, Bot, Eye, Save, ArrowLeft } from 'lucide-react';
import { jobsApi } from '../../services/jobs.js';
import { interviewsApi } from '../../services/interviews.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import FormField, { inputClass } from '../../components/ui/FormField.jsx';
import LoadingState from '../../components/ui/LoadingState.jsx';
import ErrorState from '../../components/ui/ErrorState.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import RecqShareCard from './RecqShareCard.jsx';
import TagInput from '../../components/ui/TagInput.jsx';
import { upsertInterviewConfigSchema } from '../../../shared/schemas/interview.schema.js';
import { checkForm } from '../../../shared/schemas/common.js';

const VOICE_LABELS = { FEMALE: 'Female', MALE: 'Male', NEUTRAL: 'Neutral' };

// A custom question is a full sentence, not a short tag — a dedicated
// add/remove list reads better here than the chip-style TagInput used for
// skills elsewhere.
//
// `maxQuestions` is (Number of questions - 1): one slot is always reserved
// for the closing "any questions for us?" turn, so that's the most custom
// questions that can ever all be asked. Enforced here (not just on save) so
// the company sees the limit while typing, not after a rejected submit.
function CustomQuestionList({ questions, onChange, maxQuestions, error }) {
  const [draft, setDraft] = useState('');
  const atLimit = questions.length >= maxQuestions;

  const add = () => {
    const q = draft.trim();
    if (q && !atLimit) onChange([...questions, q]);
    setDraft('');
  };

  return (
    <div>
      {questions.length > 0 && (
        <ul className="mb-2 space-y-2">
          {questions.map((q, idx) => (
            <li key={idx} className="flex items-start gap-2 rounded-lg border border-slate-200 p-2 text-sm">
              <span className="flex-1 text-slate-700">{q}</span>
              <button
                type="button"
                onClick={() => onChange(questions.filter((_, i) => i !== idx))}
                className="text-slate-400 hover:text-red-600"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          className={inputClass}
          maxLength={500}
          aria-invalid={error ? true : undefined}
          aria-label="New custom question"
          placeholder={atLimit ? 'Maximum custom questions reached' : 'Type a question the AI must ask, then press Add'}
          value={draft}
          disabled={atLimit}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" variant="secondary" onClick={add} disabled={atLimit}>
          Add
        </Button>
      </div>
      <p className={`mt-1 text-xs ${atLimit ? 'font-medium text-amber-600' : 'text-slate-400'}`}>
        {questions.length}/{maxQuestions} used
        {atLimit ? ' — increase "Number of questions" to add more.' : ''}
      </p>
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

// First error for a field, including nested ones like "customQuestions.2".
function errorFor(errors, key) {
  if (errors[key]) return errors[key];
  const hit = Object.keys(errors).find((p) => p.startsWith(`${key}.`));
  return hit ? errors[hit] : undefined;
}

export default function JobInterviewsPage() {
  const { id: jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  // Build plan P9: this job's interviews (no slots — candidates interview any
  // time inside the window).
  const [interviews, setInterviews] = useState(null);
  const [error, setError] = useState('');

  const [showConfig, setShowConfig] = useState(false);
  const [configForm, setConfigForm] = useState(null);
  const [configSaving, setConfigSaving] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const [configErrors, setConfigErrors] = useState({});
  const [configError, setConfigError] = useState('');

  const load = () => {
    setError('');
    Promise.all([jobsApi.get(jobId), interviewsApi.listForJob(jobId), interviewsApi.getConfig(jobId)])
      .then(([jobRes, interviewsRes, configRes]) => {
        setJob(jobRes.job);
        setInterviews(interviewsRes.interviews || []);
        setConfigForm({
          aiName: configRes.config.aiName,
          aiTitle: configRes.config.aiTitle,
          questionCount: configRes.config.questionCount,
          answerTimeSeconds: configRes.config.answerTimeSeconds,
          customQuestions: configRes.config.customQuestions,
          voiceGender: configRes.config.voiceGender || 'FEMALE',
          // Build plan P6
          interviewInstructions: configRes.config.interviewInstructions || '',
          evaluationInstructions: configRes.config.evaluationInstructions || '',
          focusSkills: configRes.config.focusSkills || [],
        });
      })
      .catch((err) => setError(err.message));
  };

  useEffect(load, [jobId]);

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setConfigSaved(false);
    setConfigError('');
    const { data, errors } = checkForm(upsertInterviewConfigSchema, {
      ...configForm,
      questionCount: Number(configForm.questionCount),
      answerTimeSeconds: Number(configForm.answerTimeSeconds),
    });
    setConfigErrors(errors);
    if (!data) return setConfigError('Please fix the highlighted fields');
    setConfigSaving(true);
    try {
      await interviewsApi.upsertConfig(jobId, data);
      setConfigSaved(true);
    } catch (err) {
      const fields = err.fields || {};
      setConfigErrors(fields);
      setConfigError(Object.keys(fields).length ? 'Please fix the highlighted fields' : err.message);
    } finally {
      setConfigSaving(false);
    }
  };

  if (error && !job) return <ErrorState message={error} onRetry={load} />;
  if (!interviews || !job || !configForm) return <LoadingState />;

  return (
    <div>
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <h2 className="mb-1 text-xl font-semibold text-slate-900">Interviews — {job.title}</h2>
      <p className="mb-6 text-sm text-slate-500">Share the candidate links, set the interview window and configure the AI interviewer.</p>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {/* Build plan P9 — /recq share links + interview window */}
      <RecqShareCard job={job} onSaved={setJob} />

      <Card className="mb-6 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 font-semibold text-slate-900">
              <Bot className="h-4 w-4 text-brand-600" /> AI Interviewer Configuration
            </h3>
            <p className="text-sm text-slate-500">
              {configForm.aiName} – {configForm.aiTitle} · {configForm.questionCount} questions · {configForm.answerTimeSeconds}s per answer ·{' '}
              {VOICE_LABELS[configForm.voiceGender] || 'Default'} voice
            </p>
          </div>
          <Button variant={showConfig ? 'secondary' : 'primary'} onClick={() => {
              setConfigErrors({});
              setConfigError('');
              setShowConfig((v) => !v);
            }} className="w-full sm:w-auto">
            {showConfig ? (
              <>
                <X className="h-4 w-4" /> Close
              </>
            ) : (
              <>
                <Bot className="h-4 w-4" /> Configure AI Interviewer
              </>
            )}
          </Button>
        </div>

        {showConfig && (
          <form onSubmit={handleSaveConfig} className="mt-5 border-t border-slate-100 pt-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="AI interviewer name" error={configErrors.aiName}>
                <input
                  required
                  maxLength={60}
                  className={inputClass}
                  value={configForm.aiName}
                  onChange={(e) => setConfigForm({ ...configForm, aiName: e.target.value })}
                  placeholder="e.g. Priya"
                />
              </FormField>
              <FormField label="AI role / title" error={configErrors.aiTitle}>
                <input
                  required
                  maxLength={80}
                  className={inputClass}
                  value={configForm.aiTitle}
                  onChange={(e) => setConfigForm({ ...configForm, aiTitle: e.target.value })}
                  placeholder="e.g. Virtual HR"
                />
              </FormField>
              <FormField label="Number of questions" error={configErrors.questionCount} hint="3–30">
                <input
                  type="number"
                  min={3}
                  max={30}
                  step={1}
                  required
                  className={inputClass}
                  value={configForm.questionCount}
                  onChange={(e) => setConfigForm({ ...configForm, questionCount: e.target.value })}
                />
              </FormField>
              <FormField label="Answer time per question (seconds)" error={configErrors.answerTimeSeconds} hint="10–300 seconds">
                <input
                  type="number"
                  min={10}
                  max={300}
                  step={1}
                  required
                  className={inputClass}
                  value={configForm.answerTimeSeconds}
                  onChange={(e) => setConfigForm({ ...configForm, answerTimeSeconds: e.target.value })}
                />
              </FormField>
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-slate-700">AI interviewer voice</label>
              <div className="flex gap-2">
                {[
                  { value: 'FEMALE', label: 'Female voice' },
                  { value: 'MALE', label: 'Male voice' },
                  { value: 'NEUTRAL', label: 'Neutral / default' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setConfigForm({ ...configForm, voiceGender: opt.value })}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      configForm.voiceGender === opt.value
                        ? 'border-brand-600 bg-brand-50 text-brand-700'
                        : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Best-effort — the candidate's browser picks the closest matching voice it has installed; exact voice
                availability varies by device.
              </p>
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Custom questions the AI must ask
              </label>
              <CustomQuestionList
                questions={configForm.customQuestions}
                onChange={(customQuestions) => setConfigForm({ ...configForm, customQuestions })}
                maxQuestions={Math.max(0, Number(configForm.questionCount) - 1)}
                error={errorFor(configErrors, 'customQuestions')}
              />
              <p className="mt-1 text-xs text-slate-400">
                The AI also generates its own questions from the job requirements, the candidate's resume, and their
                previous answers — these are asked in addition to that.
              </p>
            </div>

            {/* Build plan P6 (§10, §11): recruiter guidance for the AI */}
            <div className="mt-6 border-t border-slate-100 pt-5">
              <p className="text-sm font-semibold text-slate-900">Guidance for the AI (optional)</p>
              <p className="mb-3 text-xs text-slate-500">
                Leave these empty to keep the AI's default behaviour. Anything about age, gender, religion or other personal
                characteristics is removed automatically.
              </p>

              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="interviewInstructions">
                What should the AI check in the interview?
              </label>
              <textarea
                id="interviewInstructions"
                rows={3}
                maxLength={2000}
                aria-invalid={configErrors.interviewInstructions ? true : undefined}
                className={inputClass}
                value={configForm.interviewInstructions}
                onChange={(e) => setConfigForm({ ...configForm, interviewInstructions: e.target.value })}
                placeholder="e.g. Check hands-on experience with Kubernetes; ask about a production incident they handled."
              />
              {configErrors.interviewInstructions && (
                <p role="alert" className="mt-1 text-xs text-red-600">{configErrors.interviewInstructions}</p>
              )}
              <p className="mt-1 text-right text-xs text-slate-400">{configForm.interviewInstructions.length}/2000</p>

              <label className="mb-1 mt-2 block text-sm font-medium text-slate-700">Must-cover skills</label>
              <TagInput
                value={configForm.focusSkills}
                onChange={(focusSkills) => setConfigForm({ ...configForm, focusSkills: focusSkills.slice(0, 20) })}
                placeholder="Type a skill and press Enter (e.g. Kubernetes, SQL)"
              />
              {errorFor(configErrors, 'focusSkills') && (
                <p role="alert" className="mt-1 text-xs text-red-600">{errorFor(configErrors, 'focusSkills')}</p>
              )}

              <label className="mb-1 mt-4 block text-sm font-medium text-slate-700" htmlFor="evaluationInstructions">
                How should the AI score the interview?
              </label>
              <textarea
                id="evaluationInstructions"
                rows={3}
                maxLength={2000}
                aria-invalid={configErrors.evaluationInstructions ? true : undefined}
                className={inputClass}
                value={configForm.evaluationInstructions}
                onChange={(e) => setConfigForm({ ...configForm, evaluationInstructions: e.target.value })}
                placeholder="e.g. System design counts double; communication must be at least 6/10."
              />
              {configErrors.evaluationInstructions && (
                <p role="alert" className="mt-1 text-xs text-red-600">{configErrors.evaluationInstructions}</p>
              )}
              <p className="mt-1 text-right text-xs text-slate-400">{configForm.evaluationInstructions.length}/2000</p>
              <p className="text-xs text-slate-400">
                When set, each report also lists these criteria as Met / Partly / Not met, with evidence from the answers.
              </p>
            </div>

            {configError && <p className="mt-3 text-sm text-red-600">{configError}</p>}
            {configSaved && <p className="mt-3 text-sm text-emerald-600">AI interviewer settings saved.</p>}
            <Button type="submit" loading={configSaving} className="mt-4 w-full sm:w-auto">
              <Save className="h-4 w-4" /> Save AI interviewer settings
            </Button>
          </form>
        )}
      </Card>

      {/* Build plan P9: candidates take the interview any time inside the
          interview window, so there are no slots to publish — just the list. */}
      <h3 className="mb-3 font-semibold text-slate-900">Interviews</h3>
      {interviews.length === 0 ? (
        <EmptyState icon={Bot} title="No interviews yet" description="Candidates who pass the resume match and verify their email appear here with their interview." />
      ) : (
        <Card className="divide-y divide-slate-100">
          {interviews.map((i) => (
            <div key={i.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900">{i.application?.candidate?.fullName || 'Candidate'}</p>
                <p className="text-xs text-slate-500">
                  {i.endedAt ? `Completed ${formatDate(i.endedAt)}` : i.startedAt ? `Started ${formatDate(i.startedAt)}` : `Link issued ${formatDate(i.createdAt)}`}
                  {i.round > 1 ? ` · Round ${i.round}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                {i.report?.overallScore != null && <span className="font-semibold text-slate-700">{Math.round(i.report.overallScore)}/100</span>}
                <StatusBadge status={i.status} />
                {['IN_PROGRESS', 'COMPLETED'].includes(i.status) && (
                  <Link to={`/company/jobs/${jobId}/interviews/${i.id}`} className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-700">
                    <Eye className="h-4 w-4" /> View report
                  </Link>
                )}
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
