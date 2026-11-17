import assert from 'node:assert/strict';
import { test } from 'node:test';
import { countBlockingIssues, netCents, planTotals } from './escrowUtils.js';

test('countBlockingIssues counts unfinished tasks of this milestone and of the backlog only', () => {
    const issues = [
        { status: 'DONE', milestoneId: null },
        { status: 'TODO', milestoneId: null }, // backlog: saxlayır
        { status: 'IN_PROGRESS', milestoneId: 'm1' }, // bu mərhələ: saxlayır
        { status: 'TODO', milestoneId: 'm2' }, // başqa mərhələ: saxlamır
        { status: 'DONE', milestoneId: 'm1' },
    ];
    assert.equal(countBlockingIssues(issues, 'm1'), 2);
    assert.equal(countBlockingIssues(issues, 'm2'), 2);
    assert.equal(countBlockingIssues([], 'm1'), 0);
    assert.equal(countBlockingIssues(undefined, 'm1'), 0);
});

test('planTotals sums per-milestone net amounts and ignores cancelled milestones', () => {
    const milestones = [
        { status: 'PENDING', amountCents: 2500 },
        { status: 'PENDING', amountCents: 2500 },
        { status: 'CANCELLED', amountCents: 9999 },
    ];
    // $50 -> freelancer $45, fee $5
    assert.deepEqual(planTotals(milestones), { grossCents: 5000, netTotalCents: 4500, feeCents: 500 });
});

test('planTotals rounds the fee down per milestone, like the backend', () => {
    // 1005 sent: fee floor(100.5) = 100, net 905. İki mərhələ ayrı-ayrı yuvarlaqlaşır.
    assert.equal(netCents(1005), 905);
    assert.deepEqual(planTotals([{ status: 'FUNDED', amountCents: 1005 }, { status: 'FUNDED', amountCents: 1005 }]), {
        grossCents: 2010,
        netTotalCents: 1810,
        feeCents: 200,
    });
});
