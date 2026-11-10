import { useState } from 'react';
import { useDispatch } from 'react-redux';
import toast from 'react-hot-toast';
import { Button, Modal, Textarea } from '../../components/ui';
import { baseApi } from '../../lib/baseApi';
import { getErrorMessage } from '../../lib/format';
import { StarRatingInput } from './StarRating';
import { useCreateContractReviewMutation } from './reviewsApi';
import { MAX_COMMENT_LENGTH, RATING_LABELS, isReviewSubmittable } from './reviewUtils';

// Müqavilə bitəndən sonra qarşı tərəfə qiymət və şərh. Rəy göndəriləndən sonra dəyişdirilə bilmir.
const ReviewModal = ({ open, onClose, contractId, revieweeName, jobTitle }) => {
    const dispatch = useDispatch();
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [createReview, { isLoading }] = useCreateContractReviewMutation();

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
            toast.success('Thanks! Your review was submitted.');
            reset();
            onClose();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not submit your review'));
            // 409: rəy artıq yazılıb (başqa tab/cihaz). Siyahı təzələnsin, pəncərə bağlansın
            if (err?.status === 409) {
                dispatch(baseApi.util.invalidateTags([{ type: 'Review', id: contractId }]));
                reset();
                onClose();
            }
        }
    };

    return (
        <Modal
            open={open}
            onClose={close}
            title="Rate your experience"
            footer={
                <>
                    <Button variant="secondary" onClick={close} disabled={isLoading}>
                        Maybe later
                    </Button>
                    <Button onClick={submit} loading={isLoading} disabled={!isReviewSubmittable(rating, comment)}>
                        Submit review
                    </Button>
                </>
            }
        >
            <p className="mb-4 text-body-md text-secondary">
                How was working with <span className="font-semibold text-on-surface">{revieweeName || 'the other party'}</span>
                {jobTitle ? (
                    <>
                        {' '}
                        on <span className="break-words font-semibold text-on-surface">{jobTitle}</span>
                    </>
                ) : null}
                ? Your rating counts toward their profile score. Reviews cannot be edited or deleted after you submit them.
            </p>

            <div className="mb-1 flex flex-col items-start gap-1">
                <StarRatingInput value={rating} onChange={setRating} disabled={isLoading} />
                <p className="min-h-5 text-label-md text-secondary" aria-live="polite">
                    {rating ? RATING_LABELS[rating] : 'Select a rating'}
                </p>
            </div>

            <Textarea
                className="mt-3"
                label="Comment (optional)"
                rows={4}
                maxLength={MAX_COMMENT_LENGTH}
                value={comment}
                disabled={isLoading}
                onChange={(e) => setComment(e.target.value)}
                hint={`Only you and ${revieweeName || 'the other party'} can read your comment. ${comment.length}/${MAX_COMMENT_LENGTH}`}
            />
        </Modal>
    );
};

export default ReviewModal;
