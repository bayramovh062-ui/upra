import { useState } from 'react';
import toast from 'react-hot-toast';
import { Button, Input, Modal } from '../../components/ui';
import { getErrorMessage } from '../../lib/format';
import { formatNumber } from '../../i18n';
import { useTranslation } from '../locale/useTranslation';
import { useTopUpWalletMutation } from './walletApi';

const MAX_TOPUP_DOLLARS = 5000; // backend: MAX_TOPUP_CENTS = 500000
const QUICK_AMOUNTS = [100, 500, 1000];

// DEMO: real ödəniş yoxdur, yalnız simulyasiya edilmiş balans əlavə edir
const TopUpModal = ({ open, onClose }) => {
    const { t } = useTranslation();
    const [amount, setAmount] = useState('');
    const [error, setError] = useState('');
    const [topUp, { isLoading }] = useTopUpWalletMutation();

    const close = () => {
        setAmount('');
        setError('');
        onClose();
    };

    const submit = async () => {
        const dollars = Number(amount);
        if (!amount || Number.isNaN(dollars) || dollars <= 0) {
            setError(t('wallet.topUp.amountInvalid'));
            return;
        }
        if (dollars > MAX_TOPUP_DOLLARS) {
            setError(t('wallet.topUp.limit', { max: formatNumber(MAX_TOPUP_DOLLARS) }));
            return;
        }

        try {
            // Float xətasının qarşısı: dollar -> sent yuvarlaqlaşdırılır (məs. 19.99 * 100 = 1998.9999...)
            await topUp({ amountCents: Math.round(dollars * 100) }).unwrap();
            toast.success(t('wallet.topUp.success'));
            close();
        } catch (err) {
            toast.error(getErrorMessage(err, t('wallet.topUp.error')));
        }
    };

    return (
        <Modal
            open={open}
            onClose={close}
            title={t('wallet.topUp.title')}
            footer={
                <>
                    <Button variant="secondary" onClick={close} disabled={isLoading}>
                        {t('common.actions.cancel')}
                    </Button>
                    <Button onClick={submit} loading={isLoading}>
                        {t('wallet.topUp.submit')}
                    </Button>
                </>
            }
        >
            <p className="mb-3 rounded-lg bg-warning-soft px-3 py-2 text-label-md text-warning-ink">
                {t('wallet.topUp.demoNote')}
            </p>
            <Input
                label={t('wallet.topUp.amount')}
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                placeholder="100.00"
                value={amount}
                error={error}
                onChange={(e) => {
                    setAmount(e.target.value);
                    setError('');
                }}
            />
            <div className="mt-3 flex gap-2">
                {QUICK_AMOUNTS.map((value) => (
                    <button
                        key={value}
                        type="button"
                        onClick={() => {
                            setAmount(String(value));
                            setError('');
                        }}
                        className="rounded-lg border border-line px-3 py-1 text-label-md text-on-surface hover:bg-surface-container-low"
                    >
                        ${value}
                    </button>
                ))}
            </div>
        </Modal>
    );
};

export default TopUpModal;
