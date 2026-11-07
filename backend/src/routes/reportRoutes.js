import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { validate } from '../middlewares/validate.js';
import { createReportSchema } from '../validators/reportValidator.js';
import { createReport } from '../controllers/reportController.js';

const router = express.Router();

router.use(protect);

router.post('/', validate(createReportSchema), createReport);

export default router;
