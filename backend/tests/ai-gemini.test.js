import { AiProviderError, getProvider, isAiEnabled, __setProviderForTests } from '../src/services/ai/provider.js';
import { createGeminiProvider, toGeminiContents } from '../src/services/ai/geminiProvider.js';
import { TOOL_DEFINITIONS } from '../src/services/ai/tools.js';
import { createFakeProvider } from './helpers/fakeAiProvider.js';

const jsonResponse = (status, body) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
});

const makeFetch = (response) => {
    const requests = [];
    const fetchImpl = async (url, options) => {
        requests.push({ url, options, body: JSON.parse(options.body) });
        if (response instanceof Error) throw response;
        return typeof response === 'function' ? response(options) : response;
    };
    return { fetchImpl, requests };
};

const textAnswer = (text) => jsonResponse(200, { candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] });

describe('Gemini adapter', () => {
    const base = { apiKey: 'test-key-123', model: 'gemini-test' };
    const messages = [{ role: 'user', text: 'Hello' }];

    it('sends the key in a header, not in the URL, and maps system, contents and tools', async () => {
        const { fetchImpl, requests } = makeFetch(textAnswer('Hi'));
        const provider = createGeminiProvider({ ...base, fetchImpl });

        const result = await provider.generate({ system: 'Be helpful', messages, tools: TOOL_DEFINITIONS });
        expect(result).toEqual({ text: 'Hi' });

        const [{ url, options, body }] = requests;
        expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent');
        expect(url).not.toContain('test-key-123');
        expect(options.headers['x-goog-api-key']).toBe('test-key-123');
        expect(body.systemInstruction).toEqual({ parts: [{ text: 'Be helpful' }] });
        expect(body.contents).toEqual([{ role: 'user', parts: [{ text: 'Hello' }] }]);

        const declarations = body.tools[0].functionDeclarations;
        expect(declarations.map((d) => d.name)).toEqual(TOOL_DEFINITIONS.map((d) => d.name));
        // arqumentsiz alətdə parameters yoxdur, getContract-da var
        expect(declarations.find((d) => d.name === 'getMyWallet').parameters).toBeUndefined();
        expect(declarations.find((d) => d.name === 'getContract').parameters.required).toEqual(['contractId']);
    });

    it('omits tools entirely when none are given', async () => {
        const { fetchImpl, requests } = makeFetch(textAnswer('ok'));
        await createGeminiProvider({ ...base, fetchImpl }).generate({ system: 's', messages });
        expect(requests[0].body.tools).toBeUndefined();
    });

    it('returns tool calls together with the raw parts (thought signatures included)', async () => {
        const parts = [{ functionCall: { name: 'getMyWallet', args: {} }, thoughtSignature: 'sig-A' }];
        const { fetchImpl } = makeFetch(jsonResponse(200, { candidates: [{ content: { parts } }] }));
        const result = await createGeminiProvider({ ...base, fetchImpl }).generate({
            system: 's',
            messages,
            tools: TOOL_DEFINITIONS,
        });
        expect(result.toolCalls).toEqual([{ name: 'getMyWallet', args: {} }]);
        expect(result.raw).toEqual(parts);
    });

    it('replays the raw model turn and groups tool results into one user turn', () => {
        const raw = [
            { functionCall: { name: 'getMyWallet', args: {} }, thoughtSignature: 'sig-A' },
            { functionCall: { name: 'getMyContracts', args: {} } },
        ];
        const contents = toGeminiContents([
            { role: 'user', text: 'Hi' },
            { role: 'model', toolCalls: [{ name: 'getMyWallet', args: {} }], raw },
            { role: 'tool', name: 'getMyWallet', result: { availableCents: 5 } },
            { role: 'tool', name: 'getMyContracts', result: { contracts: [] } },
        ]);

        expect(contents).toHaveLength(3);
        expect(contents[1]).toEqual({ role: 'model', parts: raw });
        expect(contents[2].role).toBe('user');
        expect(contents[2].parts).toEqual([
            { functionResponse: { name: 'getMyWallet', response: { availableCents: 5 } } },
            { functionResponse: { name: 'getMyContracts', response: { contracts: [] } } },
        ]);
    });

    it('builds a model turn from toolCalls when no raw parts exist', () => {
        const contents = toGeminiContents([
            { role: 'model', text: 'Checking', toolCalls: [{ name: 'getMyWallet', args: { a: 1 } }] },
        ]);
        expect(contents[0].parts).toEqual([{ text: 'Checking' }, { functionCall: { name: 'getMyWallet', args: { a: 1 } } }]);
    });

    it.each([429, 500, 503])('maps HTTP %i to a busy error', async (status) => {
        const { fetchImpl } = makeFetch(jsonResponse(status, { error: { message: 'x', status: 'UNAVAILABLE' } }));
        await expect(createGeminiProvider({ ...base, fetchImpl }).generate({ system: 's', messages })).rejects.toMatchObject({
            name: 'AiProviderError',
            kind: 'busy',
        });
    });

    it('maps a timeout to a busy error', async () => {
        const fetchImpl = (url, options) =>
            new Promise((resolve, reject) => {
                options.signal.addEventListener('abort', () =>
                    reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
                );
            });
        await expect(
            createGeminiProvider({ ...base, fetchImpl, timeoutMs: 20 }).generate({ system: 's', messages })
        ).rejects.toMatchObject({ kind: 'busy' });
    });

    it('maps key problems to a config error and never puts the key in the message', async () => {
        for (const [status, body] of [
            [403, { error: { message: 'forbidden', status: 'PERMISSION_DENIED' } }],
            [400, { error: { message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT' } }],
        ]) {
            const { fetchImpl } = makeFetch(jsonResponse(status, body));
            const err = await createGeminiProvider({ ...base, fetchImpl })
                .generate({ system: 's', messages })
                .catch((e) => e);
            expect(err).toBeInstanceOf(AiProviderError);
            expect(err.kind).toBe('config');
            expect(err.message).not.toContain('test-key-123');
        }
    });

    it('treats missing candidates, empty text and safety stops as blocked', async () => {
        const cases = [
            jsonResponse(200, {}),
            jsonResponse(200, { promptFeedback: { blockReason: 'SAFETY' } }),
            jsonResponse(200, { candidates: [{ content: { parts: [{ text: '   ' }] }, finishReason: 'STOP' }] }),
            jsonResponse(200, { candidates: [{ content: { parts: [{ text: 'x' }] }, finishReason: 'SAFETY' }] }),
        ];
        for (const response of cases) {
            const { fetchImpl } = makeFetch(response);
            await expect(createGeminiProvider({ ...base, fetchImpl }).generate({ system: 's', messages })).rejects.toMatchObject({
                kind: 'blocked',
            });
        }
    });

    it('ignores thought parts when reading the text', async () => {
        const { fetchImpl } = makeFetch(
            jsonResponse(200, {
                candidates: [{ content: { parts: [{ text: 'secret thinking', thought: true }, { text: 'Answer' }] } }],
            })
        );
        expect(await createGeminiProvider({ ...base, fetchImpl }).generate({ system: 's', messages })).toEqual({
            text: 'Answer',
        });
    });
});

describe('provider selection', () => {
    const saved = { key: process.env.GEMINI_API_KEY, flag: process.env.AI_ENABLED };

    beforeEach(() => {
        delete process.env.GEMINI_API_KEY;
        delete process.env.AI_ENABLED;
        __setProviderForTests(null);
    });

    afterAll(() => {
        __setProviderForTests(null);
        if (saved.key === undefined) delete process.env.GEMINI_API_KEY;
        else process.env.GEMINI_API_KEY = saved.key;
        if (saved.flag === undefined) delete process.env.AI_ENABLED;
        else process.env.AI_ENABLED = saved.flag;
    });

    it('is disabled without a key', () => {
        expect(getProvider()).toBeNull();
        expect(isAiEnabled()).toBe(false);
    });

    it('is enabled with a key and can be switched off with AI_ENABLED=false', () => {
        process.env.GEMINI_API_KEY = 'abc';
        expect(typeof getProvider().generate).toBe('function');
        expect(isAiEnabled()).toBe(true);
        process.env.AI_ENABLED = 'false';
        expect(isAiEnabled()).toBe(false);
    });

    it('uses the test override when set', () => {
        const fake = createFakeProvider([]);
        __setProviderForTests(fake);
        expect(getProvider()).toBe(fake);
        expect(isAiEnabled()).toBe(true);
    });
});
