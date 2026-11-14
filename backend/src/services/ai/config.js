// AI konfiqurasiyası. Mühit dəyişənləri hər çağırışda oxunur (testlər və yenidən başlatmadan dəyişiklik üçün).

const DEFAULT_MODEL = 'gemini-3.5-flash-lite';

const toLimit = (value, fallback) => {
    const n = Number.parseInt(value, 10);
    return Number.isInteger(n) && n >= 0 ? n : fallback;
};

export const getAiConfig = () => ({
    apiKey: String(process.env.GEMINI_API_KEY ?? '').trim(),
    model: String(process.env.AI_MODEL ?? '').trim() || DEFAULT_MODEL,
    dailyLimit: toLimit(process.env.AI_DAILY_LIMIT, 20),
    adminDailyLimit: toLimit(process.env.AI_ADMIN_DAILY_LIMIT, 50),
    // AI_ENABLED=false hər şeyi söndürür; boşdursa açar varsa işləyir
    flagEnabled: String(process.env.AI_ENABLED ?? '').trim().toLowerCase() !== 'false',
});
