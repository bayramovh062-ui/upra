import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCreateContractBody } from './createContractPayload.js';

test('one payment: milestones is omitted so the backend creates Full delivery', () => {
    assert.deepEqual(buildCreateContractBody({ proposalId: 'proposal-1' }), {
        proposalId: 'proposal-1',
    });
    assert.deepEqual(buildCreateContractBody({ proposalId: 'proposal-1', milestones: undefined }), {
        proposalId: 'proposal-1',
    });
});

test('two milestones are forwarded in order with their amounts', () => {
    const milestones = [
        { title: 'Design', amount: 950 },
        { title: 'Build', amount: 950 },
    ];

    assert.deepEqual(buildCreateContractBody({ proposalId: 'proposal-1', milestones }), {
        proposalId: 'proposal-1',
        milestones: [
            { title: 'Design', amount: 950 },
            { title: 'Build', amount: 950 },
        ],
    });
});

test('three or more milestones are all preserved', () => {
    const milestones = [
        { title: 'Research', amount: 100, dueDate: '2026-12-01' },
        { title: 'Design', amount: 200.5, dueDate: '2026-12-15' },
        { title: 'Build', amount: 300.25 },
        { title: 'Launch', amount: 399.25 },
    ];

    const body = buildCreateContractBody({ proposalId: 'proposal-1', milestones });

    assert.equal(body.milestones.length, 4);
    assert.deepEqual(
        body.milestones.map((m) => m.title),
        ['Research', 'Design', 'Build', 'Launch'],
    );
    assert.deepEqual(
        body.milestones.map((m) => m.amount),
        [100, 200.5, 300.25, 399.25],
    );
});

test('only the fields accepted by the backend are sent', () => {
    const body = buildCreateContractBody({
        proposalId: 'proposal-1',
        milestones: [{ title: 'Design', amount: 950, dueDate: '2026-12-01', id: 'leak', status: 'PAID' }],
    });

    assert.deepEqual(body.milestones, [{ title: 'Design', amount: 950, dueDate: '2026-12-01' }]);
});

test('an empty due date is not sent (null would be coerced to 1970-01-01)', () => {
    const body = buildCreateContractBody({
        proposalId: 'proposal-1',
        milestones: [{ title: 'Design', amount: 950, dueDate: '' }],
    });

    assert.deepEqual(body.milestones, [{ title: 'Design', amount: 950 }]);
});

test('an explicitly empty plan is forwarded so backend validation rejects it', () => {
    assert.deepEqual(buildCreateContractBody({ proposalId: 'proposal-1', milestones: [] }), {
        proposalId: 'proposal-1',
        milestones: [],
    });
});
