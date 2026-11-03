import express from 'express';
import {
    register,
    login,
    getMe,
    updateMe,
    updatePassword,
} from '../controllers/authController.js';
import { deleteAccount } from '../controllers/accountController.js';
import { protect } from '../middlewares/authMiddleware.js';
import { validate } from '../middlewares/validate.js';
import { loginLimiter, registerLimiter } from '../middlewares/rateLimiter.js';
import {
    registerSchema,
    loginSchema,
    updateMeSchema,
    updatePasswordSchema,
    deleteAccountSchema,
} from '../validators/authValidator.js';

const router = express.Router();

router.post('/register', registerLimiter, validate(registerSchema), register);
router.post('/login', loginLimiter, validate(loginSchema), login);

router.get('/me', protect, getMe);
router.delete('/me', protect, validate(deleteAccountSchema), deleteAccount);
router.patch('/update-me', protect, validate(updateMeSchema), updateMe);
router.patch('/update-password', protect, validate(updatePasswordSchema), updatePassword);

export default router;