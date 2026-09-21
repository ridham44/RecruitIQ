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

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.clientUrl, credentials: true }));
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.get('/api/health', (req, res) => {
    res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
  });

  // Versioned API (Section 15) — Phase 2/3 modules (notifications,
  // scheduling, interviews, reports) will be mounted the same way, at
  // /api/v1/notifications, /api/v1/scheduling, /api/v1/interviews, etc.,
  // without touching the routes below.
  const v1 = express.Router();
  v1.use('/auth', authRoutes);
  v1.use('/companies', companiesRoutes);
  v1.use('/candidates', candidatesRoutes);
  v1.use('/jobs', jobsRoutes);
  v1.use('/resumes', resumesRoutes);
  v1.use('/applications', applicationsRoutes);
  v1.use('/screening', screeningRoutes);

  app.use('/api/v1', v1);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
