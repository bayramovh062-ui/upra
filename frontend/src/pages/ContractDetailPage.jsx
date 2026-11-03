import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
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
    Modal,
    Skeleton,
    StatusBadge,
    Textarea,
} from '../components/ui';
import KanbanBoard from '../features/issues/KanbanBoard';
import { useGetIssuesQuery } from '../features/issues/issuesApi';
import {
    useAcceptCancellationMutation,
    useCancelContractMutation,
    useCompleteContractMutation,
    useDeclineCancellationMutation,
    useDeliverContractMutation,
    useGetContractQuery,
    useReopenContractMutation,
    useRequestCancellationMutation,
    useWithdrawCancellationMutation,
} from '../features/contracts/contractsApi';
import { formatDate, formatMoney, getErrorMessage } from '../lib/format';

const ContractDetailPage = () => {
    const { id } = useParams();
    const user = useSelector((state) => state.auth.user);
    // 'complete' | 'cancel' | 'deliver' | 'reopen' | 'acceptCancel' | 'declineCancel' | 'withdrawCancel' | null
    const [action, setAction] = useState(null);
    const [requestOpen, setRequestOpen] = useState(false); // ləğv təklifi pəncərəsi (səbəb yazılır)
    const [reason, setReason] = useState('');

    const { data, isLoading, isError, error, refetch } = useGetContractQuery(id);
    // Lövhə ilə eyni cache-dən oxunur (əlavə sorğu yaratmır). Bitirmə/təhvil xəbərdarlığı üçün lazımdır
    const issuesQ = useGetIssuesQuery(id);
    const unfinished = (issuesQ.data?.issues ?? []).filter((i) => i.status !== 'DONE').length;
    const [completeContract, { isLoading: completing }] = useCompleteContractMutation();
    const [cancelContract, { isLoading: cancelling }] = useCancelContractMutation();
    const [deliverContract, { isLoading: delivering }] = useDeliverContractMutation();
    const [reopenContract, { isLoading: reopening }] = useReopenContractMutation();
    const [requestCancellation, { isLoading: requesting }] = useRequestCancellationMutation();
    const [acceptCancellation, { isLoading: accepting }] = useAcceptCancellationMutation();
    const [declineCancellation, { isLoading: declining }] = useDeclineCancellationMutation();
    const [withdrawCancellation, { isLoading: withdrawing }] = useWithdrawCancellationMutation();

    if (isLoading) {
        return (
            <div className="flex flex-col gap-4">
                <Skeleton className="h-10 w-1/2" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    if (isError) {
        if ([400, 403, 404].includes(error?.status)) {
            return (
                <EmptyState
                    icon="lock"
                    title="Contract not available"
                    description="It does not exist or you are not a party to it."
                    action={
                        <Link to="/contracts">
                            <Button>Back to contracts</Button>
                        </Link>
                    }
                />
            );
        }
        return <ErrorState title="Could not load this contract" onRetry={refetch} />;
    }

    const { contract } = data;
    const isClient = user?.id === contract.clientId;
    const isFreelancer = user?.id === contract.freelancerId;
    const other = isClient ? contract.freelancer : contract.client;
    const active = contract.status === 'ACTIVE';
    const delivered = contract.status === 'DELIVERED';
    const open = active || delivered;
    // Gözləyən ləğv təklifi: kim göndərib, ona görə fərqli düymələr göstərilir
    const pendingCancel = open && !!contract.cancelRequestedById;
    const iRequestedCancel = pendingCancel && contract.cancelRequestedById === user?.id;
    const unfinishedText =
        unfinished > 0 ? `${unfinished} issue${unfinished === 1 ? ' is' : 's are'} not Done yet. ` : '';

    // Hər əməliyyat üçün: backend çağırışı, uğur mesajı və təsdiq pəncərəsinin mətni
    const ACTIONS = {
        complete: {
            run: completeContract,
            success: 'Contract completed',
            title: 'Mark contract as completed?',
            confirmText: 'Complete',
            variant: 'primary',
            message: `${unfinishedText}The contract and its job will be marked as completed. This cannot be undone.`,
        },
        cancel: {
            run: cancelContract,
            success: 'Contract cancelled',
            title: 'Cancel this contract?',
            confirmText: 'Cancel contract',
            variant: 'danger',
            message: 'Work has not started yet, so you can cancel right away. The contract and its job will be cancelled. This cannot be undone.',
        },
        acceptCancel: {
            run: acceptCancellation,
            success: 'Contract cancelled',
            title: 'Agree to cancel this contract?',
            confirmText: 'Agree and cancel',
            variant: 'danger',
            message: 'The contract and its job will be cancelled. This cannot be undone.',
        },
        declineCancel: {
            run: declineCancellation,
            success: 'Cancellation request declined, the contract continues',
            title: 'Decline the cancellation request?',
            confirmText: 'Decline',
            variant: 'primary',
            message: 'The contract stays open and work continues.',
        },
        withdrawCancel: {
            run: withdrawCancellation,
            success: 'Cancellation request withdrawn',
            title: 'Withdraw your cancellation request?',
            confirmText: 'Withdraw request',
            variant: 'primary',
            message: 'The contract stays open and work continues.',
        },
        deliver: {
            run: deliverContract,
            success: 'Work marked as delivered',
            title: 'Deliver the work?',
            confirmText: 'Deliver',
            variant: 'primary',
            message: `${unfinishedText}The client will be asked to review your work. The board becomes read-only until they accept it or request changes.`,
        },
        reopen: {
            run: reopenContract,
            success: 'Changes requested, the contract is active again',
            title: 'Request changes?',
            confirmText: 'Request changes',
            variant: 'primary',
            message: 'The contract goes back to Active and the freelancer can keep working on the board.',
        },
    };
    const current = action ? ACTIONS[action] : null;

    const handleConfirm = async () => {
        try {
            await current.run(contract.id).unwrap();
            toast.success(current.success);
            setAction(null);
        } catch (err) {
            toast.error(getErrorMessage(err, 'Action failed'));
        }
    };

    // İş başlayanda birbaşa ləğv olmur: səbəb yazılıb digər tərəfə təklif göndərilir
    const handleCancelClick = () => (contract.workStarted ? setRequestOpen(true) : setAction('cancel'));

    const closeRequest = () => {
        setRequestOpen(false);
        setReason('');
    };

    const handleSendRequest = async () => {
        try {
            await requestCancellation({ id: contract.id, reason: reason.trim() || undefined }).unwrap();
            toast.success('Cancellation request sent');
            closeRequest();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not send the request'));
        }
    };

    return (
        <>
            <Link
                to="/contracts"
                className="mb-4 inline-flex items-center gap-1 text-label-md text-secondary hover:text-primary-container"
            >
                <Icon name="arrow_back" className="text-[18px]" />
                Back to contracts
            </Link>

            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-caption font-semibold uppercase tracking-wide text-primary-container">
                            CTR-{contract.id.slice(0, 8)}
                        </span>
                        <StatusBadge status={contract.status} />
                    </div>
                    <h1 className="mt-2 break-words text-headline-lg text-on-surface">{contract.jobPost?.title}</h1>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                {/* Ləğv düyməsi hər iki tərəf üçündür; gözləyən təklif varsa, əvəzinə aşağıdakı bannerdə düymələr olur */}
                {(isClient || isFreelancer) && open && !pendingCancel && (
                    <Button variant="ghost" className="text-error hover:bg-error-container" onClick={handleCancelClick}>
                        {contract.workStarted ? 'Request cancellation' : 'Cancel contract'}
                    </Button>
                )}

                {isClient && open && (
                    <div className="flex flex-wrap gap-2">
                        {delivered && (
                            <Button variant="secondary" onClick={() => setAction('reopen')}>
                                <Icon name="undo" className="text-[18px]" />
                                Request changes
                            </Button>
                        )}
                        <Button onClick={() => setAction('complete')}>
                            <Icon name="task_alt" className="text-[18px]" />
                            {delivered ? 'Accept & complete' : 'Mark as completed'}
                        </Button>
                    </div>
                )}

                {isFreelancer && active && (
                    <Button onClick={() => setAction('deliver')}>
                        <Icon name="outbox" className="text-[18px]" />
                        Mark as delivered
                    </Button>
                )}
                </div>
            </div>

            {delivered && (
                <div className="mb-6 rounded-xl border border-line bg-warning-soft p-4 text-body-md text-warning-ink">
                    {isClient
                        ? 'The freelancer marked the work as delivered. Review it, then accept it or request changes.'
                        : 'You delivered the work. Waiting for the client to accept it or request changes.'}
                </div>
            )}

            {pendingCancel && (
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-error-container p-4 text-body-md text-on-surface">
                    <div className="min-w-0">
                        {iRequestedCancel ? (
                            <p>You asked to cancel this contract. Waiting for {other?.fullName} to respond.</p>
                        ) : (
                            <p>{other?.fullName} asked to cancel this contract.</p>
                        )}
                        {contract.cancelReason && (
                            <p className="mt-1 break-words text-secondary">Reason: {contract.cancelReason}</p>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {iRequestedCancel ? (
                            <Button variant="secondary" onClick={() => setAction('withdrawCancel')}>
                                Withdraw request
                            </Button>
                        ) : (
                            <>
                                <Button variant="secondary" onClick={() => setAction('declineCancel')}>
                                    Decline
                                </Button>
                                <Button variant="danger" onClick={() => setAction('acceptCancel')}>
                                    Agree and cancel
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            )}

            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                <Card className="p-5">
                    <p className="text-caption uppercase tracking-wider text-secondary">Contract value</p>
                    <p className="tabular mt-1 text-headline-md text-on-surface">
                        {formatMoney(contract.proposal?.bidAmount)}
                    </p>
                    <p className="mt-1 text-caption text-secondary">Job budget {formatMoney(contract.jobPost?.budget)}</p>
                </Card>
                <Card className="flex items-center gap-3 p-5">
                    <Avatar name={other?.fullName} size="lg" />
                    <div className="min-w-0">
                        <p className="text-caption uppercase tracking-wider text-secondary">
                            {isClient ? 'Freelancer' : 'Client'}
                        </p>
                        <p className="truncate text-title-md text-on-surface">{other?.fullName}</p>
                        {other?.id && (
                            <Link to={`/users/${other.id}`} className="text-label-sm text-primary hover:underline">
                                View profile
                            </Link>
                        )}
                    </div>
                </Card>
                <Card className="p-5">
                    <p className="text-caption uppercase tracking-wider text-secondary">Started</p>
                    <p className="mt-1 text-title-md text-on-surface">{formatDate(contract.createdAt)}</p>
                    <Link to={`/jobs/${contract.jobPostId}`} className="mt-1 inline-block text-label-sm text-primary hover:underline">
                        View original job
                    </Link>
                </Card>
            </div>

            <KanbanBoard contract={contract} readOnly={!active} />

            <ConfirmDialog
                open={!!action}
                onClose={() => setAction(null)}
                onConfirm={handleConfirm}
                loading={completing || cancelling || delivering || reopening || accepting || declining || withdrawing}
                variant={current?.variant}
                title={current?.title}
                message={current?.message}
                confirmText={current?.confirmText}
            />

            <Modal
                open={requestOpen}
                onClose={closeRequest}
                title="Request cancellation"
                footer={
                    <>
                        <Button variant="secondary" onClick={closeRequest} disabled={requesting}>
                            Keep contract
                        </Button>
                        <Button variant="danger" onClick={handleSendRequest} loading={requesting}>
                            Send request
                        </Button>
                    </>
                }
            >
                <p className="mb-3 text-body-md text-secondary">
                    Work has already started, so {other?.fullName} has to agree before the contract is cancelled. Until they
                    answer, the contract stays open.
                </p>
                <Textarea
                    label="Reason (optional)"
                    rows={3}
                    maxLength={500}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                />
            </Modal>
        </>
    );
};

export default ContractDetailPage;
