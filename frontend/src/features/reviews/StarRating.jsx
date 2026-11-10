import { useState } from 'react';
import { cn } from '../../lib/cn';
import { Icon } from '../../components/ui';

const STARS = [1, 2, 3, 4, 5];

// Yalnız göstərmək üçün (profil, rəy siyahısı). value: 0..5 (onluq ola bilər, ən yaxın tam ulduza yuvarlaqlaşır)
export const StarRating = ({ value = 0, sizeClass = 'text-[18px]', className }) => {
    const rounded = Math.round(Number(value) || 0);

    return (
        <span
            role="img"
            aria-label={`${Number(value) || 0} out of 5 stars`}
            className={cn('inline-flex items-center', className)}
        >
            {STARS.map((n) => (
                <Icon
                    key={n}
                    name="star"
                    filled={n <= rounded}
                    className={cn(sizeClass, n <= rounded ? 'text-amber-500' : 'text-outline-variant')}
                />
            ))}
        </span>
    );
};

// Seçmək üçün: radio qrupu kimi işləyir (klaviatura: ox düymələri, Tab ilə seçilmiş ulduza keçid)
export const StarRatingInput = ({ value = 0, onChange, disabled = false }) => {
    const [hover, setHover] = useState(0);
    const shown = hover || value;

    const onKeyDown = (e) => {
        if (disabled) return;
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
            e.preventDefault();
            onChange(Math.min(5, (value || 0) + 1));
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
            e.preventDefault();
            onChange(Math.max(1, (value || 2) - 1));
        }
    };

    return (
        <div
            role="radiogroup"
            aria-label="Rating"
            onKeyDown={onKeyDown}
            onMouseLeave={() => setHover(0)}
            className="inline-flex items-center gap-1"
        >
            {STARS.map((n) => (
                <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={value === n}
                    aria-label={`${n} star${n === 1 ? '' : 's'}`}
                    // Roving tabindex: Tab qrupa bir dəfə düşür (seçilmiş və ya ilk ulduz)
                    tabIndex={value === n || (!value && n === 1) ? 0 : -1}
                    disabled={disabled}
                    onClick={() => onChange(n)}
                    onMouseEnter={() => setHover(n)}
                    className="rounded p-0.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-container disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <Icon
                        name="star"
                        filled={n <= shown}
                        className={cn('text-[32px]', n <= shown ? 'text-amber-500' : 'text-outline-variant')}
                    />
                </button>
            ))}
        </div>
    );
};
