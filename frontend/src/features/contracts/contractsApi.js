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
                'Job',
                'Proposal',
                'Contract',
            ],
        }),

        // Cavab: { contracts } (jobPost, proposal, client, freelancer, board daxil)
        getMyContracts: builder.query({
            query: () => '/contracts/my',
            providesTags: [{ type: 'Contract', id: 'LIST' }],
        }),

        // Cavab: { contract }
        getContract: builder.query({
            query: (id) => `/contracts/${id}`,
            providesTags: (result, error, id) => [{ type: 'Contract', id }],
        }),

        // Yalnız CLIENT, yalnız ACTIVE. İş statusu da backend-də yenilənir
        completeContract: builder.mutation({
            query: (id) => ({ url: `/contracts/${id}/complete`, method: 'PATCH' }),
            invalidatesTags: (result, error, id) => [{ type: 'Contract', id }, { type: 'Contract', id: 'LIST' }, 'Job'],
        }),

        cancelContract: builder.mutation({
            query: (id) => ({ url: `/contracts/${id}/cancel`, method: 'PATCH' }),
            invalidatesTags: (result, error, id) => [{ type: 'Contract', id }, { type: 'Contract', id: 'LIST' }, 'Job'],
        }),
    }),
});

export const {
    useCreateContractMutation,
    useGetMyContractsQuery,
    useGetContractQuery,
    useCompleteContractMutation,
    useCancelContractMutation,
} = contractsApi;
