import test from 'node:test';
import assert from 'node:assert/strict';
import {
    MAX_COMMENT_LENGTH,
    buildReviewBody,
    formatRating,
    isReviewSubmittable,
    reviewCountLabel,
} from './reviewUtils.js';

test('formatRating shows one decimal and hides a missing rating', () => {
    assert.equal(formatRating(4.67), '4.7');
    assert.equal(formatRating('5.00'), '5.0');
    assert.equal(formatRating(3), '3.0');
    assert.equal(formatRating(null), null);
    assert.equal(formatRating(undefined), null);
    assert.equal(formatRating(''), null);
    assert.equal(formatRating('abc'), null);
});

test('reviewCountLabel pluralizes correctly', () => {
    assert.equal(reviewCountLabel(0), '0 reviews');
    assert.equal(reviewCountLabel(1), '1 review');
    assert.equal(reviewCountLabel(2), '2 reviews');
    assert.equal(reviewCountLabel(undefined), '0 reviews');
});

test('a review needs a whole rating from 1 to 5 and a comment within the limit', () => {
    assert.equal(isReviewSubmittable(5), true);
    assert.equal(isReviewSubmittable(1, 'ok'), true);
    assert.equal(isReviewSubmittable(0), false);
    assert.equal(isReviewSubmittable(6), false);
    assert.equal(isReviewSubmittable(3.5), false);
    assert.equal(isReviewSubmittable(null), false);
    assert.equal(isReviewSubmittable('5'), false);
    assert.equal(isReviewSubmittable(4, 'x'.repeat(MAX_COMMENT_LENGTH)), true);
    assert.equal(isReviewSubmittable(4, 'x'.repeat(MAX_COMMENT_LENGTH + 1)), false);
    // Kənar boşluqlar sayılmır (backend də trim edir)
    assert.equal(isReviewSubmittable(4, `${'x'.repeat(MAX_COMMENT_LENGTH)}   `), true);
});

test('buildReviewBody trims the comment and omits it when empty', () => {
    assert.deepEqual(buildReviewBody({ rating: 5, comment: '  Great work  ' }), { rating: 5, comment: 'Great work' });
    assert.deepEqual(buildReviewBody({ rating: 4, comment: '   ' }), { rating: 4 });
    assert.deepEqual(buildReviewBody({ rating: 4 }), { rating: 4 });
});
