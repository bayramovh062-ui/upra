// AI köməkçisi söhbətinin təmiz köməkçi funksiyaları (React-dan asılı deyil, node --test ilə yoxlanılır).
// Limitlər backend-dəki aiValidator ilə uyğun olmalıdır (10 mesaj, hər biri ≤ 1000 simvol).

export const MAX_MESSAGES = 10;
export const MAX_CONTENT = 1000;

const UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
const CONTRACT_PATH = new RegExp(`^/contracts/(${UUID})(?:[/?#].*)?$`);

// history: [{ role: 'user' | 'assistant' | 'error', content }] -> serverə gedən mesajlar.
// "error" yazıları göndərilmir; son MAX_MESSAGES mesaj qalır; hər biri MAX_CONTENT simvola kəsilir;
// ilk mesaj həmişə "user" olur (köhnə mesajlar kəsiləndə assistant ilə başlamasın).
export const toRequestMessages = (history) => {
    const messages = history
        .filter((entry) => entry.role === 'user' || entry.role === 'assistant')
        .slice(-MAX_MESSAGES)
        .map((entry) => ({ role: entry.role, content: String(entry.content ?? '').trim().slice(0, MAX_CONTENT) }))
        .filter((entry) => entry.content.length > 0);

    while (messages.length > 0 && messages[0].role !== 'user') messages.shift();
    return messages;
};

export const canSend = (text, busy) => !busy && String(text ?? '').trim().length > 0;

// Yalnız /contracts/<uuid> səhifəsində müqavilə id-sini qaytarır; digər yollarda null
export const contractIdFromPath = (pathname) => {
    const match = String(pathname ?? '').match(CONTRACT_PATH);
    return match ? match[1] : null;
};

// Backend xətasını i18n açarına çevirir (mətnə baxmadan, sabit koda görə)
export const errorKeyFor = (error) => {
    const code = error?.data?.code;
    if (code === 'AI_DAILY_LIMIT') return 'ai.errors.dailyLimit';
    if (code === 'AI_BUSY') return 'ai.errors.busy';
    if (code === 'AI_NOT_CONFIGURED') return 'ai.errors.notConfigured';
    if (error?.status === 429) return 'ai.errors.tooFast';
    return 'ai.errors.generic';
};
