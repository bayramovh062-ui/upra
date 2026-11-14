import test from 'node:test';
import assert from 'node:assert/strict';
import ai from './ai.js';

// Hər yarpaq açarının yolunu çıxarır: errors.busy, admin.title, ...
const leafPaths = (object, prefix = '') =>
    Object.entries(object).flatMap(([key, value]) =>
        value && typeof value === 'object' ? leafPaths(value, `${prefix}${key}.`) : [`${prefix}${key}`]
    );

const valueAt = (object, path) => path.split('.').reduce((current, part) => current?.[part], object);
const variablesOf = (text) => [...String(text).matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort();

const REQUIRED = [
    'title',
    'open',
    'close',
    'placeholder',
    'send',
    'thinking',
    'clear',
    'welcome',
    'disclaimer',
    'remaining_one',
    'remaining_other',
    'errors.busy',
    'errors.dailyLimit',
    'errors.notConfigured',
    'errors.tooFast',
    'errors.generic',
    'admin.title',
    'admin.hint',
    'admin.placeholder',
];

test('ai messages exist for en, az and tr with the same keys', () => {
    const reference = leafPaths(ai.en).sort();
    assert.deepEqual(reference, [...REQUIRED].sort());
    for (const locale of ['az', 'tr']) {
        assert.deepEqual(leafPaths(ai[locale]).sort(), reference, `${locale} keys differ from en`);
    }
});

test('every ai message is a non-empty string', () => {
    for (const locale of ['en', 'az', 'tr']) {
        for (const path of REQUIRED) {
            const value = valueAt(ai[locale], path);
            assert.equal(typeof value, 'string', `${locale}.${path}`);
            assert.ok(value.trim().length > 0, `${locale}.${path} is empty`);
        }
    }
});

test('interpolation variables match across languages', () => {
    for (const path of REQUIRED) {
        const expected = variablesOf(valueAt(ai.en, path));
        for (const locale of ['az', 'tr']) {
            assert.deepEqual(variablesOf(valueAt(ai[locale], path)), expected, `${locale}.${path}`);
        }
    }
});

test('the demo disclaimer is present in all three languages', () => {
    assert.match(ai.en.disclaimer, /Demo project/);
    assert.match(ai.az.disclaimer, /Demo layihə/);
    assert.match(ai.tr.disclaimer, /Demo proje/);
});
