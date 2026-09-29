import { Router } from 'express';
import { env } from '../../config/env.js';
import { ok } from '../../utils/apiResponse.js';

// Build plan P1: non-secret settings the frontend needs before login (e.g.
// whether to show the "I'm a Company" signup tab). Never put secrets here.
const router = Router();

router.get('/public', (req, res) => {
  ok(res, {
    allowCompanySelfRegister: env.features.allowCompanySelfRegister,
    // Build plan P4
    guestApply: env.features.guestApply,
  });
});

export default router;
