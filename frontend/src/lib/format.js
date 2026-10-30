// Prisma Decimal JSON-da string qayıdır ("500.00"), ona görə hər yerdə bu köməkçilər işlənir

const moneyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
});

export const formatMoney = (value) => {
    const num = Number(value);
    if (value === null || value === undefined || Number.isNaN(num)) return '—';
    return moneyFormatter.format(num);
};

export const formatDate = (value) => {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
};

// "2 days ago" tipli nisbi vaxt
export const timeAgo = (value) => {
    if (!value) return '';
    const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
    const units = [
        ['year', 31536000],
        ['month', 2592000],
        ['day', 86400],
        ['hour', 3600],
        ['minute', 60],
    ];
    for (const [name, size] of units) {
        const count = Math.floor(seconds / size);
        if (count >= 1) return `${count} ${name}${count > 1 ? 's' : ''} ago`;
    }
    return 'just now';
};

export const getInitials = (name = '') =>
    name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('') || '?';

// Backend xətasından (RTK Query) istifadəçiyə göstəriləcək mətni çıxarır
export const getErrorMessage = (err, fallback = 'Something went wrong') =>
    err?.data?.message || err?.error || fallback;
