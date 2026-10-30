import { useEffect } from 'react';
import { cn } from '../../lib/cn';

// Sağdan açılan panel (Kanban-da tapşırıq detalı üçün)
const Drawer = ({ open, onClose, title, children, className }) => {
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => e.key === 'Escape' && onClose?.();
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-gray-900/40" onClick={onClose} aria-hidden="true" />
            <aside
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className={cn(
                    'absolute right-0 top-0 flex h-full w-full max-w-[480px] flex-col bg-white shadow-xl',
                    className
                )}
            >
                <div className="flex items-center justify-between border-b border-line px-5 py-4">
                    <h2 className="text-lg font-semibold text-ink">{title}</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="rounded p-1 text-muted hover:bg-gray-100 hover:text-ink"
                    >
                        ✕
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-5">{children}</div>
            </aside>
        </div>
    );
};

export default Drawer;
