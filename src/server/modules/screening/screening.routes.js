import { Router } from 'express';
import * as screeningController from './screening.controller.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { ROLES } from '../../../shared/constants/roles.js';

const router = Router();

router.use(authenticate, authorize(ROLES.COMPANY));

router.post('/job/:jobId/run', screeningController.runForJob);
router.post('/application/:applicationId/run', screeningController.runForApplication);
router.get('/job/:jobId/ranked', screeningController.getRanked);
router.get('/job/:jobId/top', screeningController.getTop10);

export default router;
