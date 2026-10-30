import { cn } from '../../lib/cn';
import Icon from './Icon';

// 1, 2, 3 … 10 kimi qısaldılmış səhifə siyahısı
const buildPages = (page, totalPages) => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages = new Set([1, totalPages, page - 1, page, page + 1]);
    const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
    const result = [];
    sorted.forEach((p, i) => {
        if (i > 0 && p - sorted[i - 1] > 1) result.push('…');
        result.push(p);
    });
    return result;
};

const Pagination = ({ page, totalPages, onChange }) => {
    if (!totalPages || totalPages <= 1) return null;

    return (
        <nav className="flex items-center gap-1" aria-label="Pagination">
            <button
                type="button"
                disabled={page <= 1}
                onClick={() => onChange(page - 1)}
                aria-label="Previous page"
                className="flex items-center justify-center rounded-lg p-1.5 text-secondary transition hover:bg-surface-container hover:text-on-surface disabled:cursor-not-allowed disabled:text-outline-variant disabled:hover:bg-transparent"
            >
                <Icon name="chevron_left" className="text-[18px]" />
            </button>
            {buildPages(page, totalPages).map((p, i) =>
                p === '…' ? (
                    <span key={`gap-${i}`} className="px-1 text-label-sm text-secondary">
                        …
                    </span>
                ) : (
                    <button
                        key={p}
                        type="button"
                        onClick={() => onChange(p)}
                        aria-current={p === page ? 'page' : undefined}
                        className={cn(
                            'flex h-8 w-8 items-center justify-center rounded-lg text-label-md transition',
                            p === page
                                ? 'bg-primary-container font-semibold text-on-primary shadow-sm'
                                : 'text-on-surface hover:bg-surface-container'
                        )}
                    >
                        {p}
                    </button>
                )
            )}
            <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => onChange(page + 1)}
                aria-label="Next page"
                className="flex items-center justify-center rounded-lg p-1.5 text-secondary transition hover:bg-surface-container hover:text-on-surface disabled:cursor-not-allowed disabled:text-outline-variant disabled:hover:bg-transparent"
            >
                <Icon name="chevron_right" className="text-[18px]" />
            </button>
        </nav>
    );
};

export default Pagination;
