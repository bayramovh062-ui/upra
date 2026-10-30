import { useId } from 'react';
import { fieldClass } from './Input';

// options: [{ value, label }]
const Select = ({ label, error, options = [], placeholder, className, id, ref, ...props }) => {
    const autoId = useId();
    const fieldId = id || autoId;
    return (
        <div className={className}>
            {label && (
                <label htmlFor={fieldId} className="mb-1 block text-sm font-medium text-gray-700">
                    {label}
                </label>
            )}
            <select id={fieldId} ref={ref} className={fieldClass(error)} {...props}>
                {placeholder && <option value="">{placeholder}</option>}
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
    );
};

export default Select;
