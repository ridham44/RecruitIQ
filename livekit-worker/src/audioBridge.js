import { AudioFrame } from '@livekit/rtc-node';
import { SAMPLE_RATE } from './deepgram.js';

const FRAME_MS = 20;
const SAMPLES_PER_FRAME = Math.round((SAMPLE_RATE * FRAME_MS) / 1000);

// Deepgram's realtime STT socket wants raw PCM16 bytes — a LiveKit
// AudioFrame's `data` is already an Int16Array at the negotiated sample
// rate, so this is just a view over the same bytes, no resampling needed
// since AudioStream(track, SAMPLE_RATE) below requests that rate directly.
export function frameToPcmBuffer(frame) {
  return Buffer.from(frame.data.buffer, frame.data.byteOffset, frame.data.byteLength);
}

// Chunks a raw PCM16 mono buffer (from Deepgram TTS) into ~20ms AudioFrames
// and captures them into the LiveKit AudioSource in order. Awaiting each
// captureFrame call lets the SDK pace playback in real time rather than
// dumping the whole buffer in at once.
export async function playPcmBuffer(audioSource, pcmBuffer) {
  const samples = new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.byteLength / 2);

  for (let offset = 0; offset < samples.length; offset += SAMPLES_PER_FRAME) {
    const chunk = samples.subarray(offset, Math.min(offset + SAMPLES_PER_FRAME, samples.length));
    const frame = new AudioFrame(chunk, SAMPLE_RATE, 1, chunk.length);
    await audioSource.captureFrame(frame);
  }
  await audioSource.waitForPlayout();
}
