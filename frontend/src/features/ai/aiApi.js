import { baseApi } from '../../lib/baseApi';

// AI köməkçisi. Server vəziyyətsizdir: hər sorğuda son mesajlar göndərilir.
export const aiApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        // Cavab: { enabled, dailyLimit, remainingToday }
        getAiStatus: builder.query({
            query: () => '/ai/status',
            providesTags: ['AiStatus'],
        }),

        // arg: { messages, locale, context? }. Cavab: { reply, remainingToday }
        sendAiMessage: builder.mutation({
            query: (body) => ({ url: '/ai/chat', method: 'POST', body }),
            invalidatesTags: ['AiStatus'],
        }),

        // arg: { id, messages, locale }. Yalnız ADMIN. Cavab: { reply, remainingToday }
        sendDisputeAiMessage: builder.mutation({
            query: ({ id, ...body }) => ({ url: `/ai/disputes/${id}/chat`, method: 'POST', body }),
        }),
    }),
});

export const { useGetAiStatusQuery, useSendAiMessageMutation, useSendDisputeAiMessageMutation } = aiApi;
