import { useState } from 'react';
import toast from 'react-hot-toast';
import { Button, Input, Modal } from '../../components/ui';
import { formatCents, getErrorMessage } from '../../lib/format';
import { useTranslation } from '../locale/useTranslation';
import { useWithdrawFromWalletMutation } from './walletApi';

// Dollar yazısını sentə çevirir. Yanlışdırsa NaN (boş, mənfi, 2-dən çox onluq rəqəm)
const toCents = (value) => {
    const text = String(value ?? '').trim();
    if (!/^\d+(\.\d{1,2})?$/.test(text)) return NaN;
    return Math.round(Number(text) * 100);
};

// DEMO: real pul çıxmır, yalnız kilidsiz (available) balansdan simulyasiya edilmiş çıxarış.
// availableCents: cari kilidsiz balans (sent). Escrow-dakı pul çıxarıla bilməz.
const WithdrawModal = ({ open, onClose, availableCents = 0 }) => {
    const { t } = useTranslation();
    const [amount, setAmount] = useState('');
    const [error, setError] = useState('');
    const [withdraw, { isLoading }] = useWithdrawFromWalletMutation();

    const close = () => {
        if (isLoading) return;
        setAmount('');
        setError('');
        onClose();
    };

    const fillAll = () => {
        setAmount((availableCents / 100).toFixed(2));
        setError('');
    };

    const submit = async () => {
        const cents = toCents(amount);
        if (Number.isNaN(cents)) {
            setError(t('wallet.withdraw.amountInvalid'));
            return;
        }
        if (cents <= 0) {
            setError(t('wallet.withdraw.amountPositive'));
            return;
        }
        if (cents > availableCents) {
            setError(t('wallet.withdraw.amountMax', { amount: formatCents(availableCents) }));
            return;
        }

        try {
            await withdraw({ amountCents: cents }).unwrap();
            toast.success(t('wallet.withdraw.success', { amount: formatCents(cents) }));
            setAmount('');
            setError('');
            onClose();
        } catch (err) {
            toast.error(getErrorMessage(err, t('wallet.withdraw.error')));
        }
    };

    return (
        <Modal
            open={open}
            onClose={close}
            title={t('wallet.withdraw.title')}
            footer={
                <>
                    <Button variant="secondary" onClick={close} disabled={isLoading}>
                        {t('common.actions.cancel')}
                    </Button>
                    <Button onClick={submit} loading={isLoading} disabled={availableCents <= 0}>
                        {t('wallet.withdraw.submit')}
                    </Button>
                </>
            }
        >
            <p className="mb-3 rounded-lg bg-warning-soft px-3 py-2 text-label-md text-warning-ink">
                {t('wallet.withdraw.demoNote')}
            </p>
            <p className="mb-3 text-body-md text-secondary">
                {t('wallet.withdraw.availableLabel')}{' '}
                <span className="tabular font-semibold text-on-surface">{formatCents(availableCents)}</span>.{' '}
                {t('wallet.withdraw.escrowNote')}
            </p>
            <Input
                label={t('wallet.withdraw.amount')}
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                error={error}
                onChange={(e) => {
                    setAmount(e.target.value);
                    setError('');
                }}
            />
            <button
                type="button"
                onClick={fillAll}
                disabled={availableCents <= 0}
                className="mt-2 text-label-sm font-semibold text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50"
            >
                {t('wallet.withdraw.all')}
            </button>
        </Modal>
    );
};

export default WithdrawModal;
