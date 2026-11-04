import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { getWalletSummary, topUp, withdraw } from '../services/financialService.js';

const publicWallet = (wallet) => ({
    id: wallet.id,
    availableCents: wallet.availableCents,
    lockedCents: wallet.lockedCents,
    currency: wallet.currency,
});

// @route   GET /api/wallet
// @access  Private. Balans və son 20 ledger yazısı
export const getWallet = asyncHandler(async (req, res) => {
    const { wallet, transactions } = await getWalletSummary(req.user.id);

    res.status(200).json({
        success: true,
        wallet: publicWallet(wallet),
        transactions,
    });
});

// @route   POST /api/wallet/topup   body: { amountCents }
// @access  Private. DEMO funksiyadır: real ödəniş provayderi yoxdur, yalnız simulyasiya edilmiş balans əlavə edir.
// Production-da real ödəniş təsdiqi olmadan açıq saxlanmamalıdır: DEMO_TOPUP_ENABLED=false ilə söndürülür.
export const topUpWallet = asyncHandler(async (req, res) => {
    if (process.env.DEMO_TOPUP_ENABLED === 'false') {
        throw new AppError('Demo top-up is disabled on this server', 403);
    }

    const wallet = await topUp(req.user.id, req.body.amountCents);

    res.status(201).json({
        success: true,
        demo: true,
        message: 'Demo top-up: simulated balance, no real payment was made.',
        wallet: publicWallet(wallet),
    });
});

// @route   POST /api/wallet/withdraw   body: { amountCents }
// @access  Private. DEMO: yalnız mövcud (kilidsiz) balansdan
export const withdrawFromWallet = asyncHandler(async (req, res) => {
    const wallet = await withdraw(req.user.id, req.body.amountCents);

    res.status(200).json({
        success: true,
        demo: true,
        wallet: publicWallet(wallet),
    });
});
