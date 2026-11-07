import { useState } from 'react';
import toast from 'react-hot-toast';
import { Button, Input, Modal } from '../../components/ui';
import { formatCents, getErrorMessage } from '../../lib/format';
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
            setError('Enter a valid amount (max 2 decimals)');
            return;
        }
        if (cents <= 0) {
            setError('Enter an amount greater than 0');
            return;
        }
        if (cents > availableCents) {
            setError(`You can withdraw at most ${formatCents(availableCents)}`);
            return;
        }

        try {
            await withdraw({ amountCents: cents }).unwrap();
            toast.success(`${formatCents(cents)} withdrawn (demo)`);
            setAmount('');
            setError('');
            onClose();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not withdraw'));
        }
    };

    return (
        <Modal
            open={open}
            onClose={close}
            title="Withdraw funds"
            footer={
                <>
                    <Button variant="secondary" onClick={close} disabled={isLoading}>
                        Cancel
                    </Button>
                    <Button onClick={submit} loading={isLoading} disabled={availableCents <= 0}>
                        Withdraw
                    </Button>
                </>
            }
        >
            <p className="mb-3 rounded-lg bg-warning-soft px-3 py-2 text-label-md text-warning-ink">
                Demo only: no real money is sent anywhere.
            </p>
            <p className="mb-3 text-body-md text-secondary">
                Available to withdraw: <span className="tabular font-semibold text-on-surface">{formatCents(availableCents)}</span>.
                Money held in escrow cannot be withdrawn.
            </p>
            <Input
                label="Amount (USD)"
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
                Withdraw everything
            </button>
        </Modal>
    );
};

export default WithdrawModal;
