import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Avatar, Button, Card, EmptyState, ErrorState, Icon, PageHeader, Skeleton, StatusBadge } from '../components/ui';
import { useGetMyContractsQuery } from '../features/contracts/contractsApi';
import { summarizeMilestones } from '../features/escrow/escrow';
import { cn } from '../lib/cn';
import { formatCents, formatDate, formatMoney } from '../lib/format';

const TABS = [
    { key: 'ALL', label: 'All' },
    { key: 'PENDING_ACCEPTANCE', label: 'Offers' },
    { key: 'ACTIVE', label: 'Active' },
    { key: 'COMPLETED', label: 'Completed' },
    { key: 'CANCELLED', label: 'Cancelled' },
];

// DELIVERED müqavilə hələ açıq işdir (client yoxlayır), ona görə "Active" tabında göstərilir.
// DECLINED frilanser tərəfindən rədd edilib və bağlanıb, ona görə "Cancelled" tabında göstərilir.
const tabOf = (status) => {
    if (status === 'DELIVERED') return 'ACTIVE';
    if (status === 'DECLINED') return 'CANCELLED';
    return status;
};

const ContractsPage = () => {
    const user = useSelector((state) => state.auth.user);
    const [tab, setTab] = useState('ACTIVE');
    const { data, isLoading, isError, refetch } = useGetMyContractsQuery();

    // useMemo: hər render-də yeni boş massiv yaranmasın, aşağıdakı counts hesabı boş yerə yenidən işləməsin
    const contracts = useMemo(() => data?.contracts ?? [], [data]);

    const counts = useMemo(() => {
        const c = { ALL: contracts.length, PENDING_ACCEPTANCE: 0, ACTIVE: 0, COMPLETED: 0, CANCELLED: 0 };
        contracts.forEach((x) => {
            const key = tabOf(x.status);
            c[key] = (c[key] ?? 0) + 1;
        });
        return c;
    }, [contracts]);

    const visible = tab === 'ALL' ? contracts : contracts.filter((c) => tabOf(c.status) === tab);
    const isClient = user?.role === 'CLIENT';

    return (
        <>
            <PageHeader
                title="Contracts"
                description="Every accepted proposal becomes a contract. Offers stay pending until the freelancer accepts them."
            />

            <div className="mb-6 inline-flex gap-1 rounded-xl bg-surface-container-low p-1">
                {TABS.map((t) => (
                    <button
                        key={t.key}
                        type="button"
                        onClick={() => setTab(t.key)}
                        className={cn(
                            'rounded-lg px-4 py-1.5 text-label-md transition-all',
                            tab === t.key
                                ? 'bg-surface-container-lowest font-semibold text-primary shadow-sm'
                                : 'text-on-surface-variant hover:text-on-surface',
                        )}
                    >
                        {t.label} <span className="ml-1 opacity-70">{counts[t.key] ?? 0}</span>
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div className="flex flex-col gap-3">
                    {[0, 1, 2].map((i) => (
                        <Skeleton key={i} className="h-32 w-full" />
                    ))}
                </div>
            ) : isError ? (
                <ErrorState title="Could not load contracts" onRetry={refetch} />
            ) : visible.length === 0 ? (
                <EmptyState
                    icon="handshake"
                    title="No contracts here"
                    description={
                        isClient
                            ? 'Accept a proposal on one of your jobs to send a contract offer.'
                            : 'When a client sends you a contract offer, it appears here. Accept it to start working.'
                    }
                    action={
                        <Link to={isClient ? '/client/jobs' : '/jobs'}>
                            <Button>{isClient ? 'My jobs' : 'Find work'}</Button>
                        </Link>
                    }
                />
            ) : (
                <div className="flex flex-col gap-4">
                    {visible.map((c) => {
                        const other = isClient ? c.freelancer : c.client;
                        const ms = summarizeMilestones(c.milestones ?? [], !isClient);
                        const hasMilestones = (c.milestones ?? []).length > 0;
                        return (
                            <Card key={c.id} className="flex flex-col gap-4 p-5 sm:p-6">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-caption font-semibold uppercase tracking-wide text-primary-container">
                                                CTR-{c.id.slice(0, 8)}
                                            </span>
                                            <StatusBadge status={c.status} />
                                        </div>
                                        <h2 className="mt-2 break-words text-headline-sm text-on-surface">
                                            {c.jobPost?.title}
                                        </h2>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-caption text-secondary">Contract value</p>
                                        <p className="tabular text-headline-sm font-bold text-on-surface">
                                            {formatMoney(c.proposal?.bidAmount)}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-3 rounded-xl bg-surface p-4 sm:grid-cols-3">
                                    <div className="flex items-center gap-3">
                                        <Avatar name={other?.fullName} />
                                        <div className="min-w-0">
                                            <p className="text-caption uppercase tracking-wider text-secondary">
                                                {isClient ? 'Freelancer' : 'Client'}
                                            </p>
                                            <p className="truncate text-body-md-medium text-on-surface">{other?.fullName}</p>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-caption uppercase tracking-wider text-secondary">Started</p>
                                        <p className="text-body-md-medium text-on-surface">{formatDate(c.createdAt)}</p>
                                    </div>
                                    {hasMilestones && (
                                        <div>
                                            <p className="text-caption uppercase tracking-wider text-secondary">Escrow</p>
                                            <p className="text-body-md-medium text-on-surface">
                                                {ms.paid} / {ms.total} paid
                                                <span className="tabular ml-2 text-secondary">
                                                    {ms.lockedCents > 0
                                                        ? `${formatCents(ms.lockedCents)} in escrow`
                                                        : ms.unfundedCents > 0
                                                          ? `${formatCents(ms.unfundedCents)} unfunded`
                                                          : ''}
                                                </span>
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-end gap-2">
                                    {c.status === 'ACTIVE' || c.status === 'DELIVERED' ? (
                                        <Link to={`/contracts/${c.id}?tab=escrow`}>
                                            <Button variant="secondary">
                                                <Icon name="account_balance" className="text-[16px]" />
                                                Escrow
                                            </Button>
                                        </Link>
                                    ) : null}
                                    <Link to={`/contracts/${c.id}`}>
                                        <Button>
                                            {c.status === 'PENDING_ACCEPTANCE'
                                                ? isClient
                                                    ? 'View offer'
                                                    : 'Review offer'
                                                : 'Open workspace'}
                                            <Icon
                                                name={c.status === 'PENDING_ACCEPTANCE' ? 'mail' : 'arrow_forward'}
                                                className="text-[16px]"
                                            />
                                        </Button>
                                    </Link>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}
        </>
    );
};

export default ContractsPage;
