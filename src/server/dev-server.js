// Local development only. Production runs the same Express app through the
// Vercel serverless entry point at api/index.js (Section 2/19) — this file
// is never imported by that path.
import { createApp } from './app.js';
import { env } from './config/env.js';

const app = createApp();

app.listen(env.port, () => {
  console.log(`RecruitIQ API listening on http://localhost:${env.port}`);
});
