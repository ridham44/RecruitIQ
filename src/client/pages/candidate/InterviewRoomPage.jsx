import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Room, RoomEvent, Track } from 'livekit-client';
import {
  Bot,
  Camera,
  CameraOff,
  Mic,
  MicOff,
  Send,
  PhoneOff,
  Video,
  Wifi,
  WifiOff,
  AlertTriangle,
  Volume2,
  Pencil,
  CheckCircle2,
} from 'lucide-react';
import { interviewsApi } from '../../services/interviews.js';
import { pickVoiceForGender } from '../../utils/ttsVoice.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import LoadingState from '../../components/ui/LoadingState.jsx';
import ErrorState from '../../components/ui/ErrorState.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';

const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;

const STAGE_LABELS = {
  NOT_STARTED: 'Getting started',
  INTRODUCTION: 'Introduction',
  RESUME_QUESTIONS: 'About your background',
  BASIC_TECHNICAL: 'Technical questions',
  JOB_SPECIFIC: 'Role-specific questions',
  SCENARIO: 'Scenario question',
  BEHAVIORAL: 'Behavioral question',
  CANDIDATE_QUESTIONS: 'Your questions for us',
  END: 'Wrapping up',
};

const UI_STAGE_LABELS = { ASKING: 'Asking', NEXT_QUESTION: 'Next question', PROCESSING: 'Processing', ANSWERING: 'Your turn' };
const UI_STAGE_STYLES = {
  ASKING: 'bg-brand-100 text-brand-700',
  NEXT_QUESTION: 'bg-brand-100 text-brand-700',
  PROCESSING: 'bg-amber-100 text-amber-700',
  ANSWERING: 'bg-emerald-100 text-emerald-700',
};

function logEventSafely(interviewId, type, metadata) {
  interviewsApi.logEvent(interviewId, type, metadata).catch(() => {});
}

// Reads AI question text aloud. Resolves once playback finishes (or
// immediately if the browser has no speech synthesis support), so callers
// can await it before allowing the candidate to start recording — this is
// what keeps the mic from ever picking up the AI's own voice. `voice` is the
// company-configured voice, best-effort matched from the browser's
// available speechSynthesis voices (Section 8) — omitted silently if none.
function speak(text, voice) {
  return new Promise((resolve) => {
    if (!window.speechSynthesis || !text) return resolve();
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    if (voice) utterance.voice = voice;
    utterance.onend = resolve;
    utterance.onerror = resolve;
    window.speechSynthesis.speak(utterance);
  });
}

export default function InterviewRoomPage() {
  const { interviewId } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const roomRef = useRef(null);
  const recognitionRef = useRef(null);
  const transcriptRef = useRef(''); // effective (corrected ?? raw) — what actually gets submitted
  const rawTranscriptRef = useRef(''); // always the unedited STT output
  const manuallyCorrectedRef = useRef(false);

  const [phase, setPhase] = useState('preview'); // preview | connecting | live | ended | error
  const [error, setError] = useState('');
  const [previewStream, setPreviewStream] = useState(null);
  const [cameraOn, setCameraOn] = useState(true);
  const [connectionState, setConnectionState] = useState('disconnected');
  const [question, setQuestion] = useState(null);
  const [stage, setStage] = useState('NOT_STARTED');
  const [aiName, setAiName] = useState('');
  const [aiTitle, setAiTitle] = useState('');
  const [voiceGender, setVoiceGender] = useState('FEMALE');
  const [voices, setVoices] = useState([]);
  const [questionNumber, setQuestionNumber] = useState(null);
  const [totalQuestions, setTotalQuestions] = useState(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [finalTranscript, setFinalTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [correctedTranscript, setCorrectedTranscript] = useState(null);
  const [manuallyCorrected, setManuallyCorrected] = useState(false);
  const [showCorrectionBox, setShowCorrectionBox] = useState(false);
  const [draftCorrection, setDraftCorrection] = useState('');
  const [recording, setRecording] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [sending, setSending] = useState(false);
  const questionStartRef = useRef(null);

  const rawTranscript = `${finalTranscript} ${interimTranscript}`.trim();
  const effectiveTranscript = correctedTranscript ?? rawTranscript;
  const uiStage =
    phase !== 'live' ? null : aiSpeaking ? (sending ? 'NEXT_QUESTION' : 'ASKING') : sending ? 'PROCESSING' : 'ANSWERING';

  useEffect(() => {
    rawTranscriptRef.current = rawTranscript;
    transcriptRef.current = effectiveTranscript;
  }, [rawTranscript, effectiveTranscript]);

  useEffect(() => {
    manuallyCorrectedRef.current = manuallyCorrected;
  }, [manuallyCorrected]);

  // speechSynthesis populates its voice list asynchronously on some
  // browsers — load it up front and again on the 'voiceschanged' event.
  useEffect(() => {
    if (!window.speechSynthesis) return undefined;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, []);

  // ─── Camera preview before joining ───
  useEffect(() => {
    if (phase !== 'preview') return undefined;
    let stream;
    navigator.mediaDevices
      ?.getUserMedia({ video: true, audio: true })
      .then((s) => {
        stream = s;
        setPreviewStream(s);
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(() => setError('Camera/microphone permission was denied. Please allow access and reload the page.'));
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, [phase]);

  // ─── Security/monitoring events (Section 4) — presence/attention/
  // connection audit trail only, never video/audio content itself ───
  useEffect(() => {
    if (phase !== 'live' && phase !== 'connecting') return undefined;

    const onVisibility = () => {
      if (document.hidden) logEventSafely(interviewId, 'TAB_SWITCH');
    };
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) logEventSafely(interviewId, 'FULLSCREEN_EXIT');
    };
    const onBeforeUnload = () => logEventSafely(interviewId, 'PAGE_LEFT');

    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [phase, interviewId]);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setRecording(false);
  }, []);

  const cleanupAll = useCallback(() => {
    window.speechSynthesis?.cancel();
    stopRecording();
    roomRef.current?.disconnect();
    roomRef.current = null;
  }, [stopRecording]);

  useEffect(() => cleanupAll, [cleanupAll]);

  const askQuestion = useCallback(
    async (nextStage, nextQuestion, progress) => {
      setStage(nextStage);
      setQuestion(nextQuestion);
      setFinalTranscript('');
      setInterimTranscript('');
      setCorrectedTranscript(null);
      setManuallyCorrected(false);
      setShowCorrectionBox(false);
      setQuestionNumber(progress?.questionNumber ?? null);
      setTotalQuestions(progress?.totalPlannedQuestions ?? null);
      questionStartRef.current = Date.now();
      if (!nextQuestion) return;
      setAiSpeaking(true);
      const voice = pickVoiceForGender(voices, voiceGender);
      await speak(nextQuestion.text, voice);
      setAiSpeaking(false);
    },
    [voices, voiceGender]
  );

  const handleJoin = async () => {
    setPhase('connecting');
    setError('');
    try {
      const {
        token,
        url,
        question: firstQuestion,
        interview,
        aiName: startAiName,
        aiTitle: startAiTitle,
        voiceGender: startVoiceGender,
        questionNumber: startQuestionNumber,
        totalPlannedQuestions: startTotalQuestions,
      } = await interviewsApi.start(interviewId);
      setAiName(startAiName || '');
      setAiTitle(startAiTitle || '');
      setVoiceGender(startVoiceGender || 'FEMALE');

      previewStream?.getTracks().forEach((t) => t.stop());
      setPreviewStream(null);

      // Video only — audio no longer flows through the room. The candidate's
      // answer is captured by the browser's own speech-to-text below, so
      // nothing ever plays the AI's speech back into a channel the room's
      // mic could pick up (the "echo"/feedback-loop this design avoids).
      const room = new Room();
      roomRef.current = room;

      room.on(RoomEvent.Disconnected, () => {
        setConnectionState('disconnected');
        logEventSafely(interviewId, 'CONNECTION_LOST');
      });
      room.on(RoomEvent.Reconnecting, () => setConnectionState('reconnecting'));
      room.on(RoomEvent.Reconnected, () => {
        setConnectionState('connected');
        logEventSafely(interviewId, 'CONNECTION_RESTORED');
      });
      room.on(RoomEvent.LocalTrackPublished, (publication) => {
        if (publication.track?.kind === Track.Kind.Video && videoRef.current) {
          publication.track.attach(videoRef.current);
        }
      });

      await room.connect(url, token);
      await room.localParticipant.setCameraEnabled(true);

      setConnectionState('connected');
      setPhase('live');
      await askQuestion(interview.stage, firstQuestion, {
        questionNumber: startQuestionNumber,
        totalPlannedQuestions: startTotalQuestions,
      });
    } catch (err) {
      setError(err.message);
      setPhase('error');
    }
  };

  const toggleCamera = async () => {
    const next = !cameraOn;
    setCameraOn(next);
    await roomRef.current?.localParticipant.setCameraEnabled(next);
    logEventSafely(interviewId, next ? 'CAMERA_ON' : 'CAMERA_OFF');
  };

  const startRecording = () => {
    if (!SpeechRecognitionCtor || aiSpeaking || recording || showCorrectionBox) return;
    // Starting a fresh recording pass supersedes any earlier manual fix —
    // otherwise new speech would be silently masked by a stale correction.
    setCorrectedTranscript(null);
    setManuallyCorrected(false);

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const chunk = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          setFinalTranscript((prev) => `${prev} ${chunk}`.trim());
        } else {
          interim += chunk;
        }
      }
      setInterimTranscript(interim.trim());
    };
    recognition.onerror = () => {
      setRecording(false);
      setInterimTranscript('');
    };
    recognition.onend = () => {
      setRecording(false);
      setInterimTranscript('');
    };

    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
    logEventSafely(interviewId, 'MIC_ON');
  };

  const handleStopRecording = () => {
    stopRecording();
    logEventSafely(interviewId, 'MIC_OFF');
  };

  const handleSend = useCallback(
    async (timedOut = false) => {
      if (!question || sending) return;
      stopRecording();
      setSending(true);
      const durationSeconds = questionStartRef.current ? Math.round((Date.now() - questionStartRef.current) / 1000) : undefined;
      try {
        const result = await interviewsApi.submitAnswer(interviewId, {
          questionId: question.id,
          transcript: transcriptRef.current,
          rawTranscript: rawTranscriptRef.current,
          manuallyCorrected: manuallyCorrectedRef.current,
          durationSeconds,
          timedOut,
        });
        if (result.done) {
          cleanupAll();
          setPhase('ended');
        } else {
          await askQuestion(result.stage, result.question, {
            questionNumber: result.questionNumber,
            totalPlannedQuestions: result.totalPlannedQuestions,
          });
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setSending(false);
      }
    },
    [question, sending, interviewId, stopRecording, askQuestion, cleanupAll]
  );

  // ─── Countdown for the current question's answer window — auto-sends
  // whatever's in the text box (even if empty) once time runs out ───
  useEffect(() => {
    if (!question || phase !== 'live' || aiSpeaking) {
      setSecondsLeft(question && phase === 'live' ? question.answerTimeLimitSeconds : null);
      return undefined;
    }
    setSecondsLeft(question.answerTimeLimitSeconds);
    const timer = setInterval(() => {
      setSecondsLeft((s) => {
        if (s == null) return null;
        if (s <= 1) {
          clearInterval(timer);
          handleSend(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, phase, aiSpeaking]);

  const handleEnd = async () => {
    setEnding(true);
    try {
      await interviewsApi.end(interviewId);
      cleanupAll();
      setConfirmEnd(false);
      setPhase('ended');
    } catch (err) {
      setError(err.message);
    } finally {
      setEnding(false);
    }
  };

  if (phase === 'ended') {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center text-center">
        <div className="mb-4 rounded-full bg-emerald-50 p-4">
          <Bot className="h-8 w-8 text-emerald-600" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900">Interview complete</h2>
        <p className="mt-2 text-sm text-slate-500">Thanks for taking the time to interview with us. The company will follow up on next steps.</p>
        <Button className="mt-6" onClick={() => navigate(`/candidate/applications`)}>
          Back to my applications
        </Button>
      </div>
    );
  }

  if (phase === 'error' && !previewStream) return <ErrorState message={error} onRetry={() => setPhase('preview')} />;

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-1 text-xl font-semibold text-slate-900">AI Interview Room</h2>
      <p className="mb-6 text-sm text-slate-500">
        {aiName ? `You'll be interviewed by ${aiName}${aiTitle ? `, ${aiTitle}` : ''}. ` : ''}
        Camera is on for presence only — nothing is recorded or stored.
      </p>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="relative aspect-video bg-slate-900">
          <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/50 px-3 py-1 text-xs text-white">
            {connectionState === 'connected' ? <Wifi className="h-3.5 w-3.5 text-emerald-400" /> : <WifiOff className="h-3.5 w-3.5 text-amber-400" />}
            {phase === 'preview' ? 'Preview' : connectionState}
          </div>
        </div>

        <div className="p-5">
          {phase === 'preview' && (
            <div className="text-center">
              {SpeechRecognitionCtor ? (
                <p className="mb-4 text-sm text-slate-600">Check your camera and microphone, then join when you're ready.</p>
              ) : (
                <p className="mb-4 text-sm text-red-600">
                  This interview requires voice recognition, which your browser doesn't support. Please reopen this page
                  in Chrome or Microsoft Edge to continue.
                </p>
              )}
              <Button onClick={handleJoin} className="w-full sm:w-auto" disabled={!SpeechRecognitionCtor}>
                <Video className="h-4 w-4" /> Join Interview
              </Button>
            </div>
          )}

          {phase === 'connecting' && <LoadingState label="Connecting to your interview…" />}

          {phase === 'live' && (
            <div>
              <div className="mb-4 flex items-center gap-3 rounded-lg bg-brand-50 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
                  {aiSpeaking ? (
                    <Volume2 className="h-4 w-4 animate-pulse" />
                  ) : aiName ? (
                    aiName.charAt(0).toUpperCase()
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-brand-700">
                      {aiName ? `${aiName}${aiTitle ? ` · ${aiTitle}` : ''}` : 'Your interviewer'}
                    </p>
                    {uiStage && (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${UI_STAGE_STYLES[uiStage]}`}>
                        {UI_STAGE_LABELS[uiStage]}
                      </span>
                    )}
                    {typeof questionNumber === 'number' && typeof totalQuestions === 'number' && (
                      <span className="text-[11px] text-slate-400">
                        {question?.type === 'FOLLOW_UP' ? 'Follow-up · ' : ''}Question {questionNumber} of {totalQuestions}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{STAGE_LABELS[stage] || stage}</p>
                  <p className="mt-1 select-none text-sm text-slate-800">{question?.text}</p>
                </div>
                {secondsLeft != null && !aiSpeaking && (
                  <div className={`shrink-0 text-lg font-semibold tabular-nums ${secondsLeft <= 5 ? 'animate-pulse text-red-600' : 'text-brand-700'}`}>
                    {secondsLeft}s
                  </div>
                )}
              </div>

              <div className="mb-3 min-h-[6rem] rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <div className="mb-1 flex items-center gap-2 text-xs font-medium text-slate-500">
                  {recording && (
                    <>
                      <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> Listening…
                    </>
                  )}
                  {!recording && sending && (
                    <>
                      <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" /> Submitted — processing…
                    </>
                  )}
                  {!recording && !sending && effectiveTranscript && (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Ready to send
                    </>
                  )}
                  {!recording && !sending && !effectiveTranscript && 'Turn on the mic to answer'}
                </div>

                {rawTranscript || correctedTranscript ? (
                  <p className="select-text whitespace-pre-wrap text-slate-800">
                    {correctedTranscript ?? finalTranscript}
                    {!correctedTranscript && interimTranscript && <span className="italic text-slate-400"> {interimTranscript}</span>}
                  </p>
                ) : (
                  <p className="italic text-slate-400">
                    {recording ? 'Listening for your answer…' : 'Nothing captured yet — start the mic and speak your answer.'}
                  </p>
                )}

                {correctedTranscript && (
                  <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                    <Pencil className="h-3 w-3" /> Corrected
                  </span>
                )}
              </div>

              {!recording && !aiSpeaking && !sending && rawTranscript && !showCorrectionBox && (
                <button
                  type="button"
                  onClick={() => {
                    setDraftCorrection(effectiveTranscript);
                    setShowCorrectionBox(true);
                  }}
                  className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
                >
                  <Pencil className="h-3.5 w-3.5" /> {correctedTranscript ? 'Edit correction' : 'Correct transcription'}
                </button>
              )}

              {showCorrectionBox &&
                (() => {
                  const cap = Math.max(rawTranscript.length + 40, Math.round(rawTranscript.length * 1.4));
                  return (
                    <div className="mb-3 rounded-lg border border-brand-200 bg-brand-50/40 p-3">
                      <p className="mb-1 text-xs font-medium text-slate-700">
                        Fix what the AI misheard — this isn't a place to write a new answer.
                      </p>
                      <textarea
                        value={draftCorrection}
                        onChange={(e) => setDraftCorrection(e.target.value.slice(0, cap))}
                        onPaste={(e) => e.preventDefault()}
                        onDrop={(e) => e.preventDefault()}
                        maxLength={cap}
                        rows={3}
                        className="w-full resize-none rounded-lg border border-slate-300 p-2 text-sm text-slate-800 focus:border-brand-500 focus:outline-none"
                      />
                      <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
                        <span>
                          Pasting is disabled — corrections must be typed. {draftCorrection.length}/{cap} characters.
                        </span>
                      </div>
                      <div className="mt-2 flex gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            setCorrectedTranscript(draftCorrection.trim());
                            setManuallyCorrected(true);
                            setShowCorrectionBox(false);
                          }}
                        >
                          Save correction
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => setShowCorrectionBox(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  );
                })()}

              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button variant="secondary" onClick={toggleCamera}>
                  {cameraOn ? <Camera className="h-4 w-4" /> : <CameraOff className="h-4 w-4" />}
                  {cameraOn ? 'Camera on' : 'Camera off'}
                </Button>
                {SpeechRecognitionCtor && (
                  <Button
                    variant={recording ? 'danger' : 'secondary'}
                    onClick={recording ? handleStopRecording : startRecording}
                    disabled={aiSpeaking || sending || showCorrectionBox}
                  >
                    {recording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    {recording ? 'Stop mic' : 'Start mic'}
                  </Button>
                )}
                <Button
                  onClick={() => handleSend(false)}
                  disabled={aiSpeaking || sending || showCorrectionBox || !effectiveTranscript.trim()}
                  loading={sending}
                >
                  <Send className="h-4 w-4" /> Send
                </Button>
                <Button variant="danger" onClick={() => setConfirmEnd(true)}>
                  <PhoneOff className="h-4 w-4" /> End Interview
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      <ConfirmDialog
        open={confirmEnd}
        title="End the interview?"
        description="You can't resume after ending. Only end early if you're sure you're finished."
        confirmLabel="End Interview"
        onConfirm={handleEnd}
        onCancel={() => setConfirmEnd(false)}
        loading={ending}
      />
    </div>
  );
}
