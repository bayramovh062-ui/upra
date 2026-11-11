import { DICTIONARIES } from './messages/index.js';

export const DEFAULT_LOCALE = 'en';

export const LOCALES = [
    { code: 'en', label: 'English', short: 'EN' },
    { code: 'az', label: 'Azərbaycan dili', short: 'AZ' },
    { code: 'tr', label: 'Türkçe', short: 'TR' },
];

export const INTL_LOCALES = {
    en: 'en-US',
    az: 'az-AZ',
    tr: 'tr-TR',
};

export const isLocale = (value) => Object.prototype.hasOwnProperty.call(DICTIONARIES, value);

export const getByPath = (source, path) => {
    if (!source || !path) return undefined;
    return path.split('.').reduce((current, part) => (current && typeof current === 'object' ? current[part] : undefined), source);
};

const interpolate = (template, vars) => {
    if (!vars) return template;
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name) =>
        vars[name] === undefined || vars[name] === null ? match : String(vars[name])
    );
};

const lookup = (dictionary, key) => {
    const direct = getByPath(dictionary, key);
    return typeof direct === 'string' ? direct : undefined;
};

export const createTranslator = (locale) => {
    const active = isLocale(locale) ? locale : DEFAULT_LOCALE;
    const dictionary = DICTIONARIES[active];

    return (key, vars) => {
        let value;

        // Pluralized entries use keys such as `time.daysAgo_one` / `_other`.
        if (vars && vars.count !== undefined) {
            try {
                const category = new Intl.PluralRules(INTL_LOCALES[active]).select(Number(vars.count));
                value = lookup(dictionary, `${key}_${category}`) ?? lookup(dictionary, `${key}_other`);
            } catch {
                // Intl.PluralRules is available in all supported browsers; fall back to the base key.
            }
        }

        value = value ?? lookup(dictionary, key);

        // Fall back to English so a missing translation is still readable.
        if (value === undefined && active !== DEFAULT_LOCALE) {
            value = lookup(DICTIONARIES[DEFAULT_LOCALE], key);
        }

        if (value === undefined) {
            if (import.meta.env?.DEV) console.warn(`[i18n] Missing translation key: ${key} (${active})`);
            return key;
        }

        return interpolate(value, vars);
    };
};

// Non-component helpers (format.js, sockets, notification templates) need the active
// locale without a React hook. LocaleSync and the locale slice keep this in sync.
let activeLocale = DEFAULT_LOCALE;

export const setActiveLocale = (locale) => {
    activeLocale = isLocale(locale) ? locale : DEFAULT_LOCALE;
};

export const getActiveLocale = () => activeLocale;

export const translate = (key, vars) => createTranslator(activeLocale)(key, vars);

// Backend messages are fixed English strings. Known ones are mapped to localized text;
// unknown ones stay untouched so business details are never hidden.
export const translateApiMessage = (message) => {
    if (!message || typeof message !== 'string') return message;
    const dictionary = DICTIONARIES[activeLocale] ?? DICTIONARIES[DEFAULT_LOCALE];
    const mapped = dictionary.apiErrors?.[message];
    return mapped || message;
};

export const formatNumber = (value, options) => {
    const number = Number(value);
    if (value === null || value === undefined || Number.isNaN(number)) return '—';
    return new Intl.NumberFormat(INTL_LOCALES[activeLocale], options).format(number);
};

export const formatCurrency = (value) => {
    const number = Number(value);
    if (value === null || value === undefined || Number.isNaN(number)) return '—';
    return new Intl.NumberFormat(INTL_LOCALES[activeLocale], {
        style: 'currency',
        currency: 'USD',
    }).format(number);
};

export const formatDateFor = (value) => {
    if (!value) return '—';
    return new Date(value).toLocaleDateString(INTL_LOCALES[activeLocale], {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
};

export const formatDateTimeFor = (value) => {
    if (!value) return '—';
    return new Date(value).toLocaleString(INTL_LOCALES[activeLocale], {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

export const timeAgoFor = (value) => {
    if (!value) return '';
    const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
    const units = [
        ['yearsAgo', 31536000],
        ['monthsAgo', 2592000],
        ['daysAgo', 86400],
        ['hoursAgo', 3600],
        ['minutesAgo', 60],
    ];
    for (const [key, size] of units) {
        const count = Math.floor(seconds / size);
        if (count >= 1) return translate(`common.time.${key}`, { count });
    }
    return translate('common.time.justNow');
};
