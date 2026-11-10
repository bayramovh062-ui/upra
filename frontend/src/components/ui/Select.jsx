import { useId } from 'react';
import { FieldLabel, FieldError } from './Input';
import { fieldClass } from './fieldClass';

// options: [{ value, label }]
const Select = ({ label, error, options = [], placeholder, className, id, ref, ...props }) => {
    const autoId = useId();
    const fieldId = id || autoId;
    return (
        <div className={className}>
            {label && (
                <FieldLabel htmlFor={fieldId} error={error}>
                    {label}
                </FieldLabel>
            )}
            <select id={fieldId} ref={ref} className={fieldClass(error)} {...props}>
                {placeholder && <option value="">{placeholder}</option>}
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
            <FieldError>{error}</FieldError>
        </div>
    );
};

export default Select;
