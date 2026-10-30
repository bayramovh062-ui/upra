import { cn } from '../../lib/cn';
import { getInitials } from '../../lib/format';

const sizes = { sm: 'h-8 w-8 text-label-sm', md: 'h-9 w-9 text-body-md', lg: 'h-12 w-12 text-title-md' };

const Avatar = ({ name, size = 'md', className }) => (
    <span
        title={name}
        className={cn(
            'inline-flex shrink-0 items-center justify-center rounded-full bg-primary-fixed font-semibold text-on-primary-fixed',
            sizes[size],
            className
        )}
    >
        {getInitials(name)}
    </span>
);

export default Avatar;
