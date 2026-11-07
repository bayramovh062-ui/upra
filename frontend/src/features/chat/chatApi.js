import { baseApi } from '../../lib/baseApi';

export const MESSAGE_PAGE_SIZE = 50;
export const MAX_MESSAGE_LENGTH = 2000;

// Mesaj siyahısı cache-i yalnız söhbət id-sinə görə açarlanır (before kursoru açara daxil deyil):
// "köhnələri yüklə" eyni cache-ə əvvəldən əlavə edir, socket hadisələri isə sona əlavə edir.
const messagesKey = (id) => ({ id });
const serializeMessagesKey = ({ queryArgs }) => `conversation-${queryArgs.id}`;

// Mesajı id-yə görə təkrarsız cache-ə əlavə edir (öz mesajın həm cavabdan, həm socket-dən gəlir)
export const appendMessageToCache = (dispatch, conversationId, message) =>
    dispatch(
        chatApi.util.updateQueryData('getMessages', messagesKey(conversationId), (draft) => {
            // Cache hele yoxdursa (sehife achilmayib) hech ne etmirik
            if (!draft?.messages) return;
            if (!draft.messages.some((m) => m.id === message.id)) draft.messages.push(message);
        })
    );

export const chatApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        // Cavab: { conversations: [{ id, otherUser, lastMessage, lastMessageAt, unreadCount }] }
        getConversations: builder.query({
            query: () => '/conversations',
            providesTags: ['Conversation'],
        }),

        // Cavab: { unreadCount }. Sidebar nişanı
        getUnreadMessages: builder.query({
            query: () => '/conversations/unread-count',
            providesTags: ['Conversation'],
        }),

        // Cavab: { conversation }. Siyahıda olmayan (hələ mesajsız) söhbətin başlığı üçün də lazımdır
        getConversation: builder.query({
            query: (id) => `/conversations/${id}`,
            providesTags: (result, error, id) => [{ type: 'Conversation', id }],
        }),

        // arg: { id, before? }. Cavab: { messages (köhnədən yeniyə), hasMore }
        getMessages: builder.query({
            query: ({ id, before }) => ({
                url: `/conversations/${id}/messages`,
                params: { limit: MESSAGE_PAGE_SIZE, ...(before && { before }) },
            }),
            providesTags: (result, error, { id }) => [{ type: 'Message', id }],
            serializeQueryArgs: serializeMessagesKey,
            forceRefetch: ({ currentArg, previousArg }) => currentArg?.before !== previousArg?.before,
            merge: (cache, incoming, { arg }) => {
                if (arg?.before) {
                    // Köhnə səhifə: əvvələ əlavə et
                    const known = new Set(cache.messages.map((m) => m.id));
                    cache.messages.unshift(...incoming.messages.filter((m) => !known.has(m.id)));
                    cache.hasMore = incoming.hasMore;
                } else {
                    // Təzə yükləmə: ən son səhifə ilə əvəz olunur
                    cache.messages = incoming.messages;
                    cache.hasMore = incoming.hasMore;
                }
            },
        }),

        // Qarşı tərəflə söhbəti açır və ya mövcudunu qaytarır. arg: qarşı tərəfin userId-si
        openConversation: builder.mutation({
            query: (userId) => ({ url: '/conversations', method: 'POST', body: { userId } }),
        }),

        // arg: { id, body }
        sendMessage: builder.mutation({
            query: ({ id, body }) => ({ url: `/conversations/${id}/messages`, method: 'POST', body: { body } }),
            async onQueryStarted({ id }, { dispatch, queryFulfilled }) {
                try {
                    const { data } = await queryFulfilled;
                    appendMessageToCache(dispatch, id, data.message);
                } catch {
                    // Xətanı çağıran tərəf göstərir (toast)
                }
            },
            // Siyahıda söhbət yuxarı qalxsın, sonuncu mesaj yenilənsin
            invalidatesTags: ['Conversation'],
        }),

        // arg: söhbət id-si
        markConversationRead: builder.mutation({
            query: (id) => ({ url: `/conversations/${id}/read`, method: 'PATCH' }),
            invalidatesTags: ['Conversation'],
        }),
    }),
});

export const {
    useGetConversationsQuery,
    useGetUnreadMessagesQuery,
    useGetConversationQuery,
    useGetMessagesQuery,
    useOpenConversationMutation,
    useSendMessageMutation,
    useMarkConversationReadMutation,
} = chatApi;
