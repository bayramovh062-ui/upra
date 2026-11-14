import { useEffect, useId, useRef } from 'react';
import { cn } from '../../lib/cn';
import { revealError } from '../../lib/revealError';
import Icon from './Icon';
import { fieldClass } from './fieldClass';

export const FieldLabel = ({ htmlFor, error, children }) => (
    <label
        htmlFor={htmlFor}
        className={cn('mb-1.5 block text-label-md', error ? 'text-error' : 'text-on-surface')}
    >
        {children}
    </label>
);

// Xəta ekrana çıxanda (submit/Next-dən sonra) görünən yerdə deyilsə, səhifə ona sürüşür
export const FieldError = ({ children }) => {
    const ref = useRef(null);

    useEffect(() => {
        if (children) revealError(ref.current);
    }, [children]);

    return children ? (
        <p ref={ref} role="alert" className="mt-1.5 flex scroll-mt-28 items-center gap-1.5 text-label-sm text-error">
            <Icon name="info" className="text-[16px]" />
            {children}
        </p>
    ) : null;
};

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
