import { useId } from 'react';
import { cn } from '../../lib/cn';
import Icon from './Icon';

// pad: padding sinfi. Ikon və ya sağ element olanda ayrıca verilir ki, sinif toqquşması olmasın
export const fieldClass = (error, pad = 'px-3.5') =>
    cn(
        'w-full rounded-xl border bg-white py-2.5 text-body-md text-on-surface shadow-sm transition',
        'placeholder:text-secondary/60',
        'focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-primary-container',
        'disabled:cursor-not-allowed disabled:bg-surface-container-low',
        pad,
        error ? 'border-error bg-error-container/30' : 'border-line'
    );

export const FieldLabel = ({ htmlFor, error, children }) => (
    <label
        htmlFor={htmlFor}
        className={cn('mb-1.5 block text-label-md', error ? 'text-error' : 'text-on-surface')}
    >
        {children}
    </label>
);

export const FieldError = ({ children }) =>
    children ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-label-sm text-error">
            <Icon name="info" className="text-[16px]" />
            {children}
        </p>
    ) : null;

// React 19-da ref adi prop kimi gəlir, react-hook-form-un register() ilə birbaşa işləyir
// icon: soldakı Material ikonu, endAdornment: sağdakı element (məs. parolu göstər düyməsi)
const Input = ({ label, error, hint, className, id, ref, icon, endAdornment, ...props }) => {
    const autoId = useId();
    const inputId = id || autoId;
    const pad = cn(icon ? 'pl-10' : 'pl-3.5', endAdornment ? 'pr-11' : 'pr-3.5');

    return (
        <div className={className}>
            {label && (
                <FieldLabel htmlFor={inputId} error={error}>
                    {label}
                </FieldLabel>
            )}
            <div className="relative">
                {icon && (
                    <Icon
                        name={icon}
                        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary"
                    />
                )}
                <input
                    id={inputId}
                    ref={ref}
                    aria-invalid={error ? 'true' : undefined}
                    className={fieldClass(error, pad)}
                    {...props}
                />
                {endAdornment && (
                    <div className="absolute inset-y-0 right-2 flex items-center">{endAdornment}</div>
                )}
            </div>
            {hint && !error && <p className="mt-1.5 text-label-sm text-secondary">{hint}</p>}
            <FieldError>{error}</FieldError>
        </div>
    );
};

export default Input;
