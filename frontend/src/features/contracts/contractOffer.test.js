import test from 'node:test';
import assert from 'node:assert/strict';
import { isPendingOffer, canRespondToOffer } from './contractOffer.js';

test('only PENDING_ACCEPTANCE is a pending offer', () => {
    assert.equal(isPendingOffer('PENDING_ACCEPTANCE'), true);
    for (const status of ['ACTIVE', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'DECLINED', undefined]) {
        assert.equal(isPendingOffer(status), false);
    }
});

test('only the contract freelancer can respond to the offer', () => {
    const contract = { status: 'PENDING_ACCEPTANCE', freelancerId: 'free-1', clientId: 'client-1' };

    assert.equal(canRespondToOffer(contract, 'free-1'), true);
    assert.equal(canRespondToOffer(contract, 'client-1'), false);
    assert.equal(canRespondToOffer(contract, 'someone-else'), false);
    assert.equal(canRespondToOffer(contract, undefined), false);
    assert.equal(canRespondToOffer(null, 'free-1'), false);
});

test('an accepted or declined contract no longer accepts a response', () => {
    for (const status of ['ACTIVE', 'DECLINED', 'COMPLETED', 'CANCELLED']) {
        assert.equal(canRespondToOffer({ status, freelancerId: 'free-1' }, 'free-1'), false);
    }
});
