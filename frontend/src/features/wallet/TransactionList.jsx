import { Badge, Icon } from '../../components/ui';
import { formatCents, timeAgo } from '../../lib/format';
import { useTranslation } from '../locale/useTranslation';

// Ledger tipi (backend: financialService) -> yazı və ikon.
// Bir əməliyyat bir neçə ledger sətri yaradır (məs. maliyyələşdirmə: AVAILABLE-dan çıxış + LOCKED-ə giriş),
// ona görə hər sətir balans növü ilə birlikdə göstərilir.
const TYPES = {
    TOP_UP: { icon: 'add_card' },
    WITHDRAWAL: { icon: 'north_east' },
    MILESTONE_FUNDING: { icon: 'lock' },
    ESCROW_LOCK: { icon: 'account_balance' },
    ESCROW_RELEASE: { icon: 'lock_open' },
    MILESTONE_PAYMENT: { icon: 'payments' },
    COMMISSION: { icon: 'percent' },
    REFUND: { icon: 'undo' },
};

const TransactionRow = ({ tx }) => {
    const { t } = useTranslation();
    const config = TYPES[tx.type] || { icon: 'receipt_long' };
    const credit = tx.direction === 'CREDIT';
    const label = TYPES[tx.type] ? t(`wallet.types.${tx.type}`) : tx.type;

    return (
        <li className="flex items-center justify-between gap-3 px-2 py-3">
            <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-container text-secondary">
                    <Icon name={config.icon} className="text-[18px]" />
                </span>
                <div className="min-w-0">
                    <p className="truncate text-body-md-medium text-on-surface">{label}</p>
                    <p className="truncate text-caption text-secondary">
                        {tx.milestone?.title ? `${tx.milestone.title} · ` : ''}
                        {timeAgo(tx.createdAt)}
                    </p>
                </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
                <Badge tone={tx.balanceType === 'LOCKED' ? 'blue' : 'gray'}>
                    {['AVAILABLE', 'LOCKED'].includes(tx.balanceType)
                        ? t(`wallet.balances.${tx.balanceType}`)
                        : tx.balanceType}
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
const TransactionList = ({ transactions = [] }) => {
    const { t } = useTranslation();

    return transactions.length === 0 ? (
        <p className="px-2 py-6 text-center text-body-md text-secondary">{t('wallet.empty')}</p>
    ) : (
        <ul className="divide-y divide-line">
            {transactions.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} />
            ))}
        </ul>
    );
};

export default TransactionList;
