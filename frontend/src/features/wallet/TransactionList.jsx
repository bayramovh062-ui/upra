import { Badge, Icon } from '../../components/ui';
import { formatCents, timeAgo } from '../../lib/format';

// Ledger tipi (backend: financialService) -> yazı və ikon.
// Bir əməliyyat bir neçə ledger sətri yaradır (məs. maliyyələşdirmə: AVAILABLE-dan çıxış + LOCKED-ə giriş),
// ona görə hər sətir balans növü ilə birlikdə göstərilir.
const TYPES = {
    TOP_UP: { label: 'Demo top-up', icon: 'add_card' },
    WITHDRAWAL: { label: 'Withdrawal', icon: 'north_east' },
    MILESTONE_FUNDING: { label: 'Milestone funded', icon: 'lock' },
    ESCROW_LOCK: { label: 'Locked in escrow', icon: 'account_balance' },
    ESCROW_RELEASE: { label: 'Released from escrow', icon: 'lock_open' },
    MILESTONE_PAYMENT: { label: 'Milestone payment', icon: 'payments' },
    COMMISSION: { label: 'Platform fee (10%)', icon: 'percent' },
    REFUND: { label: 'Refund', icon: 'undo' },
};

const BALANCE_LABEL = { AVAILABLE: 'Wallet', LOCKED: 'Escrow' };

const TransactionRow = ({ tx }) => {
    const config = TYPES[tx.type] || { label: tx.type, icon: 'receipt_long' };
    const credit = tx.direction === 'CREDIT';

    return (
        <li className="flex items-center justify-between gap-3 px-2 py-3">
            <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-container text-secondary">
                    <Icon name={config.icon} className="text-[18px]" />
                </span>
                <div className="min-w-0">
                    <p className="truncate text-body-md-medium text-on-surface">{config.label}</p>
                    <p className="truncate text-caption text-secondary">
                        {tx.milestone?.title ? `${tx.milestone.title} · ` : ''}
                        {timeAgo(tx.createdAt)}
                    </p>
                </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
                <Badge tone={tx.balanceType === 'LOCKED' ? 'blue' : 'gray'}>
                    {BALANCE_LABEL[tx.balanceType] || tx.balanceType}
                </Badge>
                <span
                    className={`tabular w-24 text-right text-body-md-medium ${credit ? 'text-success-ink' : 'text-on-surface'}`}
                >
                    {credit ? '+' : '−'}
                    {formatCents(tx.amountCents)}
                </span>
            </div>
        </li>
    );
};

// transactions: GET /wallet cavabındakı son 20 ledger yazısı (yeni əvvəl)
const TransactionList = ({ transactions = [] }) =>
    transactions.length === 0 ? (
        <p className="px-2 py-6 text-center text-body-md text-secondary">No transactions yet.</p>
    ) : (
        <ul className="divide-y divide-line">
            {transactions.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} />
            ))}
        </ul>
    );

export default TransactionList;
