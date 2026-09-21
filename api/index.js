// Vercel serverless entry point. Vercel invokes this module's default
// export as a request handler; the Express app itself is a plain request
// listener, so no adapter library is needed (Section 2).
import { createApp } from '../src/server/app.js';

const app = createApp();

export default app;
