import { createSlice } from '@reduxjs/toolkit';
import { DEFAULT_LOCALE, isLocale, setActiveLocale } from '../../i18n';

export const LOCALE_STORAGE_KEY = 'upra-locale';

// İlkin dil: əvvəl istifadəçinin seçimi, yoxsa standart (ingilis).
// Seçim yalnız istifadəçi dəyişdirdikdə localStorage-a yazılır; tema ilə əlaqəsi yoxdur.
export const getInitialLocale = () => {
    if (typeof window === 'undefined') return DEFAULT_LOCALE;
    try {
        const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
        if (isLocale(stored)) return stored;
    } catch {
        // localStorage əlçatmaz ola bilər (məs. məhdud gizli rejim)
    }
    return DEFAULT_LOCALE;
};

const initialLocale = getInitialLocale();
// React-dan kənar köməkçilər (format.js, socket mesajları) üçün aktiv dili dərhal təyin et.
setActiveLocale(initialLocale);

const localeSlice = createSlice({
    name: 'locale',
    initialState: { locale: initialLocale },
    reducers: {
        setLocale: (state, action) => {
            const next = isLocale(action.payload) ? action.payload : DEFAULT_LOCALE;
            state.locale = next;
            setActiveLocale(next);
        },
    },
});

export const { setLocale } = localeSlice.actions;

export const selectLocale = (state) => state.locale.locale;

export default localeSlice.reducer;
