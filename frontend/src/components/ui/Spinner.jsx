import { cn } from '../../lib/cn';

const sizes = { sm: 'h-4 w-4 border-2', md: 'h-6 w-6 border-2', lg: 'h-10 w-10 border-4' };

const Spinner = ({ size = 'md', className }) => (
    <span
        role="status"
        aria-label="Loading"
        className={cn(
            'inline-block animate-spin rounded-full border-current border-t-transparent',
            sizes[size],
            className
        )}
    />
);

export default Spinner;
