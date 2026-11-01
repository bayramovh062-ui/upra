import { baseApi } from '../../lib/baseApi';

// Kateqoriya və bacarıq siyahıları (ictimai endpoint-lər). Filtrlər və formalar işlədir.
export const taxonomyApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        // cavab: { categories: [{ id, name, slug, openJobs }] }
        getCategories: builder.query({
            query: () => '/categories',
        }),

        // arg: { search?, limit? }. cavab: { skills: [{ id, name, slug }] } (ən çox işlənənlər əvvəldə)
        getSkills: builder.query({
            query: (params) => ({ url: '/skills', params }),
        }),
    }),
});

export const { useGetCategoriesQuery, useGetSkillsQuery } = taxonomyApi;
