import { useId } from 'react';
import { fieldClass } from './Input';

const Textarea = ({ label, error, hint, className, id, ref, rows = 4, ...props }) => {
    const autoId = useId();
    const fieldId = id || autoId;
    return (
        <div className={className}>
            {label && (
                <label htmlFor={fieldId} className="mb-1 block text-sm font-medium text-gray-700">
                    {label}
                </label>
            )}
            <textarea id={fieldId} ref={ref} rows={rows} className={fieldClass(error)} {...props} />
            {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
    );
};

export default Textarea;
