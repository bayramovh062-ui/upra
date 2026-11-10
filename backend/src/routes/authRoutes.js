import express from 'express';
import {
    register,
    login,
    getMe,
    updateMe,
    updatePassword,
    sendVerificationEmail,
    verifyEmail,
    forgotPassword,
    resetPassword,
} from '../controllers/authController.js';
import { deleteAccount } from '../controllers/accountController.js';
import { protect } from '../middlewares/authMiddleware.js';
import { validate } from '../middlewares/validate.js';
import {
    loginLimiter,
    registerLimiter,
    authTokenIpLimiter,
    forgotPasswordEmailLimiter,
    verificationSendLimiter,
} from '../middlewares/rateLimiter.js';
import {
    registerSchema,
    loginSchema,
    updateMeSchema,
    updatePasswordSchema,
    deleteAccountSchema,
    verifyEmailSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
} from '../validators/authValidator.js';

const router = express.Router();

router.post('/register', registerLimiter, validate(registerSchema), register);
router.post('/login', loginLimiter, validate(loginSchema), login);

// Phase B: e-poçt təsdiqi və parol bərpası
router.post('/verify-email/send', protect, verificationSendLimiter, sendVerificationEmail);
router.post('/verify-email', authTokenIpLimiter, validate(verifyEmailSchema), verifyEmail);
router.post('/forgot-password', authTokenIpLimiter, forgotPasswordEmailLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', authTokenIpLimiter, validate(resetPasswordSchema), resetPassword);

router.get('/me', protect, getMe);
router.delete('/me', protect, validate(deleteAccountSchema), deleteAccount);
router.patch('/update-me', protect, validate(updateMeSchema), updateMe);
router.patch('/update-password', protect, validate(updatePasswordSchema), updatePassword);

export default router;
