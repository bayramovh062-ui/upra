import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Button, Card, CardHeader, EmptyState, Icon } from '../components/ui';

// Skelet: real rəqəmlər və cədvəllər Jobs / Proposals / Contracts fazalarında bağlanacaq.
const STATS = {
    CLIENT: [
        { label: 'Open jobs', icon: 'work_outline' },
        { label: 'Proposals to review', icon: 'mark_email_unread' },
        { label: 'Active contracts', icon: 'handshake' },
        { label: 'Completed', icon: 'task_alt' },
    ],
    FREELANCER: [
        { label: 'Active contracts', icon: 'handshake' },
        { label: 'Pending proposals', icon: 'hourglass_top' },
        { label: 'Accepted proposals', icon: 'mark_email_read' },
        { label: 'Completed', icon: 'task_alt' },
    ],
};

const StatCard = ({ label, icon }) => (
    <div className="rounded-xl border border-line bg-surface-container-lowest p-4 shadow-sm transition-shadow hover:shadow-md">
        <div className="flex items-center justify-between">
            <span className="text-label-md text-secondary">{label}</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-fixed text-primary">
                <Icon name={icon} className="text-[18px]" />
            </span>
        </div>
        <p className="tabular mt-4 text-display-lg text-on-surface">—</p>
    </div>
);

const DashboardPage = () => {
    const user = useSelector((state) => state.auth.user);
    const isClient = user?.role === 'CLIENT';
    const firstName = user?.fullName?.split(' ')[0] ?? '';

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

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
                {(STATS[user?.role] || []).map((stat) => (
                    <StatCard key={stat.label} {...stat} />
                ))}
            </div>

            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
                <Card className="lg:col-span-8">
                    <CardHeader title={isClient ? 'My jobs' : 'Active projects'} />
                    <div className="px-5 pb-5">
                        <EmptyState
                            icon={isClient ? 'work' : 'view_kanban'}
                            title="Nothing here yet"
                            description="This section fills up as soon as the jobs and contracts pages are connected."
                        />
                    </div>
                </Card>

                <Card className="lg:col-span-4">
                    <CardHeader title="Recent activity" />
                    <div className="px-5 pb-5">
                        <EmptyState
                            icon="history"
                            title="No activity yet"
                            description="Proposals, contracts and board updates will show up here."
                        />
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default DashboardPage;
