import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { getUserProfile, getDashboardStats } from '../controllers/accountController.js';

const router = express.Router();

// protect hər route-a ayrıca yazılır (router.use yox): bu router /api-də quraşdırılıb,
// router.use(protect) bütün naməlum /api ünvanlarını 404 yerinə 401 edərdi.
router.get('/dashboard/stats', protect, getDashboardStats);
router.get('/users/:id', protect, getUserProfile);

export default router;
