import { useState } from 'react';
import { useDispatch } from 'react-redux';
import toast from 'react-hot-toast';
import { Button, Modal, Textarea } from '../../components/ui';
import { baseApi } from '../../lib/baseApi';
import { getErrorMessage } from '../../lib/format';
import { useTranslation } from '../locale/useTranslation';
import { StarRatingInput } from './StarRating';
import { useCreateContractReviewMutation } from './reviewsApi';
import { MAX_COMMENT_LENGTH, isReviewSubmittable } from './reviewUtils';

// Tərcümə mətnindəki {{name}} / {{job}} yer tutucularını qalın mətnlə əvəz edir.
// Beləliklə söz sırası dillər arasında fərqli olsa da vurğulama qorunur.
const withEmphasis = (template, { name, job }) => {
    const parts = String(template).split(/(\{\{name\}\}|\{\{job\}\})/);
    return parts.map((part, index) => {
        if (part === '{{name}}') {
            return (
                <span key={index} className="font-semibold text-on-surface">
                    {name}
                </span>
            );
        }
        if (part === '{{job}}') {
            return (
                <span key={index} className="break-words font-semibold text-on-surface">
                    {job}
                </span>
            );
        }
        return part;
    });
};

// Müqavilə bitəndən sonra qarşı tərəfə qiymət və şərh. Rəy göndəriləndən sonra dəyişdirilə bilmir.
const ReviewModal = ({ open, onClose, contractId, revieweeName, jobTitle }) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [createReview, { isLoading }] = useCreateContractReviewMutation();

    const otherName = revieweeName || t('reviews.otherParty');

    const reset = () => {
        setRating(0);
        setComment('');
    };

    const close = () => {
        if (isLoading) return;
        reset();
        onClose();
    };

    const submit = async () => {
        try {
            await createReview({ contractId, rating, comment }).unwrap();
            toast.success(t('reviews.modal.submitted'));
            reset();
            onClose();
        } catch (err) {
            toast.error(getErrorMessage(err, t('reviews.modal.submitError')));
            // 409: rəy artıq yazılıb (başqa tab/cihaz). Siyahı təzələnsin, pəncərə bağlansın
            if (err?.status === 409) {
                dispatch(baseApi.util.invalidateTags([{ type: 'Review', id: contractId }]));
                reset();
                onClose();
            }
        }
    };

    const intro = jobTitle
        ? t('reviews.modal.introWithJob', { name: otherName, job: jobTitle })
        : t('reviews.modal.introName', { name: otherName });

    return (
        <Modal
            open={open}
            onClose={close}
            title={t('reviews.modal.title')}
            footer={
                <>
                    <Button variant="secondary" onClick={close} disabled={isLoading}>
                        {t('reviews.modal.later')}
                    </Button>
                    <Button onClick={submit} loading={isLoading} disabled={!isReviewSubmittable(rating, comment)}>
                        {t('reviews.modal.submit')}
                    </Button>
                </>
            }
        >
            <p className="mb-4 text-body-md text-secondary">
                {withEmphasis(intro, { name: otherName, job: jobTitle })}
            </p>

            <div className="mb-1 flex flex-col items-start gap-1">
                <StarRatingInput value={rating} onChange={setRating} disabled={isLoading} />
                <p className="min-h-5 text-label-md text-secondary" aria-live="polite">
                    {rating ? t(`reviews.rating.${rating}`) : t('reviews.selectRating')}
                </p>
            </div>

            <Textarea
                className="mt-3"
                label={t('reviews.modal.commentLabel')}
                rows={4}
                maxLength={MAX_COMMENT_LENGTH}
                value={comment}
                disabled={isLoading}
                onChange={(e) => setComment(e.target.value)}
                hint={t('reviews.modal.commentHint', {
                    name: otherName,
                    count: comment.length,
                    max: MAX_COMMENT_LENGTH,
                })}
            />
        </Modal>
    );
};

export default ReviewModal;
