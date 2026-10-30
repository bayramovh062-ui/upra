import { cn } from '../../lib/cn';

const Card = ({ className, children, ...props }) => (
    <div className={cn('rounded-card border border-line bg-white shadow-sm', className)} {...props}>
        {children}
    </div>
);

export const CardHeader = ({ title, action, className }) => (
    <div className={cn('flex items-center justify-between border-b border-line px-5 py-4', className)}>
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        {action}
    </div>
);

export const CardBody = ({ className, children }) => (
    <div className={cn('p-5', className)}>{children}</div>
);

export default Card;
