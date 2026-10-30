import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
    Button,
    Card,
    ConfirmDialog,
    EmptyState,
    ErrorState,
    Icon,
    PageHeader,
    Skeleton,
    StatusBadge,
} from '../components/ui';
import { useDeleteJobMutation, useGetMyJobsQuery } from '../features/jobs/jobsApi';
import { formatMoney, getErrorMessage, timeAgo } from '../lib/format';
import { cn } from '../lib/cn';

const TABS = [
    { key: 'ALL', label: 'All' },
    { key: 'OPEN', label: 'Open' },
    { key: 'IN_PROGRESS', label: 'In progress' },
    { key: 'COMPLETED', label: 'Completed' },
    { key: 'CANCELLED', label: 'Cancelled' },
];

const IconLink = ({ to, label, icon }) => (
    <Link
        to={to}
        title={label}
        aria-label={label}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-secondary transition-colors hover:bg-surface-container hover:text-primary-container"
    >
        <Icon name={icon} className="text-[18px]" />
    </Link>
);

// Client: "My jobs" cədvəli (Stitch client dashboard-dakı My jobs bölməsinin tam səhifə variantı)
const MyJobsPage = () => {
    const [tab, setTab] = useState('ALL');
    const [jobToCancel, setJobToCancel] = useState(null);

    const { data, isLoading, isError, refetch } = useGetMyJobsQuery();
    const [deleteJob, { isLoading: cancelling }] = useDeleteJobMutation();

    const jobs = data?.jobs ?? [];
    const countOf = (key) => (key === 'ALL' ? jobs.length : jobs.filter((j) => j.status === key).length);
    const visible = tab === 'ALL' ? jobs : jobs.filter((j) => j.status === tab);

    const confirmCancel = async () => {
        try {
            await deleteJob(jobToCancel.id).unwrap();
            toast.success('Job cancelled');
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not cancel the job'));
        } finally {
            setJobToCancel(null);
        }
    };

    return (
        <>
            <PageHeader
                title="My jobs"
                description="Everything you have posted, with the number of proposals each job received."
                action={
                    <Link to="/client/jobs/new">
                        <Button>
                            <Icon name="add" />
                            Post a new job
                        </Button>
                    </Link>
                }
            />

            <div className="mb-4 flex gap-1 overflow-x-auto">
                {TABS.map((t) => (
                    <button
                        key={t.key}
                        type="button"
                        onClick={() => setTab(t.key)}
                        className={cn(
                            'flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-body-md transition-colors',
                            tab === t.key
                                ? 'bg-inverse-surface font-medium text-on-primary shadow-sm'
                                : 'bg-surface-container-low text-secondary hover:bg-surface-container hover:text-on-surface'
                        )}
                    >
                        {t.label}
                        {!isLoading && <span className="tabular text-caption opacity-80">{countOf(t.key)}</span>}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <Card className="flex flex-col gap-4 p-5">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                    ))}
                </Card>
            ) : isError ? (
                <ErrorState title="Could not load your jobs" onRetry={refetch} />
            ) : visible.length === 0 ? (
                <EmptyState
                    icon="work"
                    title={tab === 'ALL' ? 'You have not posted any jobs yet' : 'No jobs in this tab'}
                    description={
                        tab === 'ALL'
                            ? 'Post your first job and freelancers will start sending proposals.'
                            : 'Jobs with this status will show up here.'
                    }
                    action={
                        tab === 'ALL' && (
                            <Link to="/client/jobs/new">
                                <Button>
                                    <Icon name="add" />
                                    Post a job
                                </Button>
                            </Link>
                        )
                    }
                />
            ) : (
                <Card className="overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[720px] text-left">
                            <thead>
                                <tr className="border-b border-line bg-surface-container-low text-label-sm uppercase tracking-wider text-secondary">
                                    <th className="px-5 py-3 font-semibold">Job</th>
                                    <th className="px-5 py-3 font-semibold">Status</th>
                                    <th className="px-5 py-3 text-right font-semibold">Budget</th>
                                    <th className="px-5 py-3 text-right font-semibold">Proposals</th>
                                    <th className="px-5 py-3 text-right font-semibold">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visible.map((job) => {
                                    const isOpen = job.status === 'OPEN';
                                    return (
                                        <tr
                                            key={job.id}
                                            className="border-b border-line last:border-0 hover:bg-surface-container-low/60"
                                        >
                                            <td className="max-w-[320px] px-5 py-4">
                                                <Link
                                                    to={`/jobs/${job.id}`}
                                                    className="line-clamp-1 text-title-md text-on-surface transition-colors hover:text-primary-container"
                                                >
                                                    {job.title}
                                                </Link>
                                                <p className="text-caption text-secondary">
                                                    Posted {timeAgo(job.createdAt)}
                                                </p>
                                            </td>
                                            <td className="px-5 py-4">
                                                <StatusBadge status={job.status} />
                                            </td>
                                            <td className="tabular px-5 py-4 text-right text-body-md text-on-surface">
                                                {formatMoney(job.budget)}
                                            </td>
                                            <td className="tabular px-5 py-4 text-right text-body-md text-on-surface">
                                                {job._count?.proposals ?? 0}
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex justify-end gap-1">
                                                    <IconLink
                                                        to={`/client/jobs/${job.id}/proposals`}
                                                        label="View proposals"
                                                        icon="inbox"
                                                    />
                                                    {isOpen && (
                                                        <>
                                                            <IconLink
                                                                to={`/client/jobs/${job.id}/edit`}
                                                                label="Edit job"
                                                                icon="edit"
                                                            />
                                                            <button
                                                                type="button"
                                                                title="Cancel job"
                                                                aria-label="Cancel job"
                                                                onClick={() => setJobToCancel(job)}
                                                                className="flex h-8 w-8 items-center justify-center rounded-lg text-secondary transition-colors hover:bg-error-container hover:text-error"
                                                            >
                                                                <Icon name="delete_outline" className="text-[18px]" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            <ConfirmDialog
                open={Boolean(jobToCancel)}
                onClose={() => setJobToCancel(null)}
                onConfirm={confirmCancel}
                loading={cancelling}
                variant="danger"
                title="Cancel this job?"
                message={`“${jobToCancel?.title ?? ''}” will be closed and freelancers can no longer send proposals. This cannot be undone.`}
                confirmText="Cancel job"
            />
        </>
    );
};

export default MyJobsPage;
