import { useId } from 'react';
import { cn } from '../../lib/cn';

export const fieldClass = (error) =>
    cn(
        'w-full rounded-lg border bg-white px-3.5 py-2 text-sm text-ink placeholder:text-gray-400 transition',
        'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500',
        'disabled:bg-gray-100 disabled:cursor-not-allowed',
        error ? 'border-red-400' : 'border-line'
    );

// React 19-da ref adi prop kimi gəlir, react-hook-form-un register() ilə birbaşa işləyir
const Input = ({ label, error, hint, className, id, ref, ...props }) => {
    const autoId = useId();
    const inputId = id || autoId;
    return (
        <div className={className}>
            {label && (
                <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-gray-700">
                    {label}
                </label>
            )}
            <input id={inputId} ref={ref} className={fieldClass(error)} {...props} />
            {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
    );
};

export default Input;
