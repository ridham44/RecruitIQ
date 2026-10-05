import { Router } from 'express';
import { env } from '../../config/env.js';
import { ok } from '../../utils/apiResponse.js';
import {
  DEMO_ACCOUNTS,
  DEMO_AGENCY_SLUG,
  DEMO_AGENCY_NAME,
  DEMO_COMPANY_NAME,
  DEMO_JOB_TITLE,
  DEMO_JOB_SLUG,
  DEMO_CLOSED_JOB_SLUG,
  DEMO_AGENCY_B_NAME,
  DEMO_AGENCY_B_SLUG,
  DEMO_SAMPLE_RESUMES,
} from '../../../shared/constants/demo.js';

// Build plan P1: non-secret settings the frontend needs before login (e.g.
// whether to show the "I'm a Company" signup tab). Never put secrets here.
const router = Router();

router.get('/public', (req, res) => {
  ok(res, {
    allowCompanySelfRegister: env.features.allowCompanySelfRegister,
    // Build plan P4
    guestApply: env.features.guestApply,
    // Build plan P5
    instantInterview: env.features.instantInterview,
    // Build plan P8
    clientPortal: env.features.clientPortal,
    // Build plan P9 — /recq agency-link candidate flow
    recq: env.features.recq,
    // Public address used for links recruiters share with candidates.
    publicAppUrl: env.publicAppUrl,
  });
});

// "Start here" demo page. The demo password is the one secret-ish value and
// is only returned while DEMO_PAGE is on (demo accounts only — never real ones).
router.get('/demo', (req, res) => {
  const on = env.features.demoPage;
  ok(res, {
    enabled: on,
    password: on ? env.demoPassword : null,
    agencySlug: DEMO_AGENCY_SLUG,
    agencyName: DEMO_AGENCY_NAME,
    companyName: DEMO_COMPANY_NAME,
    jobTitle: DEMO_JOB_TITLE,
    // Build plan P9: the /recq demo links.
    jobSlug: DEMO_JOB_SLUG,
    closedJobSlug: DEMO_CLOSED_JOB_SLUG,
    agencyB: { name: DEMO_AGENCY_B_NAME, slug: DEMO_AGENCY_B_SLUG },
    sampleResumes: DEMO_SAMPLE_RESUMES,
    accounts: DEMO_ACCOUNTS.map(({ key, label, email, canDo }) => ({ key, label, email: on ? email : null, canDo })),
    features: {
      guestApply: env.features.guestApply,
      instantInterview: env.features.instantInterview,
      clientPortal: env.features.clientPortal,
      recq: env.features.recq,
    },
  });
});

export default router;
