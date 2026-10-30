import { cn } from '../../lib/cn';
import Spinner from './Spinner';

const variants = {
    primary:
        'bg-primary-container text-on-primary shadow-sm hover:bg-primary focus-visible:ring-primary-container',
    secondary:
        'bg-white text-on-surface border border-line shadow-sm hover:bg-surface-container-low focus-visible:ring-primary-container',
    ghost: 'text-secondary hover:bg-surface-container hover:text-on-surface focus-visible:ring-primary-container',
    danger: 'bg-error text-on-error shadow-sm hover:opacity-90 focus-visible:ring-error',
};

const sizes = {
    sm: 'px-3 py-1.5 text-label-sm',
    md: 'px-4 py-2.5 text-body-md font-medium',
    lg: 'px-6 py-3 text-body-md font-semibold',
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
            'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition',
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
