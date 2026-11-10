// Rəy üçün sabitlər və təmiz köməkçilər (backend: reviewValidator.js ilə eyni qaydalar).
export const MAX_COMMENT_LENGTH = 1000;

export const RATING_LABELS = {
    1: 'Poor',
    2: 'Fair',
    3: 'Good',
    4: 'Very good',
    5: 'Excellent',
};

// Backend orta reytinqi 2 onluqla qaytarır (4.67). Ekranda 1 onluq göstərilir (4.7). Rəy yoxdursa null.
export const formatRating = (avgRating) => {
    if (avgRating === null || avgRating === undefined || avgRating === '') return null;
    const num = Number(avgRating);
    return Number.isFinite(num) ? num.toFixed(1) : null;
};

export const reviewCountLabel = (count) => {
    const n = Number(count) || 0;
    return `${n} ${n === 1 ? 'review' : 'reviews'}`;
};

// Göndər düyməsi: 1..5 tam ədəd və şərh limiti keçilməyib
export const isReviewSubmittable = (rating, comment = '') =>
    Number.isInteger(rating) && rating >= 1 && rating <= 5 && String(comment).trim().length <= MAX_COMMENT_LENGTH;

// Backend-ə göndərilən gövdə: boş şərh göndərilmir
export const buildReviewBody = ({ rating, comment }) => {
    const trimmed = String(comment ?? '').trim();
    return trimmed ? { rating, comment: trimmed } : { rating };
};
