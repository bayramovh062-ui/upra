import { useState } from 'react';
import toast from 'react-hot-toast';
import { Button, Input, Modal } from '../../components/ui';
import { getErrorMessage } from '../../lib/format';
import { useTopUpWalletMutation } from './walletApi';

const MAX_TOPUP_DOLLARS = 5000; // backend: MAX_TOPUP_CENTS = 500000
const QUICK_AMOUNTS = [100, 500, 1000];

// DEMO: real ödəniş yoxdur, yalnız simulyasiya edilmiş balans əlavə edir
const TopUpModal = ({ open, onClose }) => {
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
            setError('Enter an amount greater than 0');
            return;
        }
        if (dollars > MAX_TOPUP_DOLLARS) {
            setError(`Demo top-up is limited to $${MAX_TOPUP_DOLLARS} per request`);
            return;
        }

        try {
            // Float xətasının qarşısı: dollar -> sent yuvarlaqlaşdırılır (məs. 19.99 * 100 = 1998.9999...)
            await topUp({ amountCents: Math.round(dollars * 100) }).unwrap();
            toast.success('Demo funds added to your wallet');
            close();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not add funds'));
        }
    };

    return (
        <Modal
            open={open}
            onClose={close}
            title="Add demo funds"
            footer={
                <>
                    <Button variant="secondary" onClick={close} disabled={isLoading}>
                        Cancel
                    </Button>
                    <Button onClick={submit} loading={isLoading}>
                        Add funds
                    </Button>
                </>
            }
        >
            <p className="mb-3 rounded-lg bg-warning-soft px-3 py-2 text-label-md text-warning-ink">
                Demo only: this is simulated money, no real payment is made.
            </p>
            <Input
                label="Amount (USD)"
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
