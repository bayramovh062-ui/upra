import { baseApi } from '../../lib/baseApi';
import { updateUser } from '../auth/authSlice';

export const attachmentsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    uploadAvatar: builder.mutation({
      query: (file) => {
        const fd = new FormData();
        fd.append('file', file);
        return { url: '/attachments/avatar', method: 'POST', body: fd };
      },
      invalidatesTags: ['Auth'],
      async onQueryStarted(_arg, { dispatch, queryFulfilled, getState }) {
        try {
          const { data } = await queryFulfilled;
          const avatarUrl = data?.avatarUrl;
          if (avatarUrl) {
            const current = getState().auth.user;
            if (current) dispatch(updateUser({ ...current, avatarUrl }));
          }
        } catch {
          // error surfaced by caller
        }
      },
    }),
    uploadMilestoneFiles: builder.mutation({
      query: ({ milestoneId, files }) => {
        const fd = new FormData();
        [...files].forEach((f) => fd.append('files', f));
        return { url: `/attachments/milestones/${milestoneId}/files`, method: 'POST', body: fd };
      },
      invalidatesTags: (_r, _e, { contractId }) => (contractId ? [{ type: 'Contract', id: contractId }, { type: 'Contract', id: `history:${contractId}` }] : ['Contract']),
    }),
    uploadDisputeFiles: builder.mutation({
      query: ({ disputeId, files }) => {
        const fd = new FormData();
        [...files].forEach((f) => fd.append('files', f));
        return { url: `/attachments/disputes/${disputeId}/files`, method: 'POST', body: fd };
      },
      invalidatesTags: (_r, _e, { contractId }) => (contractId ? [{ type: 'Contract', id: contractId }, { type: 'Contract', id: `history:${contractId}` }, 'AdminDispute'] : ['AdminDispute']),
    }),
    uploadIssueFiles: builder.mutation({
      query: ({ issueId, files }) => {
        const fd = new FormData();
        [...files].forEach((f) => fd.append('files', f));
        return { url: `/attachments/issues/${issueId}/files`, method: 'POST', body: fd };
      },
      invalidatesTags: (_r, _e, { contractId }) => (contractId ? [{ type: 'Issue', id: `C-${contractId}` }] : ['Issue']),
    }),
    uploadCommentFiles: builder.mutation({
      query: ({ commentId, files }) => {
        const fd = new FormData();
        [...files].forEach((f) => fd.append('files', f));
        return { url: `/attachments/issue-comments/${commentId}/files`, method: 'POST', body: fd };
      },
      invalidatesTags: (_r, _e, { contractId }) => (contractId ? [{ type: 'Issue', id: `C-${contractId}` }] : ['Issue']),
    }),
    uploadReportFiles: builder.mutation({
      query: ({ reportId, files }) => {
        const fd = new FormData();
        [...files].forEach((f) => fd.append('files', f));
        return { url: `/attachments/reports/${reportId}/files`, method: 'POST', body: fd };
      },
    }),
  }),
});

export const {
  useUploadAvatarMutation,
  useUploadMilestoneFilesMutation,
  useUploadDisputeFilesMutation,
  useUploadIssueFilesMutation,
  useUploadCommentFilesMutation,
  useUploadReportFilesMutation,
} = attachmentsApi;
