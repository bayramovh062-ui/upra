import { createSlice } from '@reduxjs/toolkit';

export const THEME_STORAGE_KEY = 'upra-theme';

// İlkin dəyər: əvvəl istifadəçinin seçimi, yoxsa sistem temayı.
// index.html-dəki erkən skript eyni məntiqi təkrarlayır ki, ilk boyamada yanlış tema görünməsin.
export const getInitialTheme = () => {
    if (typeof window === 'undefined') return 'light';
    try {
        const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
        if (stored === 'light' || stored === 'dark') return stored;
    } catch {
        // localStorage əlçatmaz ola bilər (məs. məhdud gizli rejim)
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const themeSlice = createSlice({
    name: 'theme',
    initialState: { mode: getInitialTheme() },
    reducers: {
        setTheme: (state, action) => {
            state.mode = action.payload === 'dark' ? 'dark' : 'light';
        },
        toggleTheme: (state) => {
            state.mode = state.mode === 'dark' ? 'light' : 'dark';
        },
    },
});

export const { setTheme, toggleTheme } = themeSlice.actions;
export const selectTheme = (state) => state.theme.mode;
export default themeSlice.reducer;
