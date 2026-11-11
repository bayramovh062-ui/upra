import Modal from './Modal';
import Button from './Button';
import { useTranslation } from '../../features/locale/useTranslation';

const ConfirmDialog = ({
    open,
    onClose,
    onConfirm,
    title,
    message,
    confirmText,
    variant = 'primary',
    loading = false,
}) => {
    const { t } = useTranslation();
    return (
        <Modal
            open={open}
            onClose={onClose}
            title={title ?? t('common.confirm.title')}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={loading}>
                        {t('common.actions.cancel')}
                    </Button>
                    <Button variant={variant} onClick={onConfirm} loading={loading}>
                        {confirmText ?? t('common.actions.confirm')}
                    </Button>
                </>
            }
        >
            <p className="text-sm text-muted">{message ?? t('common.confirm.message')}</p>
        </Modal>
    );
};

export default ConfirmDialog;
