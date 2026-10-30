import { baseApi } from '../../lib/baseApi';

// Cache etiketləri:
//   { type: 'Job', id: '<jobId>' }  → tək elan
//   { type: 'Job', id: 'LIST' }     → public siyahı (GET /jobs)
//   { type: 'Job', id: 'MY' }       → müştərinin öz elanları
const listTags = (result, id) => [
    ...(result?.jobs ?? []).map((job) => ({ type: 'Job', id: job.id })),
    { type: 'Job', id },
];

export const jobsApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        // params: { page, limit, search, sort, minBudget, maxBudget }
        getJobs: builder.query({
            query: (params) => ({ url: '/jobs', params }),
            providesTags: (result) => listTags(result, 'LIST'),
        }),

        // cavab: { job, myProposal }
        getJob: builder.query({
            query: (id) => `/jobs/${id}`,
            providesTags: (result, error, id) => [{ type: 'Job', id }],
        }),

        getMyJobs: builder.query({
            query: () => '/jobs/my',
            providesTags: (result) => listTags(result, 'MY'),
        }),

        createJob: builder.mutation({
            query: (body) => ({ url: '/jobs', method: 'POST', body }),
            invalidatesTags: [
                { type: 'Job', id: 'LIST' },
                { type: 'Job', id: 'MY' },
            ],
        }),

        // arg: { id, title?, description?, budget? }
        updateJob: builder.mutation({
            query: ({ id, ...body }) => ({ url: `/jobs/${id}`, method: 'PATCH', body }),
            invalidatesTags: (result, error, { id }) => [
                { type: 'Job', id },
                { type: 'Job', id: 'LIST' },
                { type: 'Job', id: 'MY' },
            ],
        }),

        // Backend fiziki silmir, statusu CANCELLED edir
        deleteJob: builder.mutation({
            query: (id) => ({ url: `/jobs/${id}`, method: 'DELETE' }),
            invalidatesTags: (result, error, id) => [
                { type: 'Job', id },
                { type: 'Job', id: 'LIST' },
                { type: 'Job', id: 'MY' },
            ],
        }),
    }),
});

export const {
    useGetJobsQuery,
    useGetJobQuery,
    useGetMyJobsQuery,
    useCreateJobMutation,
    useUpdateJobMutation,
    useDeleteJobMutation,
} = jobsApi;
