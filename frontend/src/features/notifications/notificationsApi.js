import { baseApi } from '../../lib/baseApi';

// Zəng paneli 30, "hamısı" səhifəsi 100 bildiriş çəkir. Hər ikisi ayrı cache açarıdır,
// ona görə optimistik yeniləmə və socket hər iki cache-ə yazır (olmayan açara yazmaq heç nə etmir).
export const BELL_LIMIT = 30;
export const PAGE_LIMIT = 100;
const LIMITS = [BELL_LIMIT, PAGE_LIMIT];

export const patchNotificationCaches = (dispatch, recipe) =>
    LIMITS.forEach((limit) => dispatch(notificationsApi.util.updateQueryData('getNotifications', limit, recipe)));

export const notificationsApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        // Cavab: { notifications, unreadCount } (ən yenilər əvvəldə). unreadCount limitdən asılı deyil
        getNotifications: builder.query({
            query: (limit = BELL_LIMIT) => `/notifications?limit=${limit}`,
            providesTags: ['Notification'],
        }),

        // Optimistik: kliklə dərhal oxunmuş görünür, xəta olsa siyahı yenidən çəkilir
        markNotificationRead: builder.mutation({
            query: (id) => ({ url: `/notifications/${id}/read`, method: 'PATCH' }),
            async onQueryStarted(id, { dispatch, queryFulfilled }) {
                patchNotificationCaches(dispatch, (draft) => {
                    const item = draft.notifications.find((n) => n.id === id);
                    if (item && !item.readAt) {
                        item.readAt = new Date().toISOString();
                        draft.unreadCount = Math.max(0, draft.unreadCount - 1);
                    }
                });
                try {
                    await queryFulfilled;
                } catch {
                    dispatch(baseApi.util.invalidateTags(['Notification']));
                }
            },
        }),

        markAllNotificationsRead: builder.mutation({
            query: () => ({ url: '/notifications/read-all', method: 'PATCH' }),
            async onQueryStarted(arg, { dispatch, queryFulfilled }) {
                patchNotificationCaches(dispatch, (draft) => {
                    const now = new Date().toISOString();
                    draft.notifications.forEach((n) => {
                        if (!n.readAt) n.readAt = now;
                    });
                    draft.unreadCount = 0;
                });
                try {
                    await queryFulfilled;
                } catch {
                    dispatch(baseApi.util.invalidateTags(['Notification']));
                }
            },
        }),
    }),
});

export const {
    useGetNotificationsQuery,
    useMarkNotificationReadMutation,
    useMarkAllNotificationsReadMutation,
} = notificationsApi;
