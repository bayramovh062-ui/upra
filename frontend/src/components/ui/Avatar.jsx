import { useState } from 'react';
import { cn } from '../../lib/cn';
import { getInitials } from '../../lib/format';
import { useTranslation } from '../../features/locale/useTranslation';

const sizes = {
    sm: 'h-8 w-8 text-label-sm',
    md: 'h-9 w-9 text-body-md',
    lg: 'h-12 w-12 text-title-md',
    xl: 'h-20 w-20 text-headline-md',
};

const apiOrigin = () => {
    const base = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    try {
        return new URL(base, window.location.origin).origin;
    } catch {
        return window.location.origin;
    }
};

const resolveSrc = (value) => {
    if (typeof value !== 'string') return null;
    const src = value.trim();
    if (!src) return null;
    if (/^https?:\/\//i.test(src) || src.startsWith('data:') || src.startsWith('blob:')) return src;
    if (src.startsWith('//')) return `https:${src}`;
    if (src.startsWith('/')) return `${apiOrigin()}${src}`; // e.g. /api/uploads/local/... from Plan 3 local storage
    return null;
};

// src verilsə şəkil göstərilir; yüklənməsə/silinibsə (səhv URL) baş hərflərə qayıdır
const Avatar = ({ name, src, size = 'md', className }) => {
    const { t } = useTranslation();
    const [failedSrc, setFailedSrc] = useState(null);
    const resolved = resolveSrc(src);
    const showImage = resolved && failedSrc !== src;
    const alt = name ? t('shell.avatarModal.avatarAlt', { name }) : t('common.a11y.avatar');

    return (
        <span
            title={name}
            className={cn(
                'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-fixed font-semibold text-on-primary-fixed',
                sizes[size],
                className
            )}
        >
            {showImage ? (
                <img
                    src={resolved}
                    alt={alt}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={() => setFailedSrc(src)}
                />
            ) : (
                getInitials(name)
            )}
        </span>
    );
};

export default Avatar;

