import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Calendar, Trash2, CheckCircle2, Sparkles, X } from 'lucide-react';
import { schedulingApi } from '../../services/scheduling.js';
import { jobsApi } from '../../services/jobs.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import FormField, { inputClass } from '../../components/ui/FormField.jsx';
import LoadingState from '../../components/ui/LoadingState.jsx';
import ErrorState from '../../components/ui/ErrorState.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';

const GENERATE_DEFAULTS = { date: '', startTime: '', endTime: '', durationMinutes: 15, bufferMinutes: 0 };

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}
function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function JobInterviewsPage() {
  const { id: jobId } = useParams();
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

  const load = () => {
    setError('');
    Promise.all([jobsApi.get(jobId), schedulingApi.listSlotsForJob(jobId)])
      .then(([jobRes, slotsRes]) => {
        setJob(jobRes.job);
        setSlots(slotsRes.slots);
      })
      .catch((err) => setError(err.message));
  };

  useEffect(load, [jobId]);

  const handleCreateSlot = async (e) => {
    e.preventDefault();
    if (!form.date || !form.startTime || !form.endTime) return;
    setCreating(true);
    setError('');
    try {
      const startTime = new Date(`${form.date}T${form.startTime}`).toISOString();
      const endTime = new Date(`${form.date}T${form.endTime}`).toISOString();
      await schedulingApi.createSlots(jobId, [{ startTime, endTime }]);
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
      const rangeStart = new Date(`${date}T${startTime}`).toISOString();
      const rangeEnd = new Date(`${date}T${endTime}`).toISOString();
      const result = await schedulingApi.generateSlots(jobId, {
        rangeStart,
        rangeEnd,
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
  if (!slots || !job) return <LoadingState />;

  return (
    <div>
      <h2 className="mb-1 text-xl font-semibold text-slate-900">Interviews — {job.title}</h2>
      <p className="mb-6 text-sm text-slate-500">Create available interview slots; candidates book them once shortlisted.</p>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

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
                        {interview?.status === 'SCHEDULED' && (
                          <button
                            onClick={() => handleMarkCompleted(interview.id)}
                            disabled={completingId === interview.id}
                            className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
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
