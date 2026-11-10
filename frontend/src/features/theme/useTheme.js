import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectTheme, setTheme, THEME_STORAGE_KEY } from './themeSlice';

// Yalnız istifadəçi seçimi localStorage-a yazılır. Sistem temayı ilə gələn ilkin
// dəyər yazılmır ki, sonradan OS teması dəyişəndə tətbiq onu izləyə bilsin.
const useTheme = () => {
    const mode = useSelector(selectTheme);
    const dispatch = useDispatch();

    const setMode = useCallback(
        (next) => {
            const value = next === 'dark' ? 'dark' : 'light';
            dispatch(setTheme(value));
            try {
                window.localStorage.setItem(THEME_STORAGE_KEY, value);
            } catch {
                // Yaddaşa yazmaq mümkün olmasa da tema cari sessiyada işləyir
            }
        },
        [dispatch]
    );

    const toggle = useCallback(() => {
        setMode(mode === 'dark' ? 'light' : 'dark');
    }, [mode, setMode]);

    return { mode, isDark: mode === 'dark', setMode, toggle };
};

export default useTheme;
