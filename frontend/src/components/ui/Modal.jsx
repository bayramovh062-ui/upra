import { useEffect } from 'react';
import { cn } from '../../lib/cn';
import Icon from './Icon';

const Modal = ({ open, onClose, title, children, footer, className }) => {
    // Escape ilə bağlanma və fonun sürüşməsini dayandırma
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => e.key === 'Escape' && onClose?.();
        document.addEventListener('keydown', onKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-gray-900/50" onClick={onClose} aria-hidden="true" />
            <div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className={cn(
                    'relative w-full max-w-md rounded-xl border border-line bg-white shadow-xl',
                    className
                )}
            >
                {title && (
                    <div className="flex items-center justify-between border-b border-line px-5 py-4">
                        <h2 className="text-headline-sm text-on-surface">{title}</h2>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Close"
                            className="rounded-lg p-1 text-secondary hover:bg-surface-container hover:text-on-surface"
                        >
                            <Icon name="close" />
                        </button>
                    </div>
                )}
                <div className="px-5 py-4">{children}</div>
                {footer && (
                    <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>
                )}
            </div>
        </div>
    );
};

export default Modal;
