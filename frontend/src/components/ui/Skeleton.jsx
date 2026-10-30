import { cn } from '../../lib/cn';

// Yüklənmə zamanı boz "skelet" blok. Ölçünü className ilə ver: <Skeleton className="h-4 w-1/2" />
const Skeleton = ({ className }) => (
    <div className={cn('animate-pulse rounded-md bg-gray-200', className)} />
);

export default Skeleton;
