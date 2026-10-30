import { useState } from 'react';
import Input from './Input';
import Icon from './Icon';

// Parolu göstər/gizlət düyməsi olan Input. react-hook-form ilə: <PasswordInput {...register('password')} />
const PasswordInput = ({ ref, ...props }) => {
    const [visible, setVisible] = useState(false);

    return (
        <Input
            ref={ref}
            icon="lock"
            type={visible ? 'text' : 'password'}
            endAdornment={
                <button
                    type="button"
                    onClick={() => setVisible((v) => !v)}
                    aria-label={visible ? 'Hide password' : 'Show password'}
                    className="rounded-lg p-1.5 text-secondary transition hover:text-on-surface"
                >
                    <Icon name={visible ? 'visibility_off' : 'visibility'} />
                </button>
            }
            {...props}
        />
    );
};

export default PasswordInput;
