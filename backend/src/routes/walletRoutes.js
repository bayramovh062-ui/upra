import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { validate } from '../middlewares/validate.js';
import { topUpLimiter } from '../middlewares/rateLimiter.js';
import { topUpSchema, withdrawSchema } from '../validators/walletValidator.js';
import { getWallet, topUpWallet, withdrawFromWallet } from '../controllers/walletController.js';

const router = express.Router();

router.use(protect);

router.get('/', getWallet);
// DEMO: real ödəniş yoxdur. Rate limit protect-dən sonra gəlir ki, açar istifadəçi olsun
router.post('/topup', topUpLimiter, validate(topUpSchema), topUpWallet);
router.post('/withdraw', validate(withdrawSchema), withdrawFromWallet);

export default router;
