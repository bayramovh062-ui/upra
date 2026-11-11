import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Button, Card, CardHeader, EmptyState, ErrorState, Icon, Skeleton, StatusBadge } from '../components/ui';
import { useGetMyContractsQuery } from '../features/contracts/contractsApi';
import { useGetMyJobsQuery } from '../features/jobs/jobsApi';
import { useGetMyProposalsQuery } from '../features/proposals/proposalsApi';
import { summarizeMilestones } from '../features/escrow/escrowUtils';
import TransactionList from '../features/wallet/TransactionList';
import WalletCard from '../features/wallet/WalletCard';
import { useGetWalletQuery } from '../features/wallet/walletApi';
import { useTranslation } from '../features/locale/useTranslation';
import { formatCents, formatMoney, timeAgo } from '../lib/format';

// small: pul məbləğləri üçün (böyük rəqəm əvvəlinə sığmır)
const StatCard = ({ label, icon, value, loading, small }) => (
    <div className="rounded-xl border border-line bg-surface-container-lowest p-4 shadow-sm transition-shadow hover:shadow-md">
        <div className="flex items-center justify-between">
            <span className="text-label-md text-secondary">{label}</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-fixed text-primary">
                <Icon name={icon} className="text-[18px]" />
            </span>
        </div>
        {loading ? (
            <Skeleton className={small ? 'mt-4 h-8 w-28' : 'mt-4 h-9 w-16'} />
        ) : (
            <p className={`tabular mt-4 text-on-surface ${small ? 'text-headline-lg' : 'text-display-lg'}`}>{value}</p>
        )}
    </div>
);

const Row = ({ to, title, meta, right }) => (
    <Link
        to={to}
        className="flex items-center justify-between gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-surface-container-low"
    >
        <div className="min-w-0">
            <p className="truncate text-body-md-medium text-on-surface">{title}</p>
            <p className="text-caption text-secondary">{meta}</p>
        </div>
        {right}
    </Link>
);

const DashboardPage = () => {
    const { t } = useTranslation();
    const user = useSelector((state) => state.auth.user);
    const isClient = user?.role === 'CLIENT';
    const firstName = user?.fullName?.split(' ')[0] ?? '';

    // Hər rol yalnız öz endpoint-lərini çağırır (backend rola görə 403 qaytarardı)
    const jobsQ = useGetMyJobsQuery(undefined, { skip: !isClient });
    const proposalsQ = useGetMyProposalsQuery(undefined, { skip: isClient });
    const contractsQ = useGetMyContractsQuery();
    // Eyni sorğu WalletCard da edir (RTK Query təkrar sorğu göndərmir). Burada yalnız əməliyyatlar lazdır
    const walletQ = useGetWalletQuery();

    const jobs = jobsQ.data?.jobs ?? [];
    const proposals = proposalsQ.data?.proposals ?? [];
    const contracts = contractsQ.data?.contracts ?? [];

    // "ACTIVE" sayına DELIVERED da daxildir: iş hələ client tərəfindən təsdiqlənməyib
    const countContracts = (status) =>
        contracts.filter((c) => c.status === status || (status === 'ACTIVE' && c.status === 'DELIVERED')).length;
    const openJobs = jobs.filter((j) => j.status === 'OPEN');

    // Escrow xülasəsi bütün müqavilələrin mərhələlərindən hesablanır (frilanser üçün komissiyadan sonra)
    const escrow = contracts.reduce(
        (acc, c) => {
            const milestones = c.milestones ?? [];
            const s = summarizeMilestones(milestones, !isClient);
            acc.lockedCents += s.lockedCents;
            acc.releasedCents += s.releasedCents;
            acc.inReview += milestones.filter((m) => m.status === 'IN_REVIEW').length;
            return acc;
        },
        { lockedCents: 0, releasedCents: 0, inReview: 0 },
    );

    const escrowStats = isClient
        ? [
              { label: t('dashboard.escrow.locked'), icon: 'lock', value: formatCents(escrow.lockedCents) },
              { label: t('dashboard.escrow.reviewClient'), icon: 'rate_review', value: escrow.inReview, plain: true },
              { label: t('dashboard.escrow.paid'), icon: 'payments', value: formatCents(escrow.releasedCents) },
          ]
        : [
              { label: t('dashboard.escrow.earned'), icon: 'payments', value: formatCents(escrow.releasedCents) },
              { label: t('dashboard.escrow.waiting'), icon: 'lock', value: formatCents(escrow.lockedCents) },
              { label: t('dashboard.escrow.reviewFreelancer'), icon: 'hourglass_top', value: escrow.inReview, plain: true },
          ];

    const loading = contractsQ.isLoading || (isClient ? jobsQ.isLoading : proposalsQ.isLoading);
    const failed = contractsQ.isError || (isClient ? jobsQ.isError : proposalsQ.isError);

    const stats = isClient
        ? [
              { label: t('dashboard.stats.openJobs'), icon: 'work_outline', value: openJobs.length },
              {
                  label: t('dashboard.stats.proposalsToReview'),
                  icon: 'mark_email_unread',
                  value: openJobs.reduce((sum, j) => sum + (j._count?.proposals ?? 0), 0),
              },
              { label: t('dashboard.stats.activeContracts'), icon: 'handshake', value: countContracts('ACTIVE') },
              { label: t('dashboard.stats.completed'), icon: 'task_alt', value: countContracts('COMPLETED') },
          ]
        : [
              { label: t('dashboard.stats.activeContracts'), icon: 'handshake', value: countContracts('ACTIVE') },
              {
                  label: t('dashboard.stats.pendingProposals'),
                  icon: 'hourglass_top',
                  value: proposals.filter((p) => p.status === 'PENDING').length,
              },
              {
                  label: t('dashboard.stats.acceptedProposals'),
                  icon: 'mark_email_read',
                  value: proposals.filter((p) => p.status === 'ACCEPTED').length,
              },
              { label: t('dashboard.stats.completed'), icon: 'task_alt', value: countContracts('COMPLETED') },
          ];

    const retry = () => {
        contractsQ.refetch();
        walletQ.refetch();
        (isClient ? jobsQ : proposalsQ).refetch();
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col justify-between gap-4 rounded-xl border border-line bg-surface-container-lowest p-6 shadow-sm md:flex-row md:items-center">
                <div>
                    <h1 className="text-headline-lg text-on-surface">{t('dashboard.greeting', { name: firstName })}</h1>
                    <p className="mt-1 text-body-md text-secondary">
                        {isClient ? t('dashboard.clientSubtitle') : t('dashboard.freelancerSubtitle')}
                    </p>
                </div>
                {isClient ? (
                    <Link to="/client/jobs/new" className="shrink-0">
                        <Button>
                            <Icon name="add" />
                            {t('dashboard.postJob')}
                        </Button>
                    </Link>
                ) : (
                    <Link to="/jobs" className="shrink-0">
                        <Button>
                            <Icon name="search" />
                            {t('dashboard.findWork')}
                        </Button>
                    </Link>
                )}
            </div>

            {failed ? (
                <ErrorState title={t('dashboard.loadError')} onRetry={retry} />
            ) : (
                <>
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
                        {stats.map((stat) => (
                            <StatCard key={stat.label} loading={loading} {...stat} />
                        ))}
                    </div>

                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                        {escrowStats.map(({ plain, ...stat }) => (
                            <StatCard key={stat.label} loading={contractsQ.isLoading} small={!plain} {...stat} />
                        ))}
                    </div>

                    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
                        <div className="lg:col-span-7">
                            <WalletCard isClient={isClient} escrowCents={isClient ? undefined : escrow.lockedCents} />
                        </div>
                        <Card className="lg:col-span-5">
                            <CardHeader title={t('dashboard.wallet.title')} />
                            <div className="px-3 pb-4">
                                {walletQ.isLoading ? (
                                    <Skeleton className="mx-2 h-32" />
                                ) : walletQ.isError ? (
                                    <p className="px-2 py-6 text-center text-body-md text-secondary">
                                        {t('dashboard.wallet.loadError')}
                                    </p>
                                ) : (
                                    <TransactionList transactions={(walletQ.data?.transactions ?? []).slice(0, 8)} />
                                )}
                            </div>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
                        <Card className="lg:col-span-7">
                            <CardHeader title={isClient ? t('dashboard.latestJobs') : t('dashboard.latestProposals')} />
                            <div className="px-3 pb-4">
                                {loading ? (
                                    <Skeleton className="mx-2 h-32" />
                                ) : isClient ? (
                                    jobs.length === 0 ? (
                                        <EmptyState
                                            icon="work"
                                            title={t('dashboard.empty.jobsTitle')}
                                            description={t('dashboard.empty.jobsText')}
                                        />
                                    ) : (
                                        jobs.slice(0, 5).map((j) => (
                                            <Row
                                                key={j.id}
                                                to={`/jobs/${j.id}`}
                                                title={j.title}
                                                meta={`${formatMoney(j.budget)} · ${t('dashboard.meta.proposals', { count: j._count?.proposals ?? 0 })} · ${timeAgo(j.createdAt)}`}
                                                right={<StatusBadge status={j.status} />}
                                            />
                                        ))
                                    )
                                ) : proposals.length === 0 ? (
                                    <EmptyState
                                        icon="description"
                                        title={t('dashboard.empty.proposalsTitle')}
                                        description={t('dashboard.empty.proposalsText')}
                                    />
                                ) : (
                                    proposals.slice(0, 5).map((p) => (
                                        <Row
                                            key={p.id}
                                            to={`/jobs/${p.jobPost?.id}`}
                                            title={p.jobPost?.title}
                                            meta={`${t('dashboard.meta.bid', { amount: formatMoney(p.bidAmount) })} · ${timeAgo(p.createdAt)}`}
                                            right={<StatusBadge status={p.status} />}
                                        />
                                    ))
                                )}
                            </div>
                        </Card>

                        <Card className="lg:col-span-5">
                            <CardHeader title={t('dashboard.recentContracts')} />
                            <div className="px-3 pb-4">
                                {loading ? (
                                    <Skeleton className="mx-2 h-32" />
                                ) : contracts.length === 0 ? (
                                    <EmptyState
                                        icon="handshake"
                                        title={t('dashboard.empty.contractsTitle')}
                                        description={t('dashboard.empty.contractsText')}
                                    />
                                ) : (
                                    contracts.slice(0, 5).map((c) => (
                                        <Row
                                            key={c.id}
                                            to={`/contracts/${c.id}`}
                                            title={c.jobPost?.title}
                                            meta={`${t('dashboard.meta.with', { name: (isClient ? c.freelancer : c.client)?.fullName })} · ${timeAgo(c.createdAt)}`}
                                            right={<StatusBadge status={c.status} />}
                                        />
                                    ))
                                )}
                            </div>
                        </Card>
                    </div>
                </>
            )}
        </div>
    );
};

export default DashboardPage;
