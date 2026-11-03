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

        // Yalnız FREELANCER, yalnız ACTIVE → DELIVERED (lövhə read-only olur)
        deliverContract: builder.mutation({
            query: (id) => ({ url: `/contracts/${id}/deliver`, method: 'PATCH' }),
            invalidatesTags: (result, error, id) => [{ type: 'Contract', id }, { type: 'Contract', id: 'LIST' }],
        }),

        // Yalnız CLIENT, yalnız DELIVERED → ACTIVE ("dəyişiklik istəyirəm")
        reopenContract: builder.mutation({
            query: (id) => ({ url: `/contracts/${id}/reopen`, method: 'PATCH' }),
            invalidatesTags: (result, error, id) => [{ type: 'Contract', id }, { type: 'Contract', id: 'LIST' }],
        }),

        // Birbaşa ləğv: yalnız iş hələ başlamayıbsa (contract.workStarted === false), hər iki tərəf edə bilər
        cancelContract: builder.mutation({
            query: (id) => ({ url: `/contracts/${id}/cancel`, method: 'PATCH' }),
            invalidatesTags: (result, error, id) => [{ type: 'Contract', id }, { type: 'Contract', id: 'LIST' }, 'Job'],
        }),

        // İş başlayandan sonra ləğv təklifi. arg: { id, reason? }
        requestCancellation: builder.mutation({
            query: ({ id, reason }) => ({ url: `/contracts/${id}/cancel-request`, method: 'PATCH', body: { reason } }),
            invalidatesTags: (result, error, { id }) => [{ type: 'Contract', id }, { type: 'Contract', id: 'LIST' }],
        }),

        // Digər tərəf qəbul edir: müqavilə və iş CANCELLED olur
        acceptCancellation: builder.mutation({
            query: (id) => ({ url: `/contracts/${id}/cancel-request/accept`, method: 'PATCH' }),
            invalidatesTags: (result, error, id) => [{ type: 'Contract', id }, { type: 'Contract', id: 'LIST' }, 'Job'],
        }),

        // Digər tərəf rədd edir: müqavilə davam edir
        declineCancellation: builder.mutation({
            query: (id) => ({ url: `/contracts/${id}/cancel-request/decline`, method: 'PATCH' }),
            invalidatesTags: (result, error, id) => [{ type: 'Contract', id }, { type: 'Contract', id: 'LIST' }],
        }),

        // Göndərən özü geri çəkir
        withdrawCancellation: builder.mutation({
            query: (id) => ({ url: `/contracts/${id}/cancel-request/withdraw`, method: 'PATCH' }),
            invalidatesTags: (result, error, id) => [{ type: 'Contract', id }, { type: 'Contract', id: 'LIST' }],
        }),
    }),
});

export const {
    useCreateContractMutation,
    useGetMyContractsQuery,
    useGetContractQuery,
    useCompleteContractMutation,
    useCancelContractMutation,
    useRequestCancellationMutation,
    useAcceptCancellationMutation,
    useDeclineCancellationMutation,
    useWithdrawCancellationMutation,
    useDeliverContractMutation,
    useReopenContractMutation,
} = contractsApi;
