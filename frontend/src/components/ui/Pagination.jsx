import { cn } from '../../lib/cn';

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

const btn = 'min-w-9 rounded-lg border px-3 py-1.5 text-sm font-medium transition';

const Pagination = ({ page, totalPages, onChange }) => {
    if (!totalPages || totalPages <= 1) return null;

    return (
        <nav className="flex items-center justify-center gap-1" aria-label="Pagination">
            <button
                type="button"
                disabled={page <= 1}
                onClick={() => onChange(page - 1)}
                className={cn(btn, 'border-line bg-white hover:bg-gray-50 disabled:opacity-40')}
            >
                Prev
            </button>
            {buildPages(page, totalPages).map((p, i) =>
                p === '…' ? (
                    <span key={`gap-${i}`} className="px-2 text-muted">
                        …
                    </span>
                ) : (
                    <button
                        key={p}
                        type="button"
                        onClick={() => onChange(p)}
                        aria-current={p === page ? 'page' : undefined}
                        className={cn(
                            btn,
                            p === page
                                ? 'border-brand-600 bg-brand-600 text-white'
                                : 'border-line bg-white hover:bg-gray-50'
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
                className={cn(btn, 'border-line bg-white hover:bg-gray-50 disabled:opacity-40')}
            >
                Next
            </button>
        </nav>
    );
};

export default Pagination;
