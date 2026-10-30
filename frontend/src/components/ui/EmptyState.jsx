import { cn } from '../../lib/cn';

const EmptyState = ({ title, description, action, className }) => (
    <div
        className={cn(
            'flex flex-col items-center justify-center rounded-card border border-dashed border-line bg-white px-6 py-14 text-center',
            className
        )}
    >
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-xl text-brand-600">
            ✦
        </div>
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
        {action && <div className="mt-5">{action}</div>}
    </div>
);

export default EmptyState;
