import { getAiConfig } from './config.js';
import { createGeminiProvider } from './geminiProvider.js';

export { AiProviderError } from './aiProviderError.js';

// Provayder müqaviləsi:
//   generate({ system, messages, tools }) -> { text } | { toolCalls: [{ name, args }], raw? }
//   messages: { role:'user', text } | { role:'model', text?, toolCalls?, raw? } | { role:'tool', name, result }
//   `raw` provayderə məxsus qeyri-şəffaf məlumatdır: chatService onu dəyişmədən model növbəsi ilə saxlayır.
// Provayderi dəyişmək üçün eyni müqavilə ilə yeni adapter yazıb aşağıdakı getProvider-dən qaytarmaq kifayətdir.

let override = null;

export const getProvider = () => {
    if (override) return override;
    const { apiKey, model } = getAiConfig();
    if (!apiKey) return null;
    return createGeminiProvider({ apiKey, model });
};

export const isAiEnabled = () => getAiConfig().flagEnabled && getProvider() !== null;

// Yalnız testlər üçün
export const __setProviderForTests = (provider) => {
    override = provider ?? null;
};
