import { baseApi } from '../../lib/baseApi';
import { setCredentials } from './authSlice';

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