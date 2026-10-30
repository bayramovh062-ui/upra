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
import { useDeleteProposalMutation, useGetMyProposalsQuery } from '../features/proposals/proposalsApi';
import { formatDate, formatMoney, getErrorMessage } from '../lib/format';

const MyProposalsPage = () => {
    const { data, isLoading, isError, refetch } = useGetMyProposalsQuery();
    const [deleteProposal, { isLoading: withdrawing }] = useDeleteProposalMutation();
    const [target, setTarget] = useState(null);

    const proposals = data?.proposals ?? [];

    const handleWithdraw = async () => {
        try {
            await deleteProposal({ id: target.id, jobPostId: target.jobPost?.id }).unwrap();
            toast.success('Proposal withdrawn');
            setTarget(null);
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not withdraw the proposal'));
        }
    };

    return (
        <>
            <PageHeader title="My proposals" description="Track every proposal you have sent." />

            {isLoading ? (
                <div className="flex flex-col gap-3">
                    {[0, 1, 2].map((i) => (
                        <Skeleton key={i} className="h-28 w-full" />
                    ))}
                </div>
            ) : isError ? (
                <ErrorState title="Could not load your proposals" onRetry={refetch} />
            ) : proposals.length === 0 ? (
                <EmptyState
                    icon="description"
                    title="No proposals yet"
                    description="Find a job and send your first proposal."
                    action={
                        <Link to="/jobs">
                            <Button>Find work</Button>
                        </Link>
                    }
                />
            ) : (
                <div className="flex flex-col gap-3">
                    {proposals.map((p) => (
                        <Card key={p.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                            <div className="min-w-0 flex-1">
                                <Link
                                    to={`/jobs/${p.jobPost?.id}`}
                                    className="block truncate text-title-md text-on-surface hover:text-primary-container"
                                >
                                    {p.jobPost?.title}
                                </Link>
                                <p className="mt-1 text-caption text-secondary">
                                    Sent {formatDate(p.createdAt)} · Budget {formatMoney(p.jobPost?.budget)}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-caption text-secondary">Your bid</p>
                                <p className="tabular text-title-md font-semibold text-on-surface">
                                    {formatMoney(p.bidAmount)}
                                </p>
                            </div>
                            <StatusBadge status={p.status} />
                            <div className="flex gap-2">
                                {p.status === 'PENDING' && p.jobPost?.status === 'OPEN' && (
                                    <>
                                        <Link to={`/jobs/${p.jobPost.id}`}>
                                            <Button variant="secondary" size="sm">
                                                <Icon name="edit" className="text-[16px]" />
                                                Edit
                                            </Button>
                                        </Link>
                                        <Button variant="ghost" size="sm" onClick={() => setTarget(p)}>
                                            Withdraw
                                        </Button>
                                    </>
                                )}
                                {p.status === 'ACCEPTED' && p.contract?.id && (
                                    <Link to={`/contracts/${p.contract.id}`}>
                                        <Button size="sm">
                                            <Icon name="view_kanban" className="text-[16px]" />
                                            Open workspace
                                        </Button>
                                    </Link>
                                )}
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            <ConfirmDialog
                open={!!target}
                onClose={() => setTarget(null)}
                onConfirm={handleWithdraw}
                loading={withdrawing}
                variant="danger"
                title="Withdraw this proposal?"
                message="The proposal will be deleted. You can send a new one later if the job is still open."
                confirmText="Withdraw"
            />
        </>
    );
};

export default MyProposalsPage;
