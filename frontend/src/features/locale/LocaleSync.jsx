import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { selectLocale } from './localeSlice';

// Redux-dakı dili <html lang> atributuna və sənədə tətbiq edir.
// Tema sinxronizasiyasından (ThemeSync) tam asılısızdır.
const LocaleSync = () => {
    const locale = useSelector(selectLocale);

    useEffect(() => {
        document.documentElement.lang = locale;
    }, [locale]);

    return null;
};

export default LocaleSync;
