import express from 'express';
import { protect, restrictTo } from '../middlewares/authMiddleware.js';
import { validate } from '../middlewares/validate.js';
import { createJobSchema, updateJobSchema } from '../validators/jobValidator.js';
import {
    createJob,
    getAllJobs,
    getMyJobs,
    getJob,
    updateJob,
    deleteJob,
} from '../controllers/jobController.js';

const router = express.Router();

router.get('/', getAllJobs);

router.use(protect);

router.get('/my', restrictTo('CLIENT'), getMyJobs);
router.get('/:id', getJob);

router.post('/', restrictTo('CLIENT'), validate(createJobSchema), createJob);
router.patch('/:id', restrictTo('CLIENT'), validate(updateJobSchema), updateJob);
router.delete('/:id', restrictTo('CLIENT'), deleteJob);

export default router;