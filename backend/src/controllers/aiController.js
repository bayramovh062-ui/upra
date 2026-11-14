import { asyncHandler } from '../utils/asyncHandler.js';
import { getAssistantStatus, runAssistantChat, runDisputeChat } from '../services/ai/chatService.js';

// Nazik controller: məntiq chatService-dədir. Gündəlik limit cavabına sıfırlanma vaxtı (resetAt) əlavə olunur.
const answer = async (res, run) => {
    try {
        const result = await run();
        return res.json({ success: true, ...result });
    } catch (err) {
        if (err?.errorCode === 'AI_DAILY_LIMIT') {
            return res.status(429).json({
                success: false,
                message: err.message,
                code: err.errorCode,
                resetAt: err.resetAt,
            });
        }
        throw err;
    }
};

// @route   GET /api/ai/status
// @access  Private. Köməkçi aktivdirmi və bu gün neçə mesaj qalıb
export const getStatus = asyncHandler(async (req, res) => {
    const status = await getAssistantStatus(req.user);
    res.json({ success: true, ...status });
});

// @route   POST /api/ai/chat
// @access  Private. Body: { messages, locale?, context?: { contractId? } }
export const chat = asyncHandler(async (req, res) => {
    const { messages, locale, context } = req.body;
    await answer(res, () =>
        runAssistantChat({ user: req.user, messages, locale, contractId: context?.contractId })
    );
});

// @route   POST /api/ai/disputes/:id/chat
// @access  Private, yalnız ADMIN. Body: { messages, locale? }
export const disputeChat = asyncHandler(async (req, res) => {
    const { messages, locale } = req.body;
    await answer(res, () =>
        runDisputeChat({ admin: req.user, disputeId: req.params.id, messages, locale })
    );
});
