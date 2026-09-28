import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, CalendarCheck, Clock, Video, Info, Bot } from 'lucide-react';
import { applicationsApi } from '../../services/applications.js';
import { schedulingApi } from '../../services/scheduling.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import LoadingState from '../../components/ui/LoadingState.jsx';
import ErrorState from '../../components/ui/ErrorState.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import ScoreRing from '../../components/ui/ScoreRing.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';

const STEPS = ['APPLIED', 'SCREENING', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED'];

// TEMP (testing): always joinable regardless of slot window. Restore the
// startTime/endTime check below before shipping.
function canJoinNow(slot) {
  if (!slot) return false;
  return true;
  // const now = Date.now();
  // return now >= new Date(slot.startTime).getTime() && now <= new Date(slot.endTime).getTime();
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}
function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// Green = open and bookable, grey = already booked (by anyone) and
// unselectable — cancelled slots are excluded by the API entirely.
function SlotGrid({ slots, bookingSlotId, onSelect }) {
  if (slots.length === 0) {
    return <EmptyState icon={Clock} title="No slots available yet" description="Check back soon — the company hasn't published interview times yet." />;
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {slots.map((slot) => {
        const isAvailable = slot.status === 'AVAILABLE';
        return (
          <div
            key={slot.id}
            className={`flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between ${
              isAvailable ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50 opacity-60'
            }`}
          >
            <div>
              <p className="text-sm font-medium text-slate-900">{formatDate(slot.startTime)}</p>
              <p className="text-sm text-slate-500">
                {formatTime(slot.startTime)} – {formatTime(slot.endTime)}
              </p>
            </div>
            {isAvailable ? (
              <Button
                variant="secondary"
                onClick={() => onSelect(slot.id)}
                loading={bookingSlotId === slot.id}
                className="w-full sm:w-auto"
              >
                Book Interview
              </Button>
            ) : (
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Booked</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ApplicationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [application, setApplication] = useState(null);
  const [interview, setInterview] = useState(null);
  const [error, setError] = useState('');

  const [showSlotPicker, setShowSlotPicker] = useState(false);
  const [slots, setSlots] = useState(null);
  const [slotsError, setSlotsError] = useState('');
  const [bookingSlotId, setBookingSlotId] = useState(null);
  const [confirmReschedule, setConfirmReschedule] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = () => {
    setError('');
    Promise.all([applicationsApi.getMine(id), schedulingApi.getInterview(id)])
      .then(([appData, interviewData]) => {
        setApplication(appData.application);
        setInterview(interviewData.interview);
      })
      .catch((err) => setError(err.message));
  };

  useEffect(load, [id]);

  // Eligible candidates (shortlisted, no interview booked yet) see the
  // available slots immediately — no extra click needed to "unlock" them.
  useEffect(() => {
    if (application?.status === 'SHORTLISTED' && !interview && !showSlotPicker) {
      openSlotPicker();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [application?.status, interview]);

  // Re-checked every 30s so the "Join Interview" button enables itself
  // right at the scheduled time without the candidate needing to refresh.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const openSlotPicker = () => {
    setShowSlotPicker(true);
    setSlotsError('');
    setSlots(null);
    schedulingApi
      .listAvailableSlots(id)
      .then((data) => setSlots(data.slots))
      .catch((err) => setSlotsError(err.message));
  };

  const handleBookSlot = async (slotId) => {
    setBookingSlotId(slotId);
    setSlotsError('');
    try {
      await schedulingApi.bookSlot(id, slotId);
      setShowSlotPicker(false);
      load();
    } catch (err) {
      setSlotsError(err.message);
    } finally {
      setBookingSlotId(null);
    }
  };

  const handleReschedule = async () => {
    setRescheduling(true);
    try {
      await schedulingApi.cancelMyInterview(id);
      setConfirmReschedule(false);
      load();
      openSlotPicker();
    } catch (err) {
      setError(err.message);
    } finally {
      setRescheduling(false);
    }
  };

  const sortedSlots = useMemo(() => (slots ? [...slots].sort((a, b) => new Date(a.startTime) - new Date(b.startTime)) : []), [slots]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!application) return <LoadingState />;

  const { job, resume, screeningResult: result, status } = application;
  const isRejected = status === 'REJECTED';
  const currentStepIndex = STEPS.indexOf(status);
  // canJoinNow reads the live clock directly; `now` state just forces this
  // component to re-render every 30s so the button flips on/off without a
  // page refresh once the slot's start/end time is crossed.
  const joinable = interview?.status === 'SCHEDULED' && canJoinNow(interview.slot);

  return (
    <div className="mx-auto max-w-2xl">
      <button onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900">{job.title}</h2>
        <p className="text-sm text-slate-500">
          <Link to={`/candidate/jobs/${job.id}`} className="hover:text-brand-600">
            {job.company.name}
          </Link>
        </p>
      </div>

      <Card className="mb-6 p-6">
        <h3 className="mb-4 font-semibold text-slate-900">Application status</h3>
        {isRejected ? (
          <StatusBadge status="REJECTED" />
        ) : (
          <div className="flex items-center">
            {STEPS.map((step, idx) => (
              <div key={step} className="flex flex-1 items-center">
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold sm:h-8 sm:w-8 ${
                    idx <= currentStepIndex ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {idx + 1}
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`h-0.5 flex-1 ${idx < currentStepIndex ? 'bg-brand-600' : 'bg-slate-100'}`} />
                )}
              </div>
            ))}
          </div>
        )}
        <div className="mt-3">
          <StatusBadge status={status} />
        </div>
      </Card>

      {result?.status === 'COMPLETED' && (
        <Card className="mb-6 p-6">
          <div className="flex items-center gap-4">
            <ScoreRing score={result.overallScore} size={56} />
            <div>
              <p className="font-semibold text-slate-900">Your match score</p>
              <p className="text-sm text-slate-500">Based on skills, experience, and education alignment</p>
            </div>
          </div>
        </Card>
      )}

      {/* Not shortlisted yet — explain why there's nothing to schedule, rather than showing nothing */}
      {!isRejected && !interview && !['SHORTLISTED', 'INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED'].includes(status) && (
        <Card className="mb-6 flex items-start gap-3 p-6">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
          <div>
            <h3 className="font-semibold text-slate-900">Interview scheduling isn't open yet</h3>
            <p className="mt-1 text-sm text-slate-500">
              You'll be able to pick an interview slot as soon as the company shortlists your application.
            </p>
          </div>
        </Card>
      )}

      {/* Shortlisted, no interview booked yet — AI interview ready to schedule */}
      {status === 'SHORTLISTED' && !interview && (
        <Card className="mb-6 p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-brand-50 p-2.5">
              <Bot className="h-5 w-5 text-brand-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">
                AI Interview{application.aiInterviewConfig?.aiName ? ` — ${application.aiInterviewConfig.aiName}` : ''}
                {application.aiInterviewConfig?.aiTitle ? `, ${application.aiInterviewConfig.aiTitle}` : ''}
              </h3>
              <p className="text-sm text-slate-500">Your AI interview is ready to schedule — pick any available slot below.</p>
            </div>
          </div>

          <div className="mt-5 border-t border-slate-100 pt-5">
            {slotsError && <p className="mb-3 text-sm text-red-600">{slotsError}</p>}
            {!slots ? <LoadingState label="Loading available slots…" /> : <SlotGrid slots={sortedSlots} bookingSlotId={bookingSlotId} onSelect={handleBookSlot} />}
          </div>
        </Card>
      )}

      {/* Booked (or completed) interview */}
      {interview && (
        <Card className="mb-6 p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-blue-50 p-2.5">
              <CalendarCheck className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">
                {interview.status === 'COMPLETED'
                  ? 'Interview completed'
                  : interview.status === 'IN_PROGRESS'
                    ? 'Interview in progress'
                    : 'Interview scheduled'}
              </h3>
              <p className="text-sm text-slate-500">
                {formatDate(interview.slot.startTime)} · {formatTime(interview.slot.startTime)} – {formatTime(interview.slot.endTime)} ·{' '}
                {Math.round((new Date(interview.slot.endTime) - new Date(interview.slot.startTime)) / 60000)} min
              </p>
              {application.aiInterviewConfig?.aiName && (
                <p className="text-xs text-slate-400">
                  With {application.aiInterviewConfig.aiName}
                  {application.aiInterviewConfig.aiTitle ? `, ${application.aiInterviewConfig.aiTitle}` : ''}
                </p>
              )}
            </div>
          </div>

          {(interview.status === 'SCHEDULED' || interview.status === 'IN_PROGRESS') && (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                disabled={interview.status === 'SCHEDULED' && !joinable}
                onClick={() => navigate(`/candidate/interviews/${interview.id}/room`)}
                className="w-full sm:w-auto"
              >
                <Video className="h-4 w-4" /> {interview.status === 'IN_PROGRESS' ? 'Resume Interview' : 'Join Interview'}
              </Button>
              {interview.status === 'SCHEDULED' && (
                <Button variant="secondary" onClick={() => setConfirmReschedule(true)} className="w-full sm:w-auto">
                  Reschedule
                </Button>
              )}
            </div>
          )}
          {interview.status === 'SCHEDULED' && !joinable && (
            <p className="mt-2 text-xs text-slate-400">
              The join button unlocks at {formatTime(interview.slot.startTime)} on {formatDate(interview.slot.startTime)}.
            </p>
          )}

          {showSlotPicker && interview.status === 'SCHEDULED' && (
            <div className="mt-5 border-t border-slate-100 pt-5">
              {slotsError && <p className="mb-3 text-sm text-red-600">{slotsError}</p>}
              {!slots ? <LoadingState label="Loading slots…" /> : <SlotGrid slots={sortedSlots} bookingSlotId={bookingSlotId} onSelect={handleBookSlot} />}
            </div>
          )}
        </Card>
      )}

      <Card className="p-6">
        <h3 className="mb-2 font-semibold text-slate-900">Resume submitted</h3>
        <p className="text-sm text-slate-600">{resume.fileName}</p>
      </Card>

      <ConfirmDialog
        open={confirmReschedule}
        title="Reschedule your interview?"
        description="This will cancel your current slot and let you pick a new one. The company will be notified that your slot is now open again."
        confirmLabel="Reschedule"
        onConfirm={handleReschedule}
        onCancel={() => setConfirmReschedule(false)}
        loading={rescheduling}
      />
    </div>
  );
}
