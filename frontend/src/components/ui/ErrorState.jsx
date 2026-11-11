import EmptyState from './EmptyState';
import Button from './Button';
import { useTranslation } from '../../features/locale/useTranslation';

// Sorğu uğursuz olanda göstərilir. onRetry verilsə "Try again" düyməsi çıxır.
const ErrorState = ({ title, description, onRetry, className }) => {
    const { t } = useTranslation();
    return (
        <EmptyState
            icon="error"
            title={title ?? t('common.somethingWentWrong')}
            description={description}
            className={className}
            action={
                onRetry && (
                    <Button variant="secondary" onClick={onRetry}>
                        {t('common.tryAgain')}
                    </Button>
                )
            }
        />
    );
};

export default ErrorState;
