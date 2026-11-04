import { baseApi } from '../../lib/baseApi';

// Bütün məbləğlər USD sentlə tam ədəddir (backend ilə eyni). Ekranda formatCents ilə göstərilir.
export const walletApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        // Cavab: { wallet: { availableCents, lockedCents, currency }, transactions: [son 20 ledger yazısı] }
        getWallet: builder.query({
            query: () => '/wallet',
            providesTags: ['Wallet'],
        }),

        // DEMO: real ödəniş yoxdur. arg: { amountCents } (bir sorğuya maksimum 500000 sent)
        topUpWallet: builder.mutation({
            query: ({ amountCents }) => ({ url: '/wallet/topup', method: 'POST', body: { amountCents } }),
            invalidatesTags: ['Wallet'],
        }),

        // DEMO: yalnız kilidsiz (available) balansdan. arg: { amountCents }
        withdrawFromWallet: builder.mutation({
            query: ({ amountCents }) => ({ url: '/wallet/withdraw', method: 'POST', body: { amountCents } }),
            invalidatesTags: ['Wallet'],
        }),
    }),
});

export const { useGetWalletQuery, useTopUpWalletMutation, useWithdrawFromWalletMutation } = walletApi;
