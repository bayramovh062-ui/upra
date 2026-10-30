import { useId } from 'react';
import { fieldClass, FieldLabel, FieldError } from './Input';

const Textarea = ({ label, error, hint, className, id, ref, rows = 4, ...props }) => {
    const autoId = useId();
    const fieldId = id || autoId;
    return (
        <div className={className}>
            {label && (
                <FieldLabel htmlFor={fieldId} error={error}>
                    {label}
                </FieldLabel>
            )}
            <textarea
                id={fieldId}
                ref={ref}
                rows={rows}
                aria-invalid={error ? 'true' : undefined}
                className={fieldClass(error)}
                {...props}
            />
            {hint && !error && <p className="mt-1.5 text-label-sm text-secondary">{hint}</p>}
            <FieldError>{error}</FieldError>
        </div>
    );
};

export default Textarea;
