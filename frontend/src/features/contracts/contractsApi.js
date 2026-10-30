import { baseApi } from '../../lib/baseApi';

export const contractsApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        // Təklifi qəbul et: backend bir tranzaksiyada contract + board yaradır,
        // digər təklifləri REJECTED, işi IN_PROGRESS edir. arg: { proposalId }
        createContract: builder.mutation({
            query: ({ proposalId }) => ({ url: '/contracts', method: 'POST', body: { proposalId } }),
            invalidatesTags: [
                { type: 'Job', id: 'LIST' },
                { type: 'Job', id: 'MY' },
                'Proposal',
                'Contract',
            ],
        }),
    }),
});

export const { useCreateContractMutation } = contractsApi;
