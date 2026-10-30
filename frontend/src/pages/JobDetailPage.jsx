import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import {
    Avatar,
    Button,
    Card,
    ConfirmDialog,
    EmptyState,
    ErrorState,
    Icon,
    Skeleton,
    StatusBadge,
} from '../components/ui';
import { useDeleteJobMutation, useGetJobQuery } from '../features/jobs/jobsApi';
import ProposalForm from '../features/proposals/ProposalForm';
import ProposalEditForm from '../features/proposals/ProposalEditForm';
import { useDeleteProposalMutation } from '../features/proposals/proposalsApi';
import { formatDate, formatMoney, getErrorMessage, timeAgo } from '../lib/format';

const DetailSkeleton = () => (
    <div className="flex flex-col gap-6 lg:flex-row">
        <Card className="flex-1 p-6">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-4 h-8 w-3/4" />
            <Skeleton className="mt-8 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-2/3" />
        </Card>
        <Card className="h-80 w-full p-6 lg:w-[360px]">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="mt-6 h-10 w-full" />
            <Skeleton className="mt-4 h-28 w-full" />
        </Card>
    </div>
);

// Frilanser: təklif göndərib və ya göndərməyib
const MyProposalCard = ({ proposal, job }) => {
    const [editing, setEditing] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [deleteProposal, { isLoading: withdrawing }] = useDeleteProposalMutation();
    const canChange = proposal.status === 'PENDING' && job.status === 'OPEN';

    if (editing) {
        return <ProposalEditForm proposal={proposal} jobPostId={job.id} onDone={() => setEditing(false)} />;
    }

    const handleWithdraw = async () => {
        try {
            await deleteProposal({ id: proposal.id, jobPostId: job.id }).unwrap();
            toast.success('Proposal withdrawn');
            setConfirmOpen(false);
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not withdraw the proposal'));
        }
    };

    return (
    <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3 rounded-xl bg-secondary-container p-4">
            <Icon name="check_circle" filled className="mt-0.5 text-[24px] text-primary-container" />
            <div>
                <p className="text-title-md text-on-secondary-fixed">Proposal submitted</p>
                <p className="mt-0.5 text-caption text-on-secondary-container">
                    Sent {timeAgo(proposal.createdAt)}
                </p>
            </div>
        </div>

        <div className="flex flex-col gap-2.5 rounded-xl bg-surface-container-low p-4 text-body-md">
            <div className="flex items-center justify-between">
                <span className="text-secondary">Your bid</span>
                <span className="tabular font-semibold text-on-surface">{formatMoney(proposal.bidAmount)}</span>
            </div>
            <div className="flex items-center justify-between">
                <span className="text-secondary">Status</span>
                <StatusBadge status={proposal.status} />
            </div>
        </div>

        <div className="rounded-xl bg-surface-container-low p-4">
            <p className="mb-1 text-label-sm font-semibold text-on-surface">Your cover letter</p>
            <p className="line-clamp-4 whitespace-pre-line break-words text-body-md italic text-on-surface-variant">
                {proposal.coverLetter}
            </p>
        </div>

        {canChange && (
            <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => setEditing(true)}>
                    <Icon name="edit" className="text-[16px]" />
                    Edit
                </Button>
                <Button
                    variant="ghost"
                    className="flex-1 text-error hover:bg-error-container"
                    onClick={() => setConfirmOpen(true)}
                >
                    Withdraw
                </Button>
            </div>
        )}

        <Link to="/freelancer/proposals">
            <Button variant="secondary" className="w-full">
                View my proposals
            </Button>
        </Link>

        <ConfirmDialog
            open={confirmOpen}
            onClose={() => setConfirmOpen(false)}
            onConfirm={handleWithdraw}
            loading={withdrawing}
            variant="danger"
            title="Withdraw this proposal?"
            message="The proposal will be deleted. You can send a new one while the job is open."
            confirmText="Withdraw"
        />
    </div>
    );
};

// Client: öz elanını idarə edir
const OwnerCard = ({ job, onCancel }) => {
    const proposals = job._count?.proposals ?? 0;
    const isOpen = job.status === 'OPEN';

    return (
        <div className="flex flex-col gap-3">
            <div>
                <h3 className="text-headline-sm text-on-surface">Manage this job</h3>
                <p className="text-caption text-secondary">You posted this job</p>
            </div>

            <Link to={`/client/jobs/${job.id}/proposals`}>
                <Button className="w-full">
                    <Icon name="inbox" />
                    View proposals ({proposals})
                </Button>
            </Link>

            {isOpen ? (
                <>
                    <Link to={`/client/jobs/${job.id}/edit`}>
                        <Button variant="secondary" className="w-full">
                            <Icon name="edit" />
                            Edit job
                        </Button>
                    </Link>
                    <Button variant="ghost" className="w-full text-error hover:bg-error-container" onClick={onCancel}>
                        <Icon name="delete_outline" />
                        Cancel job
                    </Button>
                </>
            ) : (
                <p className="rounded-lg bg-surface-container-low px-3 py-2 text-label-sm text-secondary">
                    Only open jobs can be edited or cancelled.
                </p>
            )}
        </div>
    );
};

// Stitch "job details & proposal" dizaynı: solda məzmun, sağda yapışqan əməliyyat kartı
const JobDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const user = useSelector((state) => state.auth.user);
    const [confirmOpen, setConfirmOpen] = useState(false);

    const { data, isLoading, isError, error, refetch } = useGetJobQuery(id);
    const [deleteJob, { isLoading: cancelling }] = useDeleteJobMutation();

    const backTo = user?.role === 'FREELANCER' ? '/jobs' : '/client/jobs';
    const backLabel = user?.role === 'FREELANCER' ? 'Back to jobs' : 'Back to my jobs';

    if (isLoading) return <DetailSkeleton />;

    if (isError) {
        if (error?.status === 404 || error?.status === 400) {
            return (
                <EmptyState
                    icon="search_off"
                    title="Job not found"
                    description="This job does not exist or the link is wrong."
                    action={
                        <Link to={backTo}>
                            <Button>{backLabel}</Button>
                        </Link>
                    }
                />
            );
        }
        return <ErrorState title="Could not load this job" onRetry={refetch} />;
    }

    const { job, myProposal } = data;
    const isOwner = user?.role === 'CLIENT' && job.client?.id === user.id;
    const isFreelancer = user?.role === 'FREELANCER';
    const proposals = job._count?.proposals ?? 0;

    const handleCancel = async () => {
        try {
            await deleteJob(job.id).unwrap();
            toast.success('Job cancelled');
            setConfirmOpen(false);
            // Yalnız elanın sahibi (CLIENT) ləğv edə bilir
            navigate('/client/jobs', { replace: true });
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not cancel the job'));
        }
    };

    return (
        <>
            <Link
                to={backTo}
                className="mb-4 inline-flex items-center gap-1 text-label-md text-secondary transition-colors hover:text-primary-container"
            >
                <Icon name="arrow_back" className="text-[18px]" />
                {backLabel}
            </Link>

            <div className="flex flex-col items-start gap-6 lg:flex-row">
                {/* Sol: elan məzmunu */}
                <div className="flex w-full min-w-0 flex-1 flex-col gap-6">
                    <Card className="p-6 sm:p-8">
                        <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge status={job.status} />
                            <span className="text-label-sm text-secondary">Posted {timeAgo(job.createdAt)}</span>
                        </div>
                        <h1 className="mt-3 break-words text-headline-lg text-on-surface">{job.title}</h1>

                        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                            <div className="rounded-xl bg-surface-container-low p-4">
                                <p className="text-caption text-secondary">Fixed budget</p>
                                <p className="tabular mt-1 text-headline-md text-on-surface">{formatMoney(job.budget)}</p>
                            </div>
                            <div className="rounded-xl bg-surface-container-low p-4">
                                <p className="text-caption text-secondary">Proposals</p>
                                <p className="tabular mt-1 text-headline-md text-on-surface">{proposals}</p>
                            </div>
                            <div className="col-span-2 rounded-xl bg-surface-container-low p-4 sm:col-span-1">
                                <p className="text-caption text-secondary">Posted on</p>
                                <p className="mt-1 text-title-md text-on-surface">{formatDate(job.createdAt)}</p>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-6 sm:p-8">
                        <h2 className="mb-3 flex items-center gap-2 text-headline-sm text-on-surface">
                            <Icon name="subject" className="text-[22px] text-primary-container" />
                            Project overview
                        </h2>
                        <p className="whitespace-pre-line break-words text-body-lg leading-relaxed text-on-surface-variant">
                            {job.description}
                        </p>
                    </Card>

                    <Card className="flex items-start gap-3 p-5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-fixed text-primary">
                            <Icon name="view_kanban" />
                        </span>
                        <div>
                            <p className="text-title-md text-on-surface">A shared board starts with the contract</p>
                            <p className="mt-0.5 text-body-md text-secondary">
                                When the client accepts a proposal, a Kanban board is created automatically and both
                                sides track the work there in real time.
                            </p>
                        </div>
                    </Card>
                </div>

                {/* Sağ: əməliyyat kartı + müştəri haqqında */}
                <div className="flex w-full flex-col gap-6 lg:sticky lg:top-24 lg:w-[360px] lg:shrink-0">
                    <Card className="p-6">
                        {isOwner ? (
                            <OwnerCard job={job} onCancel={() => setConfirmOpen(true)} />
                        ) : isFreelancer && myProposal ? (
                            <MyProposalCard proposal={myProposal} job={job} />
                        ) : isFreelancer && job.status === 'OPEN' ? (
                            <ProposalForm job={job} />
                        ) : isFreelancer ? (
                            <div className="flex flex-col items-center gap-2 text-center">
                                <Icon name="lock" className="text-[28px] text-secondary" />
                                <p className="text-title-md text-on-surface">Not accepting proposals</p>
                                <p className="text-body-md text-secondary">
                                    This job is {job.status === 'CANCELLED' ? 'cancelled' : 'no longer open'}.
                                </p>
                            </div>
                        ) : (
                            <p className="text-body-md text-secondary">
                                Only freelancers can send proposals. You are viewing this job as a client.
                            </p>
                        )}
                    </Card>

                    <Card className="p-6">
                        <p className="mb-4 text-label-sm uppercase tracking-wider text-secondary">About the client</p>
                        <div className="flex items-center gap-3">
                            <Avatar name={job.client?.fullName} size="lg" />
                            <div className="min-w-0">
                                <p className="truncate text-title-md text-on-surface">{job.client?.fullName}</p>
                                <p className="text-caption text-secondary">
                                    Member since {formatDate(job.client?.createdAt)}
                                </p>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>

            <ConfirmDialog
                open={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                onConfirm={handleCancel}
                loading={cancelling}
                variant="danger"
                title="Cancel this job?"
                message="The job will be closed and freelancers will no longer be able to send proposals. This cannot be undone."
                confirmText="Cancel job"
            />
        </>
    );
};

export default JobDetailPage;
