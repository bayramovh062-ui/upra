import { AppError } from '../../utils/AppError.js';
import { logger } from '../../utils/logger.js';
import { verifyContractAccess } from '../../utils/contractAccess.js';
import { getAiConfig } from './config.js';
import { AiProviderError, getProvider, isAiEnabled } from './provider.js';
import { getUsed, nextResetAt, refund, reserve } from './quota.js';
import { TOOL_DEFINITIONS, runTool } from './tools.js';
import { buildSystemPrompt, normalizeLocale } from './prompts.js';
import { buildDisputeContext } from './disputeContext.js';

// =====================================================================================
// Söhbət xidməti. Server vəziyyətsizdir: frontend hər dəfə son mesajları göndərir, heç nə saxlanmır.
// Axın: aktivdirmi → kontekst (xəta olarsa kvota sərf olunmur) → kvota rezervi → alət dövrü.
// Provayder uğursuz olarsa kvota geri qaytarılır.
// =====================================================================================

export const MAX_TOOL_STEPS = 4;

const notConfigured = () => new AppError('The AI assistant is not available.', 503, 'AI_NOT_CONFIGURED');
const busy = () => new AppError('The AI assistant is busy right now. Please try again later.', 503, 'AI_BUSY');
const dailyLimitReached = () => {
    const err = new AppError('Daily AI message limit reached. Try again tomorrow.', 429, 'AI_DAILY_LIMIT');
    err.resetAt = nextResetAt().toISOString();
    return err;
};

const toProviderHistory = (messages) =>
    messages.map((m) => (m.role === 'user' ? { role: 'user', text: m.content } : { role: 'model', text: m.content }));

// Modelin göstərdiyi müqavilə id-si yalnız istifadəçi həqiqətən tərəfdirsə sistem təlimatına düşür
const accessibleContractId = async (contractId, user) => {
    if (!contractId) return undefined;
    try {
        await verifyContractAccess(contractId, user.id);
        return contractId;
    } catch (err) {
        if (err instanceof AppError) return undefined; // səssizcə nəzərə alınmır
        throw err;
    }
};

// Alət dövrü: model alət istəyirsə icra edib nəticəni qaytarırıq, mətn verənə qədər (ən çox MAX_TOOL_STEPS addım)
const runLoop = async ({ provider, system, history, tools, user }) => {
    const messages = [...history];

    for (let step = 0; step < MAX_TOOL_STEPS; step += 1) {
        const result = await provider.generate({ system, messages, tools });

        if (Array.isArray(result?.toolCalls) && result.toolCalls.length > 0) {
            messages.push({ role: 'model', toolCalls: result.toolCalls, raw: result.raw });
            for (const call of result.toolCalls) {
                // Naməlum alət və ya səhv arqument xəta deyil: modelə { error } qayıdır
                const toolResult = await runTool(call.name, call.args, user);
                messages.push({ role: 'tool', name: call.name, result: toolResult });
            }
            continue;
        }

        const text = String(result?.text ?? '').trim();
        if (!text) throw new AiProviderError('Empty answer', 'blocked');
        return text;
    }

    throw new AiProviderError('Too many tool steps', 'busy');
};

const respond = async ({ kind, userId, limit, system, history, tools, user }) => {
    const reservation = await reserve(userId, kind, limit);
    if (!reservation.ok) throw dailyLimitReached();

    try {
        const reply = await runLoop({ provider: getProvider(), system, history, tools, user });
        return { reply, remainingToday: Math.max(0, limit - reservation.used) };
    } catch (err) {
        await refund(userId, kind);

        if (err instanceof AiProviderError) {
            if (err.kind === 'config') {
                logger.error(`AI provider configuration problem: ${err.message}`);
                throw notConfigured();
            }
            logger.warn(`AI provider ${err.kind}: ${err.message}`);
            throw busy();
        }
        throw err; // gözlənilməz xəta: global handler 500 qaytarır
    }
};

export const runAssistantChat = async ({ user, messages, locale, contractId }) => {
    if (!isAiEnabled()) throw notConfigured();

    const { dailyLimit } = getAiConfig();
    const currentContractId = await accessibleContractId(contractId, user);

    return respond({
        kind: 'ASSISTANT',
        userId: user.id,
        limit: dailyLimit,
        system: buildSystemPrompt({ kind: 'ASSISTANT', locale: normalizeLocale(locale), currentContractId }),
        history: toProviderHistory(messages),
        tools: TOOL_DEFINITIONS,
        user,
    });
};

// Admin mübahisə söhbəti: alət yoxdur (admin üçün "mənim müqavilələrim" mənasızdır), kontekst əvvəlcədən yüklənir
export const runDisputeChat = async ({ admin, disputeId, messages, locale }) => {
    if (!isAiEnabled()) throw notConfigured();

    const { adminDailyLimit } = getAiConfig();
    const disputeContext = await buildDisputeContext(disputeId); // 404 olarsa kvota toxunulmur

    return respond({
        kind: 'DISPUTE',
        userId: admin.id,
        limit: adminDailyLimit,
        system: buildSystemPrompt({ kind: 'DISPUTE', locale: normalizeLocale(locale), disputeContext }),
        history: toProviderHistory(messages),
        tools: [],
        user: admin,
    });
};

export const getAssistantStatus = async (user) => {
    const { dailyLimit } = getAiConfig();
    const used = await getUsed(user.id, 'ASSISTANT');
    return {
        enabled: isAiEnabled(),
        dailyLimit,
        remainingToday: Math.max(0, dailyLimit - used),
    };
};
