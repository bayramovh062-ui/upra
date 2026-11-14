import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_CONTENT, MAX_MESSAGES, canSend, contractIdFromPath, errorKeyFor, toRequestMessages } from './chatUtils.js';

const ID = '123e4567-e89b-12d3-a456-426614174000';

test('toRequestMessages keeps only the last 10 messages', () => {
    const history = Array.from({ length: 12 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `m${i}`,
    }));
    const out = toRequestMessages(history);
    assert.ok(out.length <= MAX_MESSAGES);
    assert.equal(out.at(-1).content, 'm11');
    assert.ok(!out.some((m) => m.content === 'm0' || m.content === 'm1'));
});

test('toRequestMessages drops error entries', () => {
    const out = toRequestMessages([
        { role: 'user', content: 'hi' },
        { role: 'error', content: 'AI is busy' },
        { role: 'user', content: 'again' },
    ]);
    assert.deepEqual(out, [
        { role: 'user', content: 'hi' },
        { role: 'user', content: 'again' },
    ]);
});

test('toRequestMessages cuts long content to 1000 characters', () => {
    const out = toRequestMessages([{ role: 'user', content: 'x'.repeat(1500) }]);
    assert.equal(out[0].content.length, MAX_CONTENT);
});

test('toRequestMessages never starts with an assistant message', () => {
    const out = toRequestMessages([
        { role: 'assistant', content: 'welcome' },
        { role: 'user', content: 'hi' },
    ]);
    assert.deepEqual(out, [{ role: 'user', content: 'hi' }]);

    // 11 yazı olanda kəsmədən sonra assistant ilə başlayarsa o da atılır
    const long = Array.from({ length: 11 }, (_, i) => ({ role: i % 2 === 0 ? 'user' : 'assistant', content: `m${i}` }));
    assert.equal(toRequestMessages(long)[0].role, 'user');
});

test('toRequestMessages returns an empty list for an empty history', () => {
    assert.deepEqual(toRequestMessages([]), []);
});

test('contractIdFromPath matches only /contracts/<uuid>', () => {
    assert.equal(contractIdFromPath(`/contracts/${ID}`), ID);
    assert.equal(contractIdFromPath(`/contracts/${ID}?tab=escrow`), ID);
    assert.equal(contractIdFromPath(`/contracts/${ID}/anything`), ID);
    assert.equal(contractIdFromPath('/contracts'), null);
    assert.equal(contractIdFromPath('/contracts/abc'), null);
    assert.equal(contractIdFromPath(`/jobs/${ID}`), null);
    assert.equal(contractIdFromPath(undefined), null);
});

test('canSend needs text and an idle assistant', () => {
    assert.equal(canSend('  ', false), false);
    assert.equal(canSend('hi', true), false);
    assert.equal(canSend('hi', false), true);
});

test('errorKeyFor maps backend codes to translation keys', () => {
    assert.equal(errorKeyFor({ status: 429, data: { code: 'AI_DAILY_LIMIT' } }), 'ai.errors.dailyLimit');
    assert.equal(errorKeyFor({ status: 503, data: { code: 'AI_BUSY' } }), 'ai.errors.busy');
    assert.equal(errorKeyFor({ status: 503, data: { code: 'AI_NOT_CONFIGURED' } }), 'ai.errors.notConfigured');
    assert.equal(errorKeyFor({ status: 429, data: { message: 'too fast' } }), 'ai.errors.tooFast');
    assert.equal(errorKeyFor({ status: 500 }), 'ai.errors.generic');
    assert.equal(errorKeyFor(undefined), 'ai.errors.generic');
});
