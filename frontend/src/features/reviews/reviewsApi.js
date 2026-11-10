import { baseApi } from '../../lib/baseApi';
import { buildReviewBody } from './reviewUtils';

// P3 rəy API-ı. Rəyi yalnız müqavilənin tərəfləri görür və yazır (backend yoxlayır).
export const reviewsApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        // Cavab: { reviews, eligibility: { canReview, alreadyReviewed, revieweeId, reason } }
        getContractReviews: builder.query({
            query: (contractId) => `/contracts/${contractId}/reviews`,
            providesTags: (result, error, contractId) => [{ type: 'Review', id: contractId }],
        }),

        // arg: { contractId, rating (1..5), comment? }. Rəy dəyişməzdir: redaktə/silmə yoxdur.
        createContractReview: builder.mutation({
            query: ({ contractId, rating, comment }) => ({
                url: `/contracts/${contractId}/reviews`,
                method: 'POST',
                body: buildReviewBody({ rating, comment }),
            }),
            // Rəy alanın ictimai profilindəki orta reytinq də dəyişir
            invalidatesTags: (result, error, { contractId }) => [
                { type: 'Review', id: contractId },
                ...(result?.review?.reviewee?.id ? [{ type: 'User', id: result.review.reviewee.id }] : []),
            ],
        }),
    }),
});

export const { useGetContractReviewsQuery, useCreateContractReviewMutation } = reviewsApi;
