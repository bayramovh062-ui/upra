import { baseApi } from '../../lib/baseApi';

// Cache etiketləri:
//   { type: 'Job', id: '<jobId>' }  → tək elan
//   { type: 'Job', id: 'LIST' }     → public siyahı (GET /jobs)
//   { type: 'Job', id: 'MY' }       → müştərinin öz elanları
const listTags = (result, id) => [
    ...(result?.jobs ?? []).map((job) => ({ type: 'Job', id: job.id })),
    { type: 'Job', id },
];

// Bookmark basanda ürək dərhal dolsun: açıq olan bütün siyahı cache-lərində və elan səhifəsində isSaved dəyişir.
// Sorğu uğursuz olarsa qaytarılır (undo).
const patchSaved = (api, { dispatch, getState }, id, isSaved) => {
    const patches = [];
    for (const args of api.util.selectCachedArgsForQuery(getState(), 'getJobs')) {
        patches.push(
            dispatch(
                api.util.updateQueryData('getJobs', args, (draft) => {
                    const job = draft.jobs?.find((j) => j.id === id);
                    if (job) job.isSaved = isSaved;
                })
            )
        );
    }
    patches.push(
        dispatch(
            api.util.updateQueryData('getJob', id, (draft) => {
                if (draft?.job) draft.job.isSaved = isSaved;
            })
        )
    );
    return patches;
};

export const jobsApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        // params: { page, limit, sort, search, minBudget, maxBudget, tab, category, experienceLevel,
        //           skills, skillsMode, paymentStructure }
        // cavab: { jobs, pagination, tabCounts? }. Giriş edən frilanser üçün hər işdə isSaved və matchScore var.
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

        // Yalnız FREELANCER. arg: jobId
        saveJob: builder.mutation({
            query: (id) => ({ url: `/jobs/${id}/save`, method: 'POST' }),
            async onQueryStarted(id, ctx) {
                const patches = patchSaved(jobsApi, ctx, id, true);
                try {
                    await ctx.queryFulfilled;
                } catch {
                    patches.forEach((patch) => patch.undo());
                }
            },
            // Saved tab-ının sayı və siyahısı yenilənsin
            invalidatesTags: [{ type: 'Job', id: 'LIST' }],
        }),

        unsaveJob: builder.mutation({
            query: (id) => ({ url: `/jobs/${id}/save`, method: 'DELETE' }),
            async onQueryStarted(id, ctx) {
                const patches = patchSaved(jobsApi, ctx, id, false);
                try {
                    await ctx.queryFulfilled;
                } catch {
                    patches.forEach((patch) => patch.undo());
                }
            },
            invalidatesTags: [{ type: 'Job', id: 'LIST' }],
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
    useSaveJobMutation,
    useUnsaveJobMutation,
} = jobsApi;
