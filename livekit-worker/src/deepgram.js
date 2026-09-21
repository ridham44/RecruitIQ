import { DeepgramClient } from '@deepgram/sdk';
import { config } from './config.js';

const client = new DeepgramClient({ accessToken: config.deepgramApiKey });

// Sample rate LiveKit publishes candidate audio at and the rate we ask
// Deepgram's TTS to render at — keeping both sides on one constant avoids
// a resample step when pushing frames back into the room.
export const SAMPLE_RATE = 48000;

// Opens a Deepgram realtime STT session for one candidate audio track.
// Deepgram's own endpointing (utterance_end_ms / speech_final) is what
// detects "the candidate paused/finished speaking" (Section 5) — no VAD is
// hand-rolled here.
export async function openSttSession({ onFinalTranscript, onUtteranceEnd }) {
  const socket = await client.listen.v1.connect({
    model: 'nova-2',
    encoding: 'linear16',
    sample_rate: SAMPLE_RATE,
    channels: 1,
    interim_results: true,
    utterance_end_ms: 1200,
    vad_events: true,
    smart_format: true,
    punctuate: true,
  });

  let buffer = '';

  socket.on('message', (message) => {
    if (message.type === 'Results') {
      const transcript = message.channel?.alternatives?.[0]?.transcript || '';
      if (!transcript) return;
      if (message.is_final) {
        buffer = buffer ? `${buffer} ${transcript}` : transcript;
      }
      if (message.speech_final && buffer) {
        onFinalTranscript(buffer.trim());
        buffer = '';
      }
    } else if (message.type === 'UtteranceEnd') {
      // Fires even if the last Results message wasn't marked speech_final
      // (e.g. trailing silence) — flush whatever we've accumulated so the
      // candidate is never left waiting on a dropped final.
      if (buffer.trim()) {
        onUtteranceEnd(buffer.trim());
        buffer = '';
      }
    }
  });

  return {
    sendAudio: (pcm16Buffer) => socket.sendMedia(pcm16Buffer),
    close: () => socket.close(),
  };
}

// One-shot REST TTS (not the streaming socket) — we're synthesizing whole
// sentences (a full question) at a time, not incremental speech, so the
// simpler request/response endpoint is a better fit and has far less to
// get wrong than framing a WebSocket stream.
export async function synthesizeSpeech(text) {
  const model = process.env.DEEPGRAM_TTS_MODEL || 'aura-2-thalia-en';
  const res = await fetch(`https://api.deepgram.com/v1/speak?model=${model}&encoding=linear16&sample_rate=${SAMPLE_RATE}`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${config.deepgramApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Deepgram TTS failed (${res.status}): ${body}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
