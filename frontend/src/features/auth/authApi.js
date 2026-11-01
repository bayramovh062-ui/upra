import { baseApi } from '../../lib/baseApi';
import { setCredentials, updateUser } from './authSlice';

export const authApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        login: builder.mutation({
            query: (credentials) => ({
                url: '/auth/login',
                method: 'POST',
                body: credentials,
            }),
            async onQueryStarted(arg, { dispatch, queryFulfilled }) {
                try {
                    const { data } = await queryFulfilled;
                    dispatch(setCredentials({ token: data.token, user: data.user }));
                } catch (err) {
                    // Xətalar komponent səviyyəsində react-hot-toast ilə tutulur
                }
            },
        }),
        register: builder.mutation({
            query: (userData) => ({
                url: '/auth/register',
                method: 'POST',
                body: userData,
            }),
            async onQueryStarted(arg, { dispatch, queryFulfilled }) {
                try {
                    const { data } = await queryFulfilled;
                    dispatch(setCredentials({ token: data.token, user: data.user }));
                } catch (err) {
                    // Xətalar komponent səviyyəsində react-hot-toast ilə tutulur
                }
            },
        }),
        getMe: builder.query({
            query: () => '/auth/me',
            providesTags: ['Auth'],
        }),
    }),
});

export const { useLoginMutation, useRegisterMutation, useGetMeQuery } = authApi;

// Settings: ad dəyişmə və parol dəyişmə
export const settingsApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        updateMe: builder.mutation({
            query: (body) => ({ url: '/auth/update-me', method: 'PATCH', body }),
            async onQueryStarted(arg, { dispatch, queryFulfilled }) {
                try {
                    const { data } = await queryFulfilled;
                    dispatch(updateUser(data.user));
                } catch {
                    // Xəta komponentdə toast ilə göstərilir
                }
            },
        }),
        // Soft delete: parol tələb olunur. Aktiv müqavilə varsa backend 400 qaytarır
        deleteAccount: builder.mutation({
            query: (body) => ({ url: '/auth/me', method: 'DELETE', body }),
        }),
        updatePassword: builder.mutation({
            query: (body) => ({ url: '/auth/update-password', method: 'PATCH', body }),
        }),
    }),
});

export const { useUpdateMeMutation, useUpdatePasswordMutation, useDeleteAccountMutation } = settingsApi;