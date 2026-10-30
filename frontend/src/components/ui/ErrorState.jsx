import EmptyState from './EmptyState';
import Button from './Button';

// Sorğu uğursuz olanda göstərilir. onRetry verilsə "Try again" düyməsi çıxır.
const ErrorState = ({ title = 'Something went wrong', description, onRetry, className }) => (
    <EmptyState
        icon="error"
        title={title}
        description={description}
        className={className}
        action={
            onRetry && (
                <Button variant="secondary" onClick={onRetry}>
                    Try again
                </Button>
            )
        }
    />
);

export default ErrorState;
