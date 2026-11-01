import express from 'express';
import { protect, optionalAuth, restrictTo } from '../middlewares/authMiddleware.js';
import { validate } from '../middlewares/validate.js';
import { createJobSchema, updateJobSchema } from '../validators/jobValidator.js';
import {
    createJob,
    getAllJobs,
    getMyJobs,
    getSavedJobs,
    getJob,
    updateJob,
    publishJob,
    deleteJob,
    saveJob,
    unsaveJob,
} from '../controllers/jobController.js';

const router = express.Router();

// Siyahı hamıya açıqdır; token varsa isSaved, matchScore və tab sayları da gəlir
router.get('/', optionalAuth, getAllJobs);

router.use(protect);

// Statik yollar /:id-dən ƏVVƏL gəlməlidir, yoxsa "my" və "saved" id kimi oxunar
router.get('/my', restrictTo('CLIENT'), getMyJobs);
router.get('/saved', restrictTo('FREELANCER'), getSavedJobs);
router.get('/:id', getJob);

router.post('/', restrictTo('CLIENT'), validate(createJobSchema), createJob);
router.post('/:id/publish', restrictTo('CLIENT'), publishJob);
router.post('/:id/save', restrictTo('FREELANCER'), saveJob);
router.delete('/:id/save', restrictTo('FREELANCER'), unsaveJob);
router.patch('/:id', restrictTo('CLIENT'), validate(updateJobSchema), updateJob);
router.delete('/:id', restrictTo('CLIENT'), deleteJob);

export default router;
