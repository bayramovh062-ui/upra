// Rəy üçün sabitlər və təmiz köməkçilər (backend: reviewValidator.js ilə eyni qaydalar).
import { formatNumber, translate } from '../../i18n/index.js';

export const MAX_COMMENT_LENGTH = 1000;

// Backend orta reytinqi 2 onluqla qaytarır (4.67). Ekranda 1 onluq göstərilir (4.7). Rəy yoxdursa null.
export const formatRating = (avgRating) => {
    if (avgRating === null || avgRating === undefined || avgRating === '') return null;
    const num = Number(avgRating);
    if (!Number.isFinite(num)) return null;
    return formatNumber(num, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
};

export const reviewCountLabel = (count) => translate('reviews.count', { count: Number(count) || 0 });

// Göndər düyməsi: 1..5 tam ədəd və şərh limiti keçilməyib
export const isReviewSubmittable = (rating, comment = '') =>
    Number.isInteger(rating) && rating >= 1 && rating <= 5 && String(comment).trim().length <= MAX_COMMENT_LENGTH;

// Backend-ə göndərilən gövdə: boş şərh göndərilmir
export const buildReviewBody = ({ rating, comment }) => {
    const trimmed = String(comment ?? '').trim();
    return trimmed ? { rating, comment: trimmed } : { rating };
};
