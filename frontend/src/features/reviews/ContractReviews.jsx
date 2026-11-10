import { Link } from 'react-router-dom';
import { Avatar, Button, Card, ErrorState, Icon, Skeleton } from '../../components/ui';
import { formatDate } from '../../lib/format';
import { StarRating } from './StarRating';
import { useGetContractReviewsQuery } from './reviewsApi';

const ReviewItem = ({ review, currentUserId }) => {
    const mine = review.reviewer?.id === currentUserId;

    return (
        <li className="flex gap-3 py-4 first:pt-0 last:pb-0">
            <Avatar name={review.reviewer?.fullName} src={review.reviewer?.avatarUrl} size="md" />
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-body-md font-medium text-on-surface">
                        {mine ? 'You' : review.reviewer?.fullName}
                    </span>
                    <span className="text-caption text-secondary">
                        reviewed {mine ? review.reviewee?.fullName : 'you'} · {formatDate(review.createdAt)}
                    </span>
                </div>
                <StarRating value={review.rating} sizeClass="text-[16px]" className="mt-0.5" />
                {review.comment ? (
                    <p className="mt-1 whitespace-pre-line break-words text-body-md text-on-surface">{review.comment}</p>
                ) : (
                    <p className="mt-1 text-body-md text-secondary">No comment.</p>
                )}
            </div>
        </li>
    );
};

// Bitmiş müqavilədə: rəy yazmaq üçün çağırış və iki tərəfin rəyləri. Yalnız COMPLETED müqavilədə quraşdırılır.
const ContractReviews = ({ contractId, currentUserId, otherName, onWriteReview }) => {
    const { data, isLoading, isError, refetch } = useGetContractReviewsQuery(contractId);

    if (isLoading) return <Skeleton className="mb-6 h-28 w-full" />;
    if (isError) {
        return (
            <div className="mb-6">
                <ErrorState title="Could not load reviews" onRetry={refetch} />
            </div>
        );
    }

    const reviews = data?.reviews ?? [];
    const eligibility = data?.eligibility;

    return (
        <Card className="mb-6 p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-headline-sm text-on-surface">
                    <Icon name="star" filled className="text-[22px] text-amber-500" />
                    Reviews
                </h2>
                {eligibility?.canReview && (
                    <Button size="sm" onClick={onWriteReview}>
                        <Icon name="rate_review" className="text-[16px]" />
                        Review {otherName || 'the other party'}
                    </Button>
                )}
            </div>

            {eligibility?.canReview && (
                <p className="mb-4 rounded-lg bg-info-soft px-3 py-2 text-label-md text-info-ink">
                    This contract is completed. Share how it went with {otherName || 'the other party'}: your rating
                    appears in their profile score.
                </p>
            )}

            {reviews.length > 0 ? (
                <ul className="divide-y divide-line">
                    {reviews.map((review) => (
                        <ReviewItem key={review.id} review={review} currentUserId={currentUserId} />
                    ))}
                </ul>
            ) : (
                <p className="text-body-md text-secondary">No reviews yet for this contract.</p>
            )}

            {eligibility?.alreadyReviewed && reviews.length === 1 && (
                <p className="mt-3 text-caption text-secondary">
                    Waiting for {otherName || 'the other party'} to leave their review.{' '}
                    {eligibility.revieweeId && (
                        <Link to={`/users/${eligibility.revieweeId}`} className="text-primary hover:underline">
                            View profile
                        </Link>
                    )}
                </p>
            )}
        </Card>
    );
};

export default ContractReviews;
