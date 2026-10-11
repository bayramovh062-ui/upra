import express from 'express';
import { protect, restrictTo } from '../middlewares/authMiddleware.js';
import { validate } from '../middlewares/validate.js';
import { createJobSchema, updateJobSchema } from '../validators/jobValidator.js';
import {
    createJob,
    getAllJobs,
    getJob,
    updateJob,
    deleteJob,
} from '../controllers/jobController.js';

const router = express.Router();

router.get('/', getAllJobs);
router.get('/:id', getJob);

router.use(protect);

router.post('/', restrictTo('CLIENT'), validate(createJobSchema), createJob);
router.patch('/:id', restrictTo('CLIENT'), validate(updateJobSchema), updateJob);
router.delete('/:id', restrictTo('CLIENT'), deleteJob);

export default router;