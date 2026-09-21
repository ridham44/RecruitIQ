import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

import authRoutes from './modules/auth/auth.routes.js';
import companiesRoutes from './modules/companies/companies.routes.js';
import candidatesRoutes from './modules/candidates/candidates.routes.js';
import jobsRoutes from './modules/jobs/jobs.routes.js';
import resumesRoutes from './modules/resumes/resumes.routes.js';
import applicationsRoutes from './modules/applications/applications.routes.js';
import screeningRoutes from './modules/screening/screening.routes.js';
import schedulingRoutes from './modules/scheduling/scheduling.routes.js';
import interviewsRoutes from './modules/interviews/interviews.routes.js';

export function createApp() {
  const app = express();

  // Auth is a stateless Bearer JWT (Section 5/21) — no cookies are ever
  // set or read, so `credentials: true` (which governs cross-origin
  // cookie/credential sharing) is intentionally omitted. CLIENT_URL can be
  // a comma-separated list to allow more than one origin (e.g. a staging
  // domain alongside production). In this single-Vercel-project
  // architecture the deployed frontend and API always share one origin, so
  // this mainly matters for local development and any future external
  // client calling the API directly.
  const allowedOrigins = env.clientUrl.split(',').map((origin) => origin.trim());
  app.use(cors({ origin: allowedOrigins }));
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.get('/api/health', (req, res) => {
    res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
  });

  // Versioned API (Section 15).
  const v1 = express.Router();
  v1.use('/auth', authRoutes);
  v1.use('/companies', companiesRoutes);
  v1.use('/candidates', candidatesRoutes);
  v1.use('/jobs', jobsRoutes);
  v1.use('/resumes', resumesRoutes);
  v1.use('/applications', applicationsRoutes);
  v1.use('/screening', screeningRoutes);
  v1.use('/scheduling', schedulingRoutes);
  v1.use('/interviews', interviewsRoutes);

  app.use('/api/v1', v1);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
