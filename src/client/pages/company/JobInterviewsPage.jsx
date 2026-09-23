import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Plus, Calendar, Trash2, CheckCircle2, Sparkles, X, Bot, Eye, Save, ArrowLeft } from 'lucide-react';
import { schedulingApi } from '../../services/scheduling.js';
import { jobsApi } from '../../services/jobs.js';
import { interviewsApi } from '../../services/interviews.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import FormField, { inputClass } from '../../components/ui/FormField.jsx';
import LoadingState from '../../components/ui/LoadingState.jsx';
import ErrorState from '../../components/ui/ErrorState.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';

const GENERATE_DEFAULTS = { date: '', startTime: '', endTime: '', durationMinutes: 15, bufferMinutes: 0 };
const VOICE_LABELS = { FEMALE: 'Female', MALE: 'Male', NEUTRAL: 'Neutral' };

// A custom question is a full sentence, not a short tag — a dedicated
// add/remove list reads better here than the chip-style TagInput used for
// skills elsewhere.
//
// `maxQuestions` is (Number of questions - 1): one slot is always reserved
// for the closing "any questions for us?" turn, so that's the most custom
// questions that can ever all be asked. Enforced here (not just on save) so
// the company sees the limit while typing, not after a rejected submit.
function CustomQuestionList({ questions, onChange, maxQuestions }) {
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
    </div>
  );
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}
function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// The form only has one date field shared by both start and end time, so
// typing an end time that reads as "until midnight" (00:00) — or any other
// overnight range — is naturally earlier than the start time on that same
// calendar date. Roll the end time onto the next day whenever that happens,
// rather than making the user split it across two range submissions.
function resolveTimeRange(date, startTime, endTime) {
  const start = new Date(`${date}T${startTime}`);
  let end = new Date(`${date}T${endTime}`);
  if (end <= start) end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export default function JobInterviewsPage() {
  const { id: jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [slots, setSlots] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ date: '', startTime: '', endTime: '' });
  const [creating, setCreating] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [completingId, setCompletingId] = useState(null);

  const [showGenerate, setShowGenerate] = useState(false);
  const [generateForm, setGenerateForm] = useState(GENERATE_DEFAULTS);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const [generateResult, setGenerateResult] = useState(null);

  const [showConfig, setShowConfig] = useState(false);
  const [configForm, setConfigForm] = useState(null);
  const [configSaving, setConfigSaving] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);

  const load = () => {
    setError('');
    Promise.all([jobsApi.get(jobId), schedulingApi.listSlotsForJob(jobId), interviewsApi.getConfig(jobId)])
      .then(([jobRes, slotsRes, configRes]) => {
        setJob(jobRes.job);
        setSlots(slotsRes.slots);
        setConfigForm({
          aiName: configRes.config.aiName,
          aiTitle: configRes.config.aiTitle,
          questionCount: configRes.config.questionCount,
          answerTimeSeconds: configRes.config.answerTimeSeconds,
          customQuestions: configRes.config.customQuestions,
          voiceGender: configRes.config.voiceGender || 'FEMALE',
        });
      })
      .catch((err) => setError(err.message));
  };

  useEffect(load, [jobId]);

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setConfigSaving(true);
    setConfigSaved(false);
    setError('');
    try {
      await interviewsApi.upsertConfig(jobId, {
        ...configForm,
        questionCount: Number(configForm.questionCount),
        answerTimeSeconds: Number(configForm.answerTimeSeconds),
      });
      setConfigSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setConfigSaving(false);
    }
  };

  const handleCreateSlot = async (e) => {
    e.preventDefault();
    if (!form.date || !form.startTime || !form.endTime) return;
    setCreating(true);
    setError('');
    try {
      const { start, end } = resolveTimeRange(form.date, form.startTime, form.endTime);
      await schedulingApi.createSlots(jobId, [{ startTime: start.toISOString(), endTime: end.toISOString() }]);
      setForm({ date: '', startTime: '', endTime: '' });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleGenerateSlots = async (e) => {
    e.preventDefault();
    const { date, startTime, endTime, durationMinutes, bufferMinutes } = generateForm;
    if (!date || !startTime || !endTime) return;
    setGenerating(true);
    setGenerateError('');
    setGenerateResult(null);
    try {
      const { start, end } = resolveTimeRange(date, startTime, endTime);
      const result = await schedulingApi.generateSlots(jobId, {
        rangeStart: start.toISOString(),
        rangeEnd: end.toISOString(),
        durationMinutes: Number(durationMinutes),
        bufferMinutes: Number(bufferMinutes) || 0,
      });
      setGenerateResult(result);
      setGenerateForm(GENERATE_DEFAULTS);
      load();
    } catch (err) {
      setGenerateError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleCancelSlot = async () => {
    setCancelling(true);
    setError('');
    try {
      await schedulingApi.cancelSlot(jobId, confirmCancel);
      setConfirmCancel(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCancelling(false);
    }
  };

  const handleMarkCompleted = async (interviewId) => {
    setCompletingId(interviewId);
    setError('');
    try {
      await schedulingApi.markInterviewCompleted(jobId, interviewId);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCompletingId(null);
    }
  };

  const sortedSlots = useMemo(() => (slots ? [...slots].sort((a, b) => new Date(a.startTime) - new Date(b.startTime)) : []), [slots]);

  if (error && !slots) return <ErrorState message={error} onRetry={load} />;
  if (!slots || !job || !configForm) return <LoadingState />;

  return (
    <div>
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <h2 className="mb-1 text-xl font-semibold text-slate-900">Interviews — {job.title}</h2>
      <p className="mb-6 text-sm text-slate-500">Configure the AI interviewer, publish slots, and review completed interviews.</p>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

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
          <Button variant={showConfig ? 'secondary' : 'primary'} onClick={() => setShowConfig((v) => !v)} className="w-full sm:w-auto">
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
              <FormField label="AI interviewer name">
                <input
                  required
                  className={inputClass}
                  value={configForm.aiName}
                  onChange={(e) => setConfigForm({ ...configForm, aiName: e.target.value })}
                  placeholder="e.g. Priya"
                />
              </FormField>
              <FormField label="AI role / title">
                <input
                  required
                  className={inputClass}
                  value={configForm.aiTitle}
                  onChange={(e) => setConfigForm({ ...configForm, aiTitle: e.target.value })}
                  placeholder="e.g. Virtual HR"
                />
              </FormField>
              <FormField label="Number of questions">
                <input
                  type="number"
                  min={3}
                  max={30}
                  required
                  className={inputClass}
                  value={configForm.questionCount}
                  onChange={(e) => setConfigForm({ ...configForm, questionCount: e.target.value })}
                />
              </FormField>
              <FormField label="Answer time per question (seconds)">
                <input
                  type="number"
                  min={10}
                  max={300}
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
              />
              <p className="mt-1 text-xs text-slate-400">
                The AI also generates its own questions from the job requirements, the candidate's resume, and their
                previous answers — these are asked in addition to that.
              </p>
            </div>

            {configSaved && <p className="mt-3 text-sm text-emerald-600">AI interviewer settings saved.</p>}
            <Button type="submit" loading={configSaving} className="mt-4 w-full sm:w-auto">
              <Save className="h-4 w-4" /> Save AI interviewer settings
            </Button>
          </form>
        )}
      </Card>

      <Card className="mb-6 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold text-slate-900">Create AI Interview Slots</h3>
            <p className="text-sm text-slate-500">Pick a time range and interview length — every slot in between is generated for you.</p>
          </div>
          <Button
            variant={showGenerate ? 'secondary' : 'primary'}
            onClick={() => setShowGenerate((v) => !v)}
            className="w-full sm:w-auto"
          >
            {showGenerate ? (
              <>
                <X className="h-4 w-4" /> Close
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Create AI Interview Slots
              </>
            )}
          </Button>
        </div>

        {showGenerate && (
          <form onSubmit={handleGenerateSlots} className="mt-5 border-t border-slate-100 pt-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
              <FormField label="Date">
                <input
                  type="date"
                  required
                  className={inputClass}
                  value={generateForm.date}
                  onChange={(e) => setGenerateForm({ ...generateForm, date: e.target.value })}
                />
              </FormField>
              <FormField label="Start time">
                <input
                  type="time"
                  required
                  className={inputClass}
                  value={generateForm.startTime}
                  onChange={(e) => setGenerateForm({ ...generateForm, startTime: e.target.value })}
                />
              </FormField>
              <FormField label="End time">
                <input
                  type="time"
                  required
                  className={inputClass}
                  value={generateForm.endTime}
                  onChange={(e) => setGenerateForm({ ...generateForm, endTime: e.target.value })}
                />
              </FormField>
              <FormField label="Duration (minutes)">
                <input
                  type="number"
                  min={5}
                  max={240}
                  required
                  className={inputClass}
                  value={generateForm.durationMinutes}
                  onChange={(e) => setGenerateForm({ ...generateForm, durationMinutes: e.target.value })}
                />
              </FormField>
              <FormField label="Buffer (minutes, optional)">
                <input
                  type="number"
                  min={0}
                  max={120}
                  className={inputClass}
                  value={generateForm.bufferMinutes}
                  onChange={(e) => setGenerateForm({ ...generateForm, bufferMinutes: e.target.value })}
                />
              </FormField>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              An end time at or before the start time (e.g. midnight, 00:00) is treated as the next day.
            </p>

            {generateError && <p className="mt-3 text-sm text-red-600">{generateError}</p>}
            {generateResult && (
              <p className="mt-3 text-sm text-emerald-600">
                Created {generateResult.slots.length} slot{generateResult.slots.length === 1 ? '' : 's'}
                {generateResult.skippedCount > 0
                  ? ` (skipped ${generateResult.skippedCount} that overlapped existing slots)`
                  : ''}
                .
              </p>
            )}

            <Button type="submit" loading={generating} className="mt-4 w-full sm:w-auto">
              <Sparkles className="h-4 w-4" /> Generate slots
            </Button>
          </form>
        )}
      </Card>

      <Card className="mb-6 p-5">
        <h3 className="mb-3 font-semibold text-slate-900">Add a single slot</h3>
        <form onSubmit={handleCreateSlot} className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end">
          <FormField label="Date">
            <input
              type="date"
              required
              className={inputClass}
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </FormField>
          <FormField label="Start time">
            <input
              type="time"
              required
              className={inputClass}
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
            />
          </FormField>
          <FormField label="End time">
            <input
              type="time"
              required
              className={inputClass}
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
            />
          </FormField>
          <div className="sm:col-span-3">
            <Button type="submit" loading={creating} className="w-full sm:w-auto">
              <Plus className="h-4 w-4" /> Add slot
            </Button>
          </div>
        </form>
      </Card>

      <h3 className="mb-3 font-semibold text-slate-900">Available Slots</h3>
      {sortedSlots.length === 0 ? (
        <EmptyState icon={Calendar} title="No interview slots yet" description="Add a slot above to let shortlisted candidates book an interview." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Candidate</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedSlots.map((slot) => {
                const interview = slot.interviews?.[0];
                return (
                  <tr key={slot.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-900">{formatDate(slot.startTime)}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatTime(slot.startTime)} – {formatTime(slot.endTime)}
                    </td>
                    <td className="px-4 py-3 text-slate-900">{interview?.application?.candidate?.fullName || '—'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={interview ? interview.status : slot.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-3">
                        {interview && ['IN_PROGRESS', 'COMPLETED'].includes(interview.status) && (
                          <Link
                            to={`/company/jobs/${jobId}/interviews/${interview.id}`}
                            className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-700"
                          >
                            <Eye className="h-4 w-4" /> View
                          </Link>
                        )}
                        {interview?.status === 'SCHEDULED' && (
                          <button
                            onClick={() => handleMarkCompleted(interview.id)}
                            disabled={completingId === interview.id}
                            className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
                            title="For a human-conducted interview — the AI interview marks itself complete automatically."
                          >
                            <CheckCircle2 className="h-4 w-4" /> Mark completed
                          </button>
                        )}
                        {slot.status !== 'CANCELLED' && (
                          <button
                            onClick={() => setConfirmCancel(slot.id)}
                            className="inline-flex items-center gap-1 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" /> Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <ConfirmDialog
        open={confirmCancel !== null}
        title="Cancel this slot?"
        description="If a candidate has booked it, their interview will be cancelled and they'll be able to book a different slot."
        confirmLabel="Cancel slot"
        onConfirm={handleCancelSlot}
        onCancel={() => setConfirmCancel(null)}
        loading={cancelling}
      />
    </div>
  );
}
