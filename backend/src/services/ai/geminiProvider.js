import { AiProviderError } from './aiProviderError.js';

// =====================================================================================
// Gemini REST adapteri (SDK yoxdur). Provayderə xas bütün kod yalnız buradadır.
//
// Gemini 3 modelləri alət çağırışlarında "thoughtSignature" qaytarır və növbəti sorğuda
// həmin hissənin DƏYİŞMƏDƏN geri göndərilməsini tələb edir (yoxsa 400). Ona görə modelin
// alət çağıran növbəsi `raw` (Gemini "parts" massivi) kimi saxlanılır və olduğu kimi geri verilir.
// =====================================================================================

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const BLOCKED_FINISH_REASONS = new Set(['SAFETY', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII', 'RECITATION', 'IMAGE_SAFETY']);
const MAX_OUTPUT_TOKENS = 2048;

const toFunctionDeclaration = (tool) => {
    const declaration = { name: tool.name, description: tool.description };
    // Gemini boş "properties" olan OBJECT sxemini qəbul etmir: arqumentsiz alətdə parameters yazılmır
    const hasProps = tool.parameters && Object.keys(tool.parameters.properties ?? {}).length > 0;
    if (hasProps) declaration.parameters = tool.parameters;
    return declaration;
};

// Daxili mesajları Gemini "contents" formatına çevirir. Ardıcıl alət nəticələri BİR user növbəsində toplanır.
export const toGeminiContents = (messages) => {
    const contents = [];
    let toolTurn = null;

    for (const message of messages) {
        if (message.role === 'tool') {
            const part = { functionResponse: { name: message.name, response: message.result ?? {} } };
            if (toolTurn) {
                toolTurn.parts.push(part);
            } else {
                toolTurn = { role: 'user', parts: [part] };
                contents.push(toolTurn);
            }
            continue;
        }

        toolTurn = null;

        if (message.role === 'user') {
            contents.push({ role: 'user', parts: [{ text: message.text }] });
        } else if (message.role === 'model') {
            if (Array.isArray(message.raw) && message.raw.length > 0) {
                contents.push({ role: 'model', parts: message.raw });
                continue;
            }
            const parts = [];
            if (message.text) parts.push({ text: message.text });
            for (const call of message.toolCalls ?? []) {
                parts.push({ functionCall: { name: call.name, args: call.args ?? {} } });
            }
            if (parts.length > 0) contents.push({ role: 'model', parts });
        }
    }

    return contents;
};

const readErrorBody = async (res) => {
    try {
        const body = await res.json();
        return { message: String(body?.error?.message ?? ''), status: String(body?.error?.status ?? '') };
    } catch {
        return { message: '', status: '' };
    }
};

// HTTP xətasını növə çevirir. Açar heç vaxt mesaja yazılmır; yalnız status kodu və Google-un status sözü.
const toProviderError = (httpStatus, body) => {
    const suffix = body.status ? ` ${body.status}` : '';
    const message = `Gemini request failed (HTTP ${httpStatus}${suffix})`;

    if ([429, 500, 502, 503, 504].includes(httpStatus)) return new AiProviderError(message, 'busy');
    if ([401, 403, 404].includes(httpStatus)) return new AiProviderError(message, 'config');
    if (httpStatus === 400 && /api key|API_KEY/i.test(`${body.message} ${body.status}`)) {
        return new AiProviderError(message, 'config');
    }
    return new AiProviderError(message, 'busy');
};

export const createGeminiProvider = ({ apiKey, model, fetchImpl = fetch, timeoutMs = 20_000 }) => ({
    async generate({ system, messages, tools = [] }) {
        const body = {
            systemInstruction: { parts: [{ text: system }] },
            contents: toGeminiContents(messages),
            generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS },
        };
        if (tools.length > 0) body.tools = [{ functionDeclarations: tools.map(toFunctionDeclaration) }];

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        let res;
        try {
            res = await fetchImpl(`${BASE_URL}/${encodeURIComponent(model)}:generateContent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
                body: JSON.stringify(body),
                signal: controller.signal,
            });
        } catch (err) {
            clearTimeout(timer);
            const reason = err?.name === 'AbortError' ? 'timeout' : 'network error';
            throw new AiProviderError(`Gemini request failed (${reason})`, 'busy');
        }

        try {
            if (!res.ok) throw toProviderError(res.status, await readErrorBody(res));

            let data;
            try {
                data = await res.json();
            } catch {
                throw new AiProviderError('Gemini returned an unreadable response', 'busy');
            }

            const candidate = data?.candidates?.[0];
            if (data?.promptFeedback?.blockReason || !candidate) {
                throw new AiProviderError('Gemini returned no answer', 'blocked');
            }
            if (BLOCKED_FINISH_REASONS.has(candidate.finishReason)) {
                throw new AiProviderError(`Gemini blocked the answer (${candidate.finishReason})`, 'blocked');
            }

            const parts = Array.isArray(candidate.content?.parts) ? candidate.content.parts : [];
            const calls = parts.filter((p) => p?.functionCall?.name);
            if (calls.length > 0) {
                return {
                    toolCalls: calls.map((p) => ({ name: p.functionCall.name, args: p.functionCall.args ?? {} })),
                    raw: parts,
                };
            }

            const text = parts
                .filter((p) => typeof p?.text === 'string' && !p.thought)
                .map((p) => p.text)
                .join('')
                .trim();
            if (!text) throw new AiProviderError('Gemini returned an empty answer', 'blocked');

            return { text };
        } finally {
            clearTimeout(timer);
        }
    },
});
