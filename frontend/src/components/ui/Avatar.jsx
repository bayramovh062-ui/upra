import { cn } from '../../lib/cn';
import { getInitials } from '../../lib/format';

const sizes = { sm: 'h-7 w-7 text-xs', md: 'h-9 w-9 text-sm', lg: 'h-12 w-12 text-base' };

const Avatar = ({ name, size = 'md', className }) => (
    <span
        title={name}
        className={cn(
            'inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700',
            sizes[size],
            className
        )}
    >
        {getInitials(name)}
    </span>
);

export default Avatar;
