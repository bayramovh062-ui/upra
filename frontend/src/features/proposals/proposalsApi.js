import { baseApi } from '../../lib/baseApi';

export const proposalsApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        // arg: { jobPostId, coverLetter, bidAmount }
        createProposal: builder.mutation({
            query: (body) => ({ url: '/proposals', method: 'POST', body }),
            // Elan yenidən çəkilir ki, getJob cavabındakı myProposal və təklif sayı yenilənsin
            invalidatesTags: (result, error, { jobPostId }) => [
                { type: 'Job', id: jobPostId },
                { type: 'Job', id: 'LIST' },
                { type: 'Proposal', id: 'MY' },
            ],
        }),

        // Frilanserin öz təkliflərı
        getMyProposals: builder.query({
            query: () => '/proposals/my',
            providesTags: [{ type: 'Proposal', id: 'MY' }],
        }),

        // Client: öz elanına gələn təkliflər
        getJobProposals: builder.query({
            query: (jobId) => `/proposals/job/${jobId}`,
            providesTags: (result, error, jobId) => [{ type: 'Proposal', id: `JOB-${jobId}` }],
        }),

        // arg: { id, jobPostId, coverLetter?, bidAmount? }
        updateProposal: builder.mutation({
            query: ({ id, coverLetter, bidAmount }) => ({
                url: `/proposals/${id}`,
                method: 'PATCH',
                body: { coverLetter, bidAmount },
            }),
            invalidatesTags: (result, error, { jobPostId }) => [
                { type: 'Job', id: jobPostId },
                { type: 'Proposal', id: 'MY' },
            ],
        }),

        // Geri çəkmə (yalnız PENDING). arg: { id, jobPostId }
        deleteProposal: builder.mutation({
            query: ({ id }) => ({ url: `/proposals/${id}`, method: 'DELETE' }),
            invalidatesTags: (result, error, { jobPostId }) => [
                { type: 'Job', id: jobPostId },
                { type: 'Job', id: 'LIST' },
                { type: 'Proposal', id: 'MY' },
            ],
        }),
    }),
});

export const {
    useCreateProposalMutation,
    useGetMyProposalsQuery,
    useGetJobProposalsQuery,
    useUpdateProposalMutation,
    useDeleteProposalMutation,
} = proposalsApi;
