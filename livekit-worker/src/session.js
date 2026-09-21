import { Room, RoomEvent, AudioSource, LocalAudioTrack, TrackPublishOptions, TrackSource, AudioStream, TrackKind } from '@livekit/rtc-node';
import { createAgentToken, roomNameForInterview } from './livekitToken.js';
import { openSttSession, synthesizeSpeech, SAMPLE_RATE } from './deepgram.js';
import { frameToPcmBuffer, playPcmBuffer } from './audioBridge.js';
import { backendClient } from './backendClient.js';

const activeSessions = new Map();

// One of these runs per interview room, for its whole lifetime. This is
// the realtime half of the loop described in Section 5 — STT in, one call
// to the backend's interview engine, TTS out, repeat — with the backend
// owning every decision (next question, follow-up, when to end); this file
// never decides that itself.
export async function startInterviewSession(interviewId) {
  if (activeSessions.has(interviewId)) {
    console.log(`[session ${interviewId}] already running, ignoring duplicate start`);
    return;
  }

  const roomName = roomNameForInterview(interviewId);
  const room = new Room();
  activeSessions.set(interviewId, room);

  let currentQuestion = null;
  let timeoutTimer = null;
  let sttSession = null;
  let ended = false;

  const clearQuestionTimer = () => {
    if (timeoutTimer) clearTimeout(timeoutTimer);
    timeoutTimer = null;
  };

  const cleanup = async () => {
    if (ended) return;
    ended = true;
    clearQuestionTimer();
    sttSession?.close();
    activeSessions.delete(interviewId);
    try {
      await room.disconnect();
    } catch {
      // already disconnected
    }
    console.log(`[session ${interviewId}] cleaned up`);
  };

  try {
    const token = await createAgentToken(roomName);
    await room.connect(process.env.LIVEKIT_URL, token, { autoSubscribe: true });
    console.log(`[session ${interviewId}] connected to room ${roomName}`);

    // Publish our own audio track so we can speak questions.
    const audioSource = new AudioSource(SAMPLE_RATE, 1);
    const agentTrack = LocalAudioTrack.createAudioTrack('ai-interviewer-voice', audioSource);
    await room.localParticipant.publishTrack(agentTrack, new TrackPublishOptions({ source: TrackSource.SOURCE_MICROPHONE }));

    const speak = async (text) => {
      if (!text) return;
      const pcm = await synthesizeSpeech(text);
      await playPcmBuffer(audioSource, pcm);
    };

    const armQuestionTimer = (question) => {
      clearQuestionTimer();
      if (!question) return;
      // Backend-enforced safety net (Section: "handle ... timer expiry
      // gracefully") in case the candidate goes silent and Deepgram's
      // endpointing never fires speech_final/UtteranceEnd — the worker,
      // not the browser, owns advancing the interview, so it must be the
      // one to time out too.
      const graceMs = (question.answerTimeLimitSeconds + 10) * 1000;
      timeoutTimer = setTimeout(() => handleAnswer(question.id, '', true), graceMs);
    };

    const handleAnswer = async (questionId, transcript, timedOut) => {
      if (ended || !currentQuestion || currentQuestion.id !== questionId) return;
      clearQuestionTimer();
      try {
        const result = await backendClient.submitAnswer(interviewId, { questionId, transcript, timedOut });
        if (result.done) {
          await speak("That's the end of the interview. Thank you for your time — the team will follow up on next steps.");
          await cleanup();
          return;
        }
        currentQuestion = result.question;
        await speak(currentQuestion.text);
        armQuestionTimer(currentQuestion);
      } catch (err) {
        console.error(`[session ${interviewId}] failed to advance interview:`, err.message);
      }
    };

    room.on(RoomEvent.Disconnected, () => {
      backendClient.logEvent(interviewId, 'CONNECTION_LOST');
      cleanup();
    });

    room.on(RoomEvent.TrackSubscribed, async (track, _publication, participant) => {
      if (track.kind !== TrackKind.KIND_AUDIO || participant.identity === 'ai-interviewer') return;

      console.log(`[session ${interviewId}] subscribed to candidate audio track`);
      sttSession = await openSttSession({
        onFinalTranscript: (text) => currentQuestion && handleAnswer(currentQuestion.id, text, false),
        onUtteranceEnd: (text) => currentQuestion && handleAnswer(currentQuestion.id, text, false),
      });

      const audioStream = new AudioStream(track, SAMPLE_RATE, 1);
      (async () => {
        for await (const frame of audioStream) {
          if (ended) break;
          sttSession.sendAudio(frameToPcmBuffer(frame));
        }
      })().catch((err) => console.error(`[session ${interviewId}] audio stream error:`, err.message));

      // Candidate's track just subscribed — safe to start the interview now.
      const { state } = await backendClient.getContext(interviewId);
      currentQuestion = state.question;
      if (currentQuestion) {
        await speak(currentQuestion.text);
        armQuestionTimer(currentQuestion);
      }
    });

    room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      if (participant.identity !== 'ai-interviewer') {
        console.log(`[session ${interviewId}] candidate left the room`);
      }
    });
  } catch (err) {
    console.error(`[session ${interviewId}] failed to start:`, err.message);
    await cleanup();
  }
}

export function isSessionActive(interviewId) {
  return activeSessions.has(interviewId);
}
