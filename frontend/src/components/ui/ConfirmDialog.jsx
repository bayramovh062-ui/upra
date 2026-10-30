import Modal from './Modal';
import Button from './Button';

const ConfirmDialog = ({
    open,
    onClose,
    onConfirm,
    title = 'Are you sure?',
    message,
    confirmText = 'Confirm',
    variant = 'primary',
    loading = false,
}) => (
    <Modal
        open={open}
        onClose={onClose}
        title={title}
        footer={
            <>
                <Button variant="secondary" onClick={onClose} disabled={loading}>
                    Cancel
                </Button>
                <Button variant={variant} onClick={onConfirm} loading={loading}>
                    {confirmText}
                </Button>
            </>
        }
    >
        <p className="text-sm text-muted">{message}</p>
    </Modal>
);

export default ConfirmDialog;
