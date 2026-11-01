import { baseApi } from '../../lib/baseApi';

const listTag = (contractId) => ({ type: 'Issue', id: `C-${contractId}` });

export const issuesApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        // Cavab: { issues } (createdBy, assignee, comments daxil), status və position üzrə sıralı
        getIssues: builder.query({
            query: (contractId) => `/contracts/${contractId}/issues`,
            providesTags: (result, error, contractId) => [listTag(contractId)],
        }),

        // arg: { contractId, title, description?, priority?, assigneeId? }
        createIssue: builder.mutation({
            query: ({ contractId, ...body }) => ({
                url: `/contracts/${contractId}/issues`,
                method: 'POST',
                body,
            }),
            invalidatesTags: (result, error, { contractId }) => [listTag(contractId)],
        }),

        // arg: { id, contractId, title?, description?, priority?, assigneeId? (null = unassign) }
        updateIssue: builder.mutation({
            query: ({ id, contractId, ...body }) => ({ url: `/issues/${id}`, method: 'PATCH', body }),
            invalidatesTags: (result, error, { contractId }) => [listTag(contractId)],
        }),

        // arg: { id, contractId, status, position }
        // Optimistic: kart dərhal yeni yerə düşür, xəta olsa geri qayıdır.
        // Backend move cavabında assignee/comments yoxdur, ona görə cavabı köhnə obyektlə birləşdiririk.
        moveIssue: builder.mutation({
            query: ({ id, status, position }) => ({
                url: `/issues/${id}/move`,
                method: 'PATCH',
                body: { status, position },
            }),
            async onQueryStarted({ id, contractId, status, position }, { dispatch, queryFulfilled }) {
                const patch = dispatch(
                    issuesApi.util.updateQueryData('getIssues', contractId, (draft) => {
                        const issue = draft.issues.find((i) => i.id === id);
                        if (issue) {
                            issue.status = status;
                            issue.position = position;
                        }
                    }),
                );
                try {
                    const { data } = await queryFulfilled;
                    dispatch(
                        issuesApi.util.updateQueryData('getIssues', contractId, (draft) => {
                            const issue = draft.issues.find((i) => i.id === id);
                            if (issue && data?.issue) Object.assign(issue, data.issue);
                        }),
                    );
                } catch {
                    patch.undo();
                }
            },
        }),

        // arg: { id, contractId, body }
        addComment: builder.mutation({
            query: ({ id, body }) => ({ url: `/issues/${id}/comments`, method: 'POST', body: { body } }),
            invalidatesTags: (result, error, { contractId }) => [listTag(contractId)],
        }),
    }),
});

export const {
    useGetIssuesQuery,
    useCreateIssueMutation,
    useUpdateIssueMutation,
    useMoveIssueMutation,
    useAddCommentMutation,
} = issuesApi;
