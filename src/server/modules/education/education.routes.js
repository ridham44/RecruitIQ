import { Router } from 'express';
import * as educationController from './education.controller.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { ROLES } from '../../../shared/constants/roles.js';
import { educationSchema, updateEducationSchema } from '../../../shared/schemas/education.schema.js';

const router = Router();

router.use(authenticate, authorize(ROLES.CANDIDATE));

router.get('/', educationController.listEducations);
router.post('/', validate(educationSchema), educationController.addEducation);
router.patch('/:id', validate(updateEducationSchema), educationController.updateEducation);
router.delete('/:id', educationController.deleteEducation);

export default router;
