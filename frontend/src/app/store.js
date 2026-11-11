import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from '../lib/baseApi';
import authReducer from '../features/auth/authSlice';
import themeReducer from '../features/theme/themeSlice';
import localeReducer from '../features/locale/localeSlice';

export const store = configureStore({
    reducer: {
        auth: authReducer,
        theme: themeReducer,
        locale: localeReducer,
        [baseApi.reducerPath]: baseApi.reducer,
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(baseApi.middleware),
});