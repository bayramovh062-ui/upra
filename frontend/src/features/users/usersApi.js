import { baseApi } from '../../lib/baseApi';

// İctimai profil: GET /users/:id -> { user, stats }. Gizli profildə user yalnız { id, fullName, role, profilePublic: false }
export const usersApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getUserProfile: builder.query({
            query: (id) => `/users/${id}`,
            providesTags: (result, error, id) => [{ type: 'User', id }],
        }),
    }),
});

export const { useGetUserProfileQuery } = usersApi;
