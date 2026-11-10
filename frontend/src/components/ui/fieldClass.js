import { cn } from '../../lib/cn';

// pad: padding sinfi. Ikon və ya sağ element olanda ayrıca verilir ki, sinif toqquşması olmasın
export const fieldClass = (error, pad = 'px-3.5') =>
    cn(
        'w-full rounded-xl border bg-surface-container-lowest py-2.5 text-body-md text-on-surface shadow-sm transition',
        'placeholder:text-secondary/60',
        'focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-primary-container',
        'disabled:cursor-not-allowed disabled:bg-surface-container-low',
        pad,
        error ? 'border-error bg-error-container/30' : 'border-line'
    );
