import { useState } from 'react';
import { cn } from '../../lib/cn';
import { getInitials } from '../../lib/format';

const sizes = {
    sm: 'h-8 w-8 text-label-sm',
    md: 'h-9 w-9 text-body-md',
    lg: 'h-12 w-12 text-title-md',
    xl: 'h-20 w-20 text-headline-md',
};

// Yalnız http(s) ünvanları şəkil kimi göstərilir (javascript:, data: və s. yox)
const isSafeImageUrl = (value) => typeof value === 'string' && /^https?:\/\//i.test(value.trim());

// src verilsə şəkil göstərilir; yüklənməsə (səhv URL) baş hərflərə qayıdır
const Avatar = ({ name, src, size = 'md', className }) => {
    const [failedSrc, setFailedSrc] = useState(null);
    const showImage = isSafeImageUrl(src) && failedSrc !== src;

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
                    src={src}
                    alt={name ? `${name} avatar` : 'Avatar'}
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
