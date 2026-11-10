import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { logout } from '../features/auth/authSlice';

const rawBaseQuery = fetchBaseQuery({
    baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
    prepareHeaders: (headers, { getState }) => {
        const token = getState().auth.token || localStorage.getItem('token');
        if (token) {
            headers.set('Authorization', `Bearer ${token}`);
        }
        return headers;
    },
});

// P3: admin hesabı dayandırıb (backend 403 + "suspended" qaytarır). Sessiya artıq işləmir, ona görə 401 kimi çıxış edilir,
// yoxsa istifadəçi xəta verib-duran ekranda qalır. Login xətası üçün də zərərsizdir (artıq giriş edilməyib).
const isSuspendedError = (error) => error?.status === 403 && /suspended/i.test(error?.data?.message ?? '');

const baseQueryWithReauth = async (args, api, extraOptions) => {
    const result = await rawBaseQuery(args, api, extraOptions);
    if (result.error && (result.error.status === 401 || isSuspendedError(result.error))) {
        api.dispatch(logout());
    }
    return result;
};

export const baseApi = createApi({
    reducerPath: 'api',
    baseQuery: baseQueryWithReauth,
    tagTypes: ['Auth', 'Job', 'Proposal', 'Contract', 'Issue', 'User', 'Wallet', 'Notification', 'Conversation', 'Message', 'AdminDispute', 'AdminReport', 'AdminUser', 'Attachment', 'Review'],
    endpoints: () => ({}),
});