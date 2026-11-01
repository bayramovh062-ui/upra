import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Button, Card, CardHeader, EmptyState, ErrorState, Icon, Skeleton, StatusBadge } from '../components/ui';
import { useGetMyContractsQuery } from '../features/contracts/contractsApi';
import { useGetMyJobsQuery } from '../features/jobs/jobsApi';
import { useGetMyProposalsQuery } from '../features/proposals/proposalsApi';
import { formatMoney, timeAgo } from '../lib/format';

const StatCard = ({ label, icon, value, loading }) => (
    <div className="rounded-xl border border-line bg-surface-container-lowest p-4 shadow-sm transition-shadow hover:shadow-md">
        <div className="flex items-center justify-between">
            <span className="text-label-md text-secondary">{label}</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-fixed text-primary">
                <Icon name={icon} className="text-[18px]" />
            </span>
        </div>
        {loading ? (
            <Skeleton className="mt-4 h-9 w-16" />
        ) : (
            <p className="tabular mt-4 text-display-lg text-on-surface">{value}</p>
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
    const user = useSelector((state) => state.auth.user);
    const isClient = user?.role === 'CLIENT';
    const firstName = user?.fullName?.split(' ')[0] ?? '';

    // Hər rol yalnız öz endpoint-lərini çağırır (backend rola görə 403 qaytarardı)
    const jobsQ = useGetMyJobsQuery(undefined, { skip: !isClient });
    const proposalsQ = useGetMyProposalsQuery(undefined, { skip: isClient });
    const contractsQ = useGetMyContractsQuery();

    const jobs = jobsQ.data?.jobs ?? [];
    const proposals = proposalsQ.data?.proposals ?? [];
    const contracts = contractsQ.data?.contracts ?? [];

    const countContracts = (status) => contracts.filter((c) => c.status === status).length;
    const openJobs = jobs.filter((j) => j.status === 'OPEN');

    const loading = contractsQ.isLoading || (isClient ? jobsQ.isLoading : proposalsQ.isLoading);
    const failed = contractsQ.isError || (isClient ? jobsQ.isError : proposalsQ.isError);

    const stats = isClient
        ? [
              { label: 'Open jobs', icon: 'work_outline', value: openJobs.length },
              {
                  label: 'Proposals to review',
                  icon: 'mark_email_unread',
                  value: openJobs.reduce((sum, j) => sum + (j._count?.proposals ?? 0), 0),
              },
              { label: 'Active contracts', icon: 'handshake', value: countContracts('ACTIVE') },
              { label: 'Completed', icon: 'task_alt', value: countContracts('COMPLETED') },
          ]
        : [
              { label: 'Active contracts', icon: 'handshake', value: countContracts('ACTIVE') },
              {
                  label: 'Pending proposals',
                  icon: 'hourglass_top',
                  value: proposals.filter((p) => p.status === 'PENDING').length,
              },
              {
                  label: 'Accepted proposals',
                  icon: 'mark_email_read',
                  value: proposals.filter((p) => p.status === 'ACCEPTED').length,
              },
              { label: 'Completed', icon: 'task_alt', value: countContracts('COMPLETED') },
          ];

    const retry = () => {
        contractsQ.refetch();
        (isClient ? jobsQ : proposalsQ).refetch();
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col justify-between gap-4 rounded-xl border border-line bg-surface-container-lowest p-6 shadow-sm md:flex-row md:items-center">
                <div>
                    <h1 className="text-headline-lg text-on-surface">Welcome back, {firstName}</h1>
                    <p className="mt-1 text-body-md text-secondary">
                        {isClient
                            ? 'Manage your jobs, review proposals and follow your active contracts.'
                            : 'Track your proposals and work on your active projects.'}
                    </p>
                </div>
                {isClient ? (
                    <Link to="/client/jobs/new" className="shrink-0">
                        <Button>
                            <Icon name="add" />
                            Post a new job
                        </Button>
                    </Link>
                ) : (
                    <Link to="/jobs" className="shrink-0">
                        <Button>
                            <Icon name="search" />
                            Find work
                        </Button>
                    </Link>
                )}
            </div>

            {failed ? (
                <ErrorState title="Could not load your dashboard" onRetry={retry} />
            ) : (
                <>
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
                        {stats.map((stat) => (
                            <StatCard key={stat.label} loading={loading} {...stat} />
                        ))}
                    </div>

                    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
                        <Card className="lg:col-span-7">
                            <CardHeader title={isClient ? 'Latest jobs' : 'Latest proposals'} />
                            <div className="px-3 pb-4">
                                {loading ? (
                                    <Skeleton className="mx-2 h-32" />
                                ) : isClient ? (
                                    jobs.length === 0 ? (
                                        <EmptyState
                                            icon="work"
                                            title="No jobs yet"
                                            description="Post your first job to start receiving proposals."
                                        />
                                    ) : (
                                        jobs.slice(0, 5).map((j) => (
                                            <Row
                                                key={j.id}
                                                to={`/jobs/${j.id}`}
                                                title={j.title}
                                                meta={`${formatMoney(j.budget)} · ${j._count?.proposals ?? 0} proposals · ${timeAgo(j.createdAt)}`}
                                                right={<StatusBadge status={j.status} />}
                                            />
                                        ))
                                    )
                                ) : proposals.length === 0 ? (
                                    <EmptyState
                                        icon="description"
                                        title="No proposals yet"
                                        description="Find a job and send your first proposal."
                                    />
                                ) : (
                                    proposals.slice(0, 5).map((p) => (
                                        <Row
                                            key={p.id}
                                            to={`/jobs/${p.jobPost?.id}`}
                                            title={p.jobPost?.title}
                                            meta={`Your bid ${formatMoney(p.bidAmount)} · ${timeAgo(p.createdAt)}`}
                                            right={<StatusBadge status={p.status} />}
                                        />
                                    ))
                                )}
                            </div>
                        </Card>

                        <Card className="lg:col-span-5">
                            <CardHeader title="Recent contracts" />
                            <div className="px-3 pb-4">
                                {loading ? (
                                    <Skeleton className="mx-2 h-32" />
                                ) : contracts.length === 0 ? (
                                    <EmptyState
                                        icon="handshake"
                                        title="No contracts yet"
                                        description="Contracts appear here once a proposal is accepted."
                                    />
                                ) : (
                                    contracts.slice(0, 5).map((c) => (
                                        <Row
                                            key={c.id}
                                            to={`/contracts/${c.id}`}
                                            title={c.jobPost?.title}
                                            meta={`With ${(isClient ? c.freelancer : c.client)?.fullName} · ${timeAgo(c.createdAt)}`}
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
