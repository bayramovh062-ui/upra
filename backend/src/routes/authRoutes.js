import express from 'express';
import {
    register,
    login,
    getMe,
    updateMe,
    updatePassword,
} from '../controllers/authController.js';
import { protect } from '../middlewares/authMiddleware.js';
import { validate } from '../middlewares/validate.js';
import { authLimiter } from '../middlewares/rateLimiter.js';
import {
    registerSchema,
    loginSchema,
    updateMeSchema,
    updatePasswordSchema,
} from '../validators/authValidator.js';

const router = express.Router();

router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);

router.get('/me', protect, getMe);
router.patch('/update-me', protect, validate(updateMeSchema), updateMe);
router.patch('/update-password', protect, validate(updatePasswordSchema), updatePassword);

export default router;