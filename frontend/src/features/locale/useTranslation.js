import { useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    createTranslator,
    formatCurrency,
    formatDateFor,
    formatDateTimeFor,
    formatNumber,
    INTL_LOCALES,
    timeAgoFor,
    translateApiMessage,
} from '../../i18n';
import { LOCALE_STORAGE_KEY, selectLocale, setLocale } from './localeSlice';

// Komponentlərdə i18n üçün vahid giriş nöqtəsi.
// t(key, vars) → cari dilə tərcümə (interpolyasiya və cəm dəstəyi ilə)
// setLocale(code) → dili dəyişir və seçimi yadda saxlayır
export const useTranslation = () => {
    const locale = useSelector(selectLocale);
    const dispatch = useDispatch();

    const t = useMemo(() => createTranslator(locale), [locale]);

    const changeLocale = useCallback(
        (next) => {
            dispatch(setLocale(next));
            try {
                window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
            } catch {
                // Yaddaşa yazmaq mümkün olmasa da dil cari sessiyada işləyir
            }
        },
        [dispatch]
    );

    return {
        t,
        locale,
        setLocale: changeLocale,
        intlLocale: INTL_LOCALES[locale],
        formatNumber: (value, options) => formatNumber(value, options),
        formatCurrency: (value) => formatCurrency(value),
        formatDate: (value) => formatDateFor(value),
        formatDateTime: (value) => formatDateTimeFor(value),
        timeAgo: (value) => timeAgoFor(value),
        translateApiMessage: (message) => translateApiMessage(message),
    };
};

export default useTranslation;
