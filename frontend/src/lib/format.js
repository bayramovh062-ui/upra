// Prisma Decimal JSON-da string qayıdır ("500.00"), ona görə hər yerdə bu köməkçilər işlənir.
// Bütün formatlaşdırma aktiv dilə uyğundur (i18n/index.js).
import { formatCurrency, formatDateFor, timeAgoFor, translate, translateApiMessage } from '../i18n';

export const formatMoney = (value) => formatCurrency(value);

// Backend pulu USD sentlə tam ədəd saxlayır (2550 = $25.50). Ekranda dollara çevrilir.
export const formatCents = (cents) =>
    cents === null || cents === undefined || Number.isNaN(Number(cents))
        ? '—'
        : formatCurrency(Number(cents) / 100);

export const formatDate = (value) => formatDateFor(value);

// "2 days ago" tipli nisbi vaxt (dilə uyğun cəm formaları ilə)
export const timeAgo = (value) => timeAgoFor(value);

export const getInitials = (name = '') =>
    name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('') || '?';

// Backend xətasından (RTK Query) istifadəçiyə göstəriləcək mətni çıxarır.
// Tanınan backend mesajları cari dilə çevrilir; naməlum mesajlar olduğu kimi qalır.
export const getErrorMessage = (err, fallback) => {
    const raw = err?.data?.message || err?.error;
    if (raw) return translateApiMessage(raw);
    return fallback || translate('errors.generic');
};
