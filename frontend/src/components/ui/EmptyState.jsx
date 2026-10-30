import { cn } from '../../lib/cn';
import Icon from './Icon';

const EmptyState = ({ title, description, action, icon = 'inbox', className }) => (
    <div
        className={cn(
            'flex flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest px-6 py-14 text-center',
            className
        )}
    >
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-fixed text-primary-container">
            <Icon name={icon} className="text-[24px]" />
        </div>
        <h3 className="text-title-md text-on-surface">{title}</h3>
        {description && <p className="mt-1 max-w-sm text-body-md text-secondary">{description}</p>}
        {action && <div className="mt-5">{action}</div>}
    </div>
);

export default EmptyState;
