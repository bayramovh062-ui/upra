import { baseApi } from '../../lib/baseApi';

// Yalnız ADMIN rolu üçün. Backend də protect + restrictTo('ADMIN') ilə qoruyur.
export const adminApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getAdminDisputes: builder.query({
            query: (params = {}) => ({ url: '/admin/disputes', params }),
            providesTags: [{ type: 'AdminDispute', id: 'LIST' }],
        }),
        getAdminDispute: builder.query({
            query: (id) => `/admin/disputes/${id}`,
            providesTags: (result, error, id) => [{ type: 'AdminDispute', id }],
        }),
        resolveAdminDispute: builder.mutation({
            // contractId yalnız tag invalidasiyası üçündür, backend-ə göndərilmir
            query: ({ id, resolution, releaseCents, refundCents }) => ({
                url: `/admin/disputes/${id}/resolve`,
                method: 'PATCH',
                body: { resolution, releaseCents, refundCents },
            }),
            invalidatesTags: (result, error, { id, contractId }) => [
                { type: 'AdminDispute', id },
                { type: 'AdminDispute', id: 'LIST' },
                { type: 'Contract', id: contractId },
                { type: 'Contract', id: `history:${contractId}` },
                'Wallet',
            ],
        }),

        getAdminReports: builder.query({
            query: (params = {}) => ({ url: '/admin/reports', params }),
            providesTags: [{ type: 'AdminReport', id: 'LIST' }],
        }),
        reviewAdminReport: builder.mutation({
            query: ({ id, ...body }) => ({ url: `/admin/reports/${id}`, method: 'PATCH', body }),
            invalidatesTags: [{ type: 'AdminReport', id: 'LIST' }],
        }),

        // P3: istifadəçi moderasiyası. params: { q, role, suspended: 'true'|'false', limit, offset } -> { total, count, users }
        getAdminUsers: builder.query({
            query: (params = {}) => ({ url: '/admin/users', params }),
            providesTags: [{ type: 'AdminUser', id: 'LIST' }],
        }),
        // arg: { id, suspended: boolean, reason? }. Admin hesabı və öz hesabı backend-də qəbul olunmur.
        updateAdminUserSuspension: builder.mutation({
            query: ({ id, suspended, reason }) => ({
                url: `/admin/users/${id}/suspension`,
                method: 'PATCH',
                body: { suspended, reason },
            }),
            invalidatesTags: [{ type: 'AdminUser', id: 'LIST' }],
        }),
    }),
});

export const {
    useGetAdminDisputesQuery,
    useGetAdminDisputeQuery,
    useResolveAdminDisputeMutation,
    useGetAdminReportsQuery,
    useReviewAdminReportMutation,
    useGetAdminUsersQuery,
    useUpdateAdminUserSuspensionMutation,
} = adminApi;
