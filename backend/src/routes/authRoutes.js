import express from 'express';
import {
    register,
    login,
    getMe,
    updateMe,
    updatePassword,
} from '../controllers/authController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);

router.get('/me', protect, getMe);
router.patch('/update-me', protect, updateMe);
router.patch('/update-password', protect, updatePassword);

export default router;