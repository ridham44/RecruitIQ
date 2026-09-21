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

        if (event.event === 'room_started' && event.room?.name?.startsWith('interview-')) {
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
