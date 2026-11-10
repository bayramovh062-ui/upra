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
import { useAcceptContractMutation, useDeclineContractMutation } from '../features/contracts/contractsApi';
import { isPendingOffer } from '../features/contracts/contractOffer';
import { formatDate, formatMoney, getErrorMessage } from '../lib/format';

const MyProposalsPage = () => {
    const { data, isLoading, isError, refetch } = useGetMyProposalsQuery();
    const [deleteProposal, { isLoading: withdrawing }] = useDeleteProposalMutation();
    const [target, setTarget] = useState(null);
    // Client təklif göndərib: frilanser workspace-dən əvvəl burada qəbul/rədd edir. { type: 'accept' | 'decline', proposal }
    const [offerAction, setOfferAction] = useState(null);
    const [acceptContract, { isLoading: accepting }] = useAcceptContractMutation();
    const [declineContract, { isLoading: declining }] = useDeclineContractMutation();

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

    const handleOffer = async () => {
        const { type, proposal } = offerAction;
        try {
            if (type === 'accept') {
                await acceptContract(proposal.contract.id).unwrap();
                toast.success('Offer accepted, the workspace is open');
            } else {
                await declineContract(proposal.contract.id).unwrap();
                toast.success('Offer declined');
            }
            setOfferAction(null);
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not update the offer'));
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
                    {proposals.map((p) => {
                        // Təklifin statusu qəbul olunandan sonra dəyişmir; real vəziyyət müqavilədədir
                        const contractStatus = p.contract?.status;
                        const displayStatus = p.status === 'ACCEPTED' && contractStatus ? contractStatus : p.status;
                        const offerPending = isPendingOffer(contractStatus);
                        return (
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
                            <StatusBadge status={displayStatus} />
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
                                {offerPending && p.contract?.id && (
                                    <>
                                        <Button variant="ghost" size="sm" onClick={() => setOfferAction({ type: 'decline', proposal: p })}>
                                            Decline
                                        </Button>
                                        <Button size="sm" onClick={() => setOfferAction({ type: 'accept', proposal: p })}>
                                            <Icon name="task_alt" className="text-[16px]" />
                                            Accept offer
                                        </Button>
                                    </>
                                )}
                                {p.status === 'ACCEPTED' && contractStatus === 'ACTIVE' && p.contract?.id && (
                                    <Link to={`/contracts/${p.contract.id}`}>
                                        <Button size="sm">
                                            <Icon name="view_kanban" className="text-[16px]" />
                                            Open workspace
                                        </Button>
                                    </Link>
                                )}
                                {p.status === 'ACCEPTED' && ['COMPLETED', 'CANCELLED'].includes(contractStatus) && p.contract?.id && (
                                    <Link to={`/contracts/${p.contract.id}`}>
                                        <Button variant="secondary" size="sm">
                                            View contract
                                        </Button>
                                    </Link>
                                )}
                            </div>
                        </Card>
                        );
                    })}
                </div>
            )}

            <ConfirmDialog
                open={!!offerAction}
                onClose={() => setOfferAction(null)}
                onConfirm={handleOffer}
                loading={accepting || declining}
                variant={offerAction?.type === 'decline' ? 'danger' : 'primary'}
                title={offerAction?.type === 'decline' ? 'Decline this contract offer?' : 'Accept this contract offer?'}
                message={
                    offerAction?.type === 'decline'
                        ? 'The client will be able to offer the job to another freelancer. You cannot undo this.'
                        : 'The contract becomes active and you can start working. The other proposals for this job will be rejected.'
                }
                confirmText={offerAction?.type === 'decline' ? 'Decline offer' : 'Accept offer'}
            />

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
