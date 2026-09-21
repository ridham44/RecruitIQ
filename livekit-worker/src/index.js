import './config.js'; // validates required env vars fail-fast, before anything else runs
import { startWebhookServer } from './webhookServer.js';

console.log('RecruitIQ LiveKit worker starting…');
startWebhookServer();

process.on('SIGTERM', () => {
  console.log('Shutting down (SIGTERM)…');
  process.exit(0);
});
process.on('SIGINT', () => {
  console.log('Shutting down (SIGINT)…');
  process.exit(0);
});
