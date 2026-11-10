import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectTheme, setTheme, THEME_STORAGE_KEY } from './themeSlice';

// Redux-dakı tema vəziyyətini <html> elementinə tətbiq edir.
// İlkin boyama üçün index.html-dəki inline skript var; bu komponent naviqasiya
// və toggle sonrası sinfi sinxronlaşdırır.
const ThemeSync = () => {
    const mode = useSelector(selectTheme);
    const dispatch = useDispatch();

    useEffect(() => {
        const root = document.documentElement;
        const isDark = mode === 'dark';
        root.classList.toggle('dark', isDark);
        root.style.colorScheme = isDark ? 'dark' : 'light';
    }, [mode]);

    // İstifadəçi hələ seçim etməyibsə OS teması dəyişəndə tətbiq də dəyişsin.
    useEffect(() => {
        const media = window.matchMedia?.('(prefers-color-scheme: dark)');
        if (!media) return undefined;

        const onChange = (event) => {
            let hasStoredTheme = false;
            try {
                const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
                hasStoredTheme = stored === 'light' || stored === 'dark';
            } catch {
                // localStorage əlçatmazdırsa sistem temasını izləməyə davam et
            }
            if (!hasStoredTheme) dispatch(setTheme(event.matches ? 'dark' : 'light'));
        };

        media.addEventListener?.('change', onChange);
        return () => media.removeEventListener?.('change', onChange);
    }, [dispatch]);

    return null;
};

export default ThemeSync;
