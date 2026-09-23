import http from 'node:http';
import { WebhookReceiver } from 'livekit-server-sdk';
import { config } from './config.js';
import { startInterviewSession, isSessionActive } from './session.js';

const receiver = new WebhookReceiver(config.liveKitApiKey, config.liveKitApiSecret);

// LiveKit's own room dispatch mechanism (a `room_started` webhook) is what
// tells this worker a candidate has joined — no polling. Configure this
// URL as the project's webhook endpoint in the LiveKit dashboard (or
// `livekit-cli project add` with `--webhook-url`), pointed at wherever this
// worker is deployed (Section: "keep the LiveKit worker separate from
// Vercel" — this is a plain long-running process, not a serverless route).
export function startWebhookServer() {
  const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/webhook/livekit') {
      res.writeHead(404).end();
      return;
    }

    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      try {
        const event = await receiver.receive(body, req.headers.authorization);
        res.writeHead(200).end('ok');

        // The candidate-facing interview flow now handles TTS/STT entirely
        // client-side (see InterviewRoomPage.jsx) — only video is published
        // to the LiveKit room, specifically so no audio channel exists for
        // an echo/feedback loop. This worker's realtime voice pipeline
        // (session.js) is the OLDER design that flow replaced. Auto-joining
        // every room here would make this worker independently synthesize
        // and publish its OWN audio for the very same question the browser
        // is already speaking locally — the candidate hears it twice,
        // which sounds exactly like an echo, except it's a real duplicate
        // audio source coming from LiveKit, not acoustic feedback. Disabled
        // by default; set ENABLE_LEGACY_REALTIME_VOICE=1 to opt back into
        // testing the old pipeline.
        if (
          process.env.ENABLE_LEGACY_REALTIME_VOICE === '1' &&
          event.event === 'room_started' &&
          event.room?.name?.startsWith('interview-')
        ) {
          const interviewId = event.room.name.replace('interview-', '');
          if (!isSessionActive(interviewId)) {
            console.log(`[webhook] room_started for ${event.room.name} — starting session`);
            startInterviewSession(interviewId).catch((err) => console.error('[webhook] session failed to start:', err.message));
          }
        }
      } catch (err) {
        console.error('[webhook] rejected (invalid signature or bad payload):', err.message);
        if (!res.headersSent) res.writeHead(401).end('invalid webhook signature');
      }
    });
  });

  server.listen(config.webhookPort, () => {
    console.log(`[webhook] listening on http://0.0.0.0:${config.webhookPort}/webhook/livekit`);
  });

  return server;
}
