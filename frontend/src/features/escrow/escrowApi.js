import { baseApi } from '../../lib/baseApi';

// Mərhələ əməliyyatları. Hər birinin arg-ı: { id (mərhələ), contractId }.
// Müqavilə (milestones daxil), tarixçə və pul kisəsi cache-i yenilənir.
// Backend hər əməliyyatı tək tranzaksiyada edir.
const refresh = (result, error, { contractId }) => [
    { type: 'Contract', id: contractId },
    { type: 'Contract', id: 'LIST' },
    // Eyni tag-i history query də istifadə edir: hər əməliyyatdan sonra tarixçə də yenilənir
    { type: 'Contract', id: `history:${contractId}` },
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

        // CLIENT: IN_REVIEW -> FUNDED (pul escrow-da qalır). arg: { id, contractId, note? }
        requestMilestoneChanges: builder.mutation({
            query: ({ id, note }) => ({ url: `/milestones/${id}/request-changes`, method: 'POST', body: { note } }),
            invalidatesTags: refresh,
        }),

        // Tərəflər: FUNDED/IN_REVIEW -> DISPUTED. arg: { id, contractId, reason, details? }
        openMilestoneDispute: builder.mutation({
            query: ({ id, reason, details }) => ({
                url: `/milestones/${id}/dispute`,
                method: 'POST',
                body: { reason, details },
            }),
            invalidatesTags: refresh,
        }),

        // Təhvil/dəyişiklik tarixçəsi + mübahisələr (tərəflər üçün)
        getContractHistory: builder.query({
            query: (contractId) => `/contracts/${contractId}/history`,
            providesTags: (result, error, contractId) => [{ type: 'Contract', id: `history:${contractId}` }],
        }),
    }),
});

export const {
    useFundMilestoneMutation,
    useSubmitMilestoneMutation,
    useApproveMilestoneMutation,
    useRequestMilestoneChangesMutation,
    useOpenMilestoneDisputeMutation,
    useGetContractHistoryQuery,
} = escrowApi;
