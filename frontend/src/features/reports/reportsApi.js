import { baseApi } from '../../lib/baseApi';

// İstifadəçi şikayəti. targetType: USER | CONTRACT | MILESTONE | JOB | MESSAGE
export const reportsApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        createReport: builder.mutation({
            query: (body) => ({ url: '/reports', method: 'POST', body }),
        }),
    }),
});

export const { useCreateReportMutation } = reportsApi;
