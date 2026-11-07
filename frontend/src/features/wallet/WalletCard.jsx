import { useState } from 'react';
import { Button, Card, ErrorState, Icon, Skeleton } from '../../components/ui';
import { formatCents } from '../../lib/format';
import TopUpModal from './TopUpModal';
import WithdrawModal from './WithdrawModal';
import { useGetWalletQuery } from './walletApi';

const Balance = ({ label, hint, value, icon }) => (
    <div className="rounded-xl bg-surface-container-low p-4">
        <p className="flex items-center gap-1.5 text-caption uppercase tracking-wider text-secondary">
            <Icon name={icon} className="text-[16px]" />
            {label}
        </p>
        <p className="tabular mt-1 text-headline-md text-on-surface">{value}</p>
        <p className="mt-0.5 text-caption text-secondary">{hint}</p>
    </div>
);

// Dashboard üçün pul kisəsi kartı. Balans (available / escrow-da kilidli) və əməliyyatlar.
// Client pul əlavə edir və çıxarır, frilanser yalnız çıxarır (qazancı available-a düşür).
// escrowCents: frilanserin pul kisəsində kilidli pul olmur, gözləyən məbləğ müqavilələrdən hesablanıb verilir.
const WalletCard = ({ isClient, escrowCents }) => {
    const walletQ = useGetWalletQuery();
    const [topUpOpen, setTopUpOpen] = useState(false);
    const [withdrawOpen, setWithdrawOpen] = useState(false);

    if (walletQ.isError) {
        return <ErrorState title="Could not load your wallet" onRetry={walletQ.refetch} />;
    }

    const wallet = walletQ.data?.wallet;
    const loading = walletQ.isLoading;

    return (
        <Card className="p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="flex items-center gap-2 text-headline-sm text-on-surface">
                        <Icon name="account_balance_wallet" className="text-[22px] text-primary-container" />
                        Wallet
                    </h2>
                    <p className="text-caption text-secondary">Demo balance in USD. No real payments are made.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {isClient && (
                        <Button size="sm" onClick={() => setTopUpOpen(true)}>
                            <Icon name="add_card" className="text-[16px]" />
                            Add demo funds
                        </Button>
                    )}
                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setWithdrawOpen(true)}
                        disabled={loading || !wallet || wallet.availableCents <= 0}
                    >
                        <Icon name="north_east" className="text-[16px]" />
                        Withdraw
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Skeleton className="h-24" />
                    <Skeleton className="h-24" />
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Balance
                        label="Available"
                        icon="savings"
                        value={formatCents(wallet?.availableCents ?? 0)}
                        hint={isClient ? 'Ready to fund milestones' : 'Ready to withdraw'}
                    />
                    <Balance
                        label="In escrow"
                        icon="lock"
                        value={formatCents(escrowCents ?? wallet?.lockedCents ?? 0)}
                        hint={isClient ? 'Funded, waiting for approval' : 'Funded by clients, not paid yet'}
                    />
                </div>
            )}

            <TopUpModal open={topUpOpen} onClose={() => setTopUpOpen(false)} />
            <WithdrawModal
                open={withdrawOpen}
                onClose={() => setWithdrawOpen(false)}
                availableCents={wallet?.availableCents ?? 0}
            />
        </Card>
    );
};

export default WalletCard;
