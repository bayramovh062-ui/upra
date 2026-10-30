import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Button, Card, CardBody, CardHeader, EmptyState, PageHeader } from '../components/ui';

// Faza 1: skelet. Real statistika və cədvəllər sonrakı fazalarda (Jobs/Proposals/Contracts) gələcək.
const STATS = {
    CLIENT: ['Open jobs', 'Proposals to review', 'Active contracts', 'Completed'],
    FREELANCER: ['Active contracts', 'Pending proposals', 'Accepted proposals', 'Total earned'],
};

const DashboardPage = () => {
    const user = useSelector((state) => state.auth.user);
    const isClient = user?.role === 'CLIENT';

    return (
        <>
            <PageHeader
                title={`Welcome back, ${user?.fullName?.split(' ')[0] ?? ''}`}
                description={
                    isClient
                        ? 'Manage your jobs and review incoming proposals.'
                        : 'Track your proposals and active projects.'
                }
                action={
                    isClient ? (
                        <Link to="/client/jobs/new">
                            <Button>Post a new job</Button>
                        </Link>
                    ) : (
                        <Link to="/jobs">
                            <Button>Find work</Button>
                        </Link>
                    )
                }
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {(STATS[user?.role] || []).map((label) => (
                    <Card key={label}>
                        <CardBody>
                            <p className="text-sm text-muted">{label}</p>
                            <p className="mt-2 text-3xl font-bold text-ink">—</p>
                        </CardBody>
                    </Card>
                ))}
            </div>

            <Card className="mt-6">
                <CardHeader title={isClient ? 'My jobs' : 'Active projects'} />
                <CardBody>
                    <EmptyState
                        title="Nothing here yet"
                        description="This section will fill up as soon as the jobs and contracts features are connected."
                    />
                </CardBody>
            </Card>
        </>
    );
};

export default DashboardPage;
