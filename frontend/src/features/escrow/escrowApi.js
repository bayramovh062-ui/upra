import { baseApi } from '../../lib/baseApi';

// Mərhələ əməliyyatları. Hər birinin arg-ı: { id (mərhələ), contractId }.
// Müqavilə (milestones daxil) və pul kisəsi cache-i yenilənir. Backend hər əməliyyatı tək tranzaksiyada edir.
const refresh = (result, error, { contractId }) => [
    { type: 'Contract', id: contractId },
    { type: 'Contract', id: 'LIST' },
    'Wallet',
];

export const escrowApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        // CLIENT: PENDING -> FUNDED (pul available-dan locked-ə keçir)
        fundMilestone: builder.mutation({
            query: ({ id }) => ({ url: `/milestones/${id}/fund`, method: 'POST' }),
            invalidatesTags: refresh,
        }),

        // FREELANCER: FUNDED -> IN_REVIEW
        submitMilestone: builder.mutation({
            query: ({ id }) => ({ url: `/milestones/${id}/submit`, method: 'POST' }),
            invalidatesTags: refresh,
        }),

        // CLIENT: IN_REVIEW -> PAID (10% komissiya çıxılır, qalan frilanserin balansına keçir)
        approveMilestone: builder.mutation({
            query: ({ id }) => ({ url: `/milestones/${id}/approve`, method: 'POST' }),
            invalidatesTags: refresh,
        }),

        // CLIENT: IN_REVIEW -> FUNDED (pul escrow-da qalır)
        requestMilestoneChanges: builder.mutation({
            query: ({ id }) => ({ url: `/milestones/${id}/request-changes`, method: 'POST' }),
            invalidatesTags: refresh,
        }),
    }),
});

export const {
    useFundMilestoneMutation,
    useSubmitMilestoneMutation,
    useApproveMilestoneMutation,
    useRequestMilestoneChangesMutation,
} = escrowApi;
