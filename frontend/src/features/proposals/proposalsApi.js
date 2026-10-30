import { baseApi } from '../../lib/baseApi';

// Faza 2-də yalnız elan səhifəsindəki "Submit proposal" üçün lazım olan endpoint var.
// Qalan endpoint-lər (my, job/:jobId, update, delete) Faza 3-də bura əlavə olunacaq.
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
    }),
});

export const { useCreateProposalMutation } = proposalsApi;
