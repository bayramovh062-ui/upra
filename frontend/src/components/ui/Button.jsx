import { cn } from '../../lib/cn';
import Spinner from './Spinner';

const variants = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 focus-visible:ring-brand-500',
    secondary: 'bg-white text-ink border border-line hover:bg-gray-50 focus-visible:ring-brand-500',
    ghost: 'text-muted hover:bg-gray-100 hover:text-ink focus-visible:ring-brand-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
};

const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base',
};

const Button = ({
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    className,
    children,
    type = 'button',
    ...props
}) => (
    <button
        type={type}
        disabled={disabled || loading}
        className={cn(
            'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            variants[variant],
            sizes[size],
            className
        )}
        {...props}
    >
        {loading && <Spinner size="sm" />}
        {children}
    </button>
);

export default Button;
