import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
    Select,
    Skeleton,
    StatusBadge,
    Textarea,
} from '../components/ui';
import KanbanBoard from '../features/issues/KanbanBoard';
import EscrowPanel from '../features/escrow/EscrowPanel';
import { calcCommissionCents, hasReachedRevisionLimit, summarizeMilestones } from '../features/escrow/escrow';
import {
    useApproveMilestoneMutation,
    useGetContractHistoryQuery,
    useRequestMilestoneChangesMutation,
    useSubmitMilestoneMutation,
} from '../features/escrow/escrowApi';
import { useCreateReportMutation } from '../features/reports/reportsApi';
import { useUploadReportFilesMutation } from '../features/attachments/attachmentsApi';
import { useGetIssuesQuery } from '../features/issues/issuesApi';
import { FilePicker } from '../features/attachments/AttachmentComponents';
import {
    useAcceptCancellationMutation,
    useAcceptContractMutation,
    useCancelContractMutation,
    useCompleteContractMutation,
    useDeclineCancellationMutation,
    useDeclineContractMutation,
    useGetContractQuery,
    useRequestCancellationMutation,
    useWithdrawCancellationMutation,
} from '../features/contracts/contractsApi';
import { canRespondToOffer, isPendingOffer } from '../features/contracts/contractOffer';
import { useOpenConversationMutation } from '../features/chat/chatApi';
import ContractReviews from '../features/reviews/ContractReviews';
import ReviewModal from '../features/reviews/ReviewModal';
import { cn } from '../lib/cn';
import { DEMO_MONEY_NOTE } from '../lib/demo';
import { formatCents, formatDate, formatMoney, getErrorMessage } from '../lib/format';

const ContractDetailPage = () => {
    const { id } = useParams();
    const user = useSelector((state) => state.auth.user);
    const navigate = useNavigate();
    // 'complete' | 'cancel' | 'acceptCancel' | 'declineCancel' | 'withdrawCancel' | 'acceptOffer' | 'declineOffer' | null
    const [action, setAction] = useState(null);
    const [requestOpen, setRequestOpen] = useState(false); // ləğv təklifi pəncərəsi (səbəb yazılır)
    const [reason, setReason] = useState('');
    // Tab URL-də saxlanılır (?tab=escrow): link paylaşılanda və səhifə yenilənəndə qalır
    const [searchParams, setSearchParams] = useSearchParams();
    const tab = searchParams.get('tab') === 'escrow' ? 'escrow' : 'board';
    const selectTab = (key) => setSearchParams(key === 'board' ? {} : { tab: key }, { replace: true });

    const { data, isLoading, isError, error, refetch } = useGetContractQuery(id);
    // Lövhə ilə eyni cache-dən oxunur (əlavə sorğu yaratmır). Bitirmə/təhvil xəbərdarlığı üçün lazımdır
    const issuesQ = useGetIssuesQuery(id);
    const unfinished = (issuesQ.data?.issues ?? []).filter((i) => i.status !== 'DONE').length;
    const [completeContract, { isLoading: completing }] = useCompleteContractMutation();
    const [cancelContract, { isLoading: cancelling }] = useCancelContractMutation();
    const [requestCancellation, { isLoading: requesting }] = useRequestCancellationMutation();
    const [acceptCancellation, { isLoading: accepting }] = useAcceptCancellationMutation();
    const [declineCancellation, { isLoading: declining }] = useDeclineCancellationMutation();
    const [withdrawCancellation, { isLoading: withdrawing }] = useWithdrawCancellationMutation();
    const [acceptContract, { isLoading: acceptingOffer }] = useAcceptContractMutation();
    const [declineContract, { isLoading: decliningOffer }] = useDeclineContractMutation();
    const [openConversation, { isLoading: openingChat }] = useOpenConversationMutation();
    // Başlıqdakı qısayol düymələr: aktiv mərhələyə bağlı işləyir (Escrow tabındakı ilə eyni əməliyyatlar)
    const [msAction, setMsAction] = useState(null); // { type: 'submit' | 'approve' | 'changes', milestone }
    const [submitMilestone, { isLoading: submittingMs }] = useSubmitMilestoneMutation();
    const [approveMilestone, { isLoading: approvingMs }] = useApproveMilestoneMutation();
    const [requestChanges, { isLoading: requestingMs }] = useRequestMilestoneChangesMutation();
    // P2: mübahisə vəziyyəti (tərəflər üçün) və şikayət pəncərəsi
    const historyQ = useGetContractHistoryQuery(id);
    const [reportOpen, setReportOpen] = useState(false);
    const [reportTarget, setReportTarget] = useState('CONTRACT');
    const [reportReason, setReportReason] = useState('');
    const [reportDetails, setReportDetails] = useState('');
    const [reportFiles, setReportFiles] = useState([]);
    const [createReport, { isLoading: reporting }] = useCreateReportMutation();
    const [uploadReportFiles, { isLoading: uploadingReportFiles }] = useUploadReportFilesMutation();
    // P3: müqavilə bitəndə (client "Complete" edəndə) rəy pəncərəsi avtomatik açılır; frilanser bannerdəki düymə ilə açır
    const [reviewOpen, setReviewOpen] = useState(false);

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
    // Təhvil milestone səviyyəsindədir (Escrow tabı); müqavilə yalnız ACTIVE olur
    const active = contract.status === 'ACTIVE';
    const open = active;
    // Client təklif göndərib, frilanser hələ cavab verməyib: iş başlamayıb, pul hərəkəti yoxdur
    const pendingOffer = isPendingOffer(contract.status);
    const canRespond = canRespondToOffer(contract, user?.id);
    // Gözləyən ləğv təklifi: kim göndərib, ona görə fərqli düymələr göstərilir
    const pendingCancel = open && !!contract.cancelRequestedById;
    const iRequestedCancel = pendingCancel && contract.cancelRequestedById === user?.id;
    const unfinishedText =
        unfinished > 0 ? `${unfinished} issue${unfinished === 1 ? ' is' : 's are'} not Done yet. ` : '';

    // Escrow: mərhələlərdən hesablanır (ayrıca saxlanılmır)
    const milestones = contract.milestones ?? [];
    const { lockedCents, paid: paidCount, total: milestoneTotal } = summarizeMilestones(milestones, isFreelancer);
    // Pul qapısı 1: escrow-da pul olmadan lövhədə iş başlamır (backend də yoxlayır)
    // DISPUTED da pulu escrow-da saxlayır, ona görə lövhə kilidi dəyişmir
    const boardLocked =
        active && !milestones.some((m) => ['FUNDED', 'IN_REVIEW', 'DISPUTED'].includes(m.status));
    // Pul qapısı 2: bütün mərhələlər ödənilmədən müqavilə bitmir
    const live = milestones.filter((m) => m.status !== 'CANCELLED');
    const allPaid = live.length > 0 && live.every((m) => m.status === 'PAID');
    // Client üçün yoxlama gözləyən, frilanser üçün təhvil gözləyən mərhələlər; açıq mübahisə hər ikisi üçün diqqət tələb edir
    const escrowAttention = open
        ? milestones.filter(
              (m) =>
                  m.status === 'DISPUTED' ||
                  (isClient ? m.status === 'IN_REVIEW' : isFreelancer ? m.status === 'FUNDED' : false)
          ).length
        : 0;
    // Açıq mübahisələr: pul donub, submit/approve/auto-approve dayanıb
    const openDisputes = (historyQ.data?.disputes ?? []).filter((d) => d.status === 'OPEN');
    // Şikayət hədəfi: bu müqavilə, qarşı tərəf və ya orijinal iş
    const reportTargets = [
        { key: 'CONTRACT', label: 'This contract', id: contract.id },
        ...(other?.id ? [{ key: 'USER', label: `${other.fullName} (the other party)`, id: other.id }] : []),
        ...(contract.jobPostId ? [{ key: 'JOB', label: 'The original job post', id: contract.jobPostId }] : []),
    ];
    const reportTargetId = reportTargets.find((t) => t.key === reportTarget)?.id;
    const refundText =
        lockedCents > 0 ? ` ${formatCents(lockedCents)} held in escrow is refunded to the client's wallet.` : '';
    // Backend: bütün mərhələlər PAID olmayana qədər müqaviləni bitirmək olmur
    const completeBlocked = !allPaid;
    // Aktiv mərhələlər: frilanser FUNDED-i təhvil verir, client IN_REVIEW-u təsdiqləyir və ya geri qaytarır
    const fundedMilestone = milestones.find((m) => m.status === 'FUNDED');
    const reviewMilestone = milestones.find((m) => m.status === 'IN_REVIEW');
    const MS_ACTIONS = {
        submit: { run: submitMilestone, success: 'Milestone submitted for review' },
        approve: { run: approveMilestone, success: 'Milestone approved and paid' },
        changes: { run: requestChanges, success: 'Changes requested' },
    };
    const msDialog = msAction
        ? {
              submit: {
                  title: 'Submit for review?',
                  confirmText: 'Submit for review',
                  variant: 'primary',
                  message: 'The client will review this milestone. If they do not respond, it is approved automatically after 7 days.',
              },
              approve: {
                  title: 'Approve and pay?',
                  confirmText: 'Approve & pay',
                  variant: 'primary',
                  message: `${formatCents(msAction.milestone.amountCents)} is released to the freelancer. A 10% platform fee (${formatCents(calcCommissionCents(msAction.milestone.amountCents))}) is taken from the freelancer's payout. This cannot be undone. ${DEMO_MONEY_NOTE}`,
              },
              changes: {
                  title: 'Request changes?',
                  confirmText: 'Request changes',
                  variant: 'secondary',
                  message: 'The milestone goes back to the freelancer. The money stays in escrow.',
              },
          }[msAction.type]
        : null;

    const handleMsConfirm = async () => {
        const { type, milestone } = msAction;
        try {
            await MS_ACTIONS[type].run({ id: milestone.id, contractId: contract.id }).unwrap();
            toast.success(MS_ACTIONS[type].success);
        } catch (err) {
            toast.error(getErrorMessage(err, 'Action failed'));
        } finally {
            setMsAction(null);
        }
    };

    // Hər əməliyyat üçün: backend çağırışı, uğur mesajı və təsdiq pəncərəsinin mətni
    const ACTIONS = {
        complete: {
            run: completeContract,
            success: 'Contract completed',
            title: 'Mark contract as completed?',
            confirmText: 'Complete',
            variant: 'primary',
            message: `${unfinishedText}All milestones are paid. The contract and its job will be marked as completed. This cannot be undone.`,
        },
        cancel: {
            run: cancelContract,
            success: 'Contract cancelled',
            title: 'Cancel this contract?',
            confirmText: 'Cancel contract',
            variant: 'danger',
            message: `Work has not started yet, so you can cancel right away. The contract and its job will be cancelled.${refundText} This cannot be undone.`,
        },
        acceptCancel: {
            run: acceptCancellation,
            success: 'Contract cancelled',
            title: 'Agree to cancel this contract?',
            confirmText: 'Agree and cancel',
            variant: 'danger',
            message: `The contract and its job will be cancelled.${refundText} Milestones that are already paid stay paid. This cannot be undone.`,
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
        acceptOffer: {
            run: acceptContract,
            success: 'Offer accepted, the contract is active',
            title: 'Accept this contract offer?',
            confirmText: 'Accept offer',
            variant: 'primary',
            message: `The contract becomes active for ${formatMoney(contract.proposal?.bidAmount)} and you can start working. The other proposals for this job will be rejected.`,
        },
        declineOffer: {
            run: declineContract,
            success: 'Offer declined',
            title: 'Decline this contract offer?',
            confirmText: 'Decline offer',
            variant: 'danger',
            message: 'The client will be able to offer the job to another freelancer. You cannot undo this.',
        },
    };
    const current = action ? ACTIONS[action] : null;

    const handleConfirm = async () => {
        const completedNow = action === 'complete';
        try {
            await current.run(contract.id).unwrap();
            toast.success(current.success);
            setAction(null);
            // Müqavilə bitdi: client-i dərhal qarşı tərəfi qiymətləndirməyə dəvət edirik ("Maybe later" ilə keçə bilər)
            if (completedNow) setReviewOpen(true);
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

    // Qarshi terefle daimi sohbeti achir (backend her client/freelancer cütü üçün bir conversation saxlayir)
    const handleMessage = async () => {
        if (!other?.id) return;
        try {
            const res = await openConversation(other.id).unwrap();
            navigate(`/messages/${res.conversation.id}`);
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not open the conversation'));
        }
    };

    // P2: şikayət (report). Hədəf mövcudluğu/icazə backend-də yoxlanılır.
    const closeReport = () => {
        setReportOpen(false);
        setReportTarget('CONTRACT');
        setReportReason('');
        setReportDetails('');
        setReportFiles([]);
    };

    const handleSendReport = async () => {
        if (!reportTargetId) return;
        try {
            const res = await createReport({
                targetType: reportTarget,
                targetId: reportTargetId,
                reason: reportReason.trim(),
                details: reportDetails.trim() || undefined,
            }).unwrap();
            if (reportFiles.length && res?.report?.id) {
                try {
                    await uploadReportFiles({ reportId: res.report.id, files: reportFiles }).unwrap();
                    toast.success('Report and evidence sent. An admin will review it.');
                } catch (uploadErr) {
                    toast.success('Report sent, but evidence upload failed. You can keep the files and contact support if needed.');
                    console.error(uploadErr);
                }
            } else {
                toast.success('Report sent. An admin will review it.');
            }
            closeReport();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not send the report'));
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
                {other?.id && (
                    <Button variant="secondary" onClick={handleMessage} loading={openingChat}>
                        <Icon name="chat" className="text-[18px]" />
                        Message
                    </Button>
                )}

                {/* Ləğv düyməsi hər iki tərəf üçündür; gözləyən təklif varsa, əvəzinə aşağıdakı bannerdə düymələr olur */}
                {(isClient || isFreelancer) && open && !pendingCancel && (
                    <Button variant="ghost" className="text-error hover:bg-error-container" onClick={handleCancelClick}>
                        {contract.workStarted ? 'Request cancellation' : 'Cancel contract'}
                    </Button>
                )}

                {/* Qısayollar: aktiv mərhələyə bağlıdır, tam siyahı Escrow tabındadır */}
                {isFreelancer && open && fundedMilestone && (
                    <Button onClick={() => setMsAction({ type: 'submit', milestone: fundedMilestone })}>
                        <Icon name="outbox" className="text-[18px]" />
                        Submit for review
                    </Button>
                )}

                {isClient && open && reviewMilestone && (
                    <>
                        {hasReachedRevisionLimit(reviewMilestone) ? (
                            <Button
                                variant="secondary"
                                disabled
                                title="Revision limit reached. Approve the work or open a dispute."
                            >
                                <Icon name="undo" className="text-[18px]" />
                                Revision limit reached
                            </Button>
                        ) : (
                            <Button
                                variant="secondary"
                                onClick={() => setMsAction({ type: 'changes', milestone: reviewMilestone })}
                            >
                                <Icon name="undo" className="text-[18px]" />
                                Request changes
                            </Button>
                        )}
                        <Button onClick={() => setMsAction({ type: 'approve', milestone: reviewMilestone })}>
                            <Icon name="task_alt" className="text-[18px]" />
                            Approve &amp; pay
                        </Button>
                    </>
                )}

                {isClient && open && (
                    <Button
                        onClick={() => setAction('complete')}
                        disabled={completeBlocked}
                        title={completeBlocked ? 'Fund and approve every milestone first, or cancel the contract' : undefined}
                    >
                        <Icon name="task_alt" className="text-[18px]" />
                        Complete contract
                    </Button>
                )}

                {/* P2: şikayət — hər iki tərəf üçün */}
                {(isClient || isFreelancer) && (
                    <Button
                        variant="ghost"
                        onClick={() => setReportOpen(true)}
                        title="Report this contract, the other party or the job"
                    >
                        <Icon name="flag" className="text-[18px]" />
                        Report
                    </Button>
                )}
                </div>
            </div>

            {pendingOffer && (
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-info-soft p-4 text-body-md text-info-ink">
                    <div className="min-w-0">
                        <p className="font-semibold">Contract offer pending</p>
                        <p className="mt-1 break-words">
                            {isFreelancer
                                ? `${contract.client?.fullName} offered you this contract for ${formatMoney(contract.proposal?.bidAmount)}. Accept it to start working.`
                                : `Waiting for ${contract.freelancer?.fullName} to accept or decline this offer. Work starts only after they accept.`}
                        </p>
                    </div>
                    {canRespond && (
                        <div className="flex flex-wrap gap-2">
                            <Button variant="secondary" onClick={() => setAction('declineOffer')}>
                                Decline
                            </Button>
                            <Button onClick={() => setAction('acceptOffer')}>Accept offer</Button>
                        </div>
                    )}
                </div>
            )}

            {openDisputes.length > 0 && (
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-error-container p-4 text-body-md text-on-surface">
                    <div className="min-w-0">
                        <p className="flex items-center gap-2 font-semibold">
                            <Icon name="gavel" className="text-[18px]" />
                            {openDisputes.length === 1
                                ? 'A dispute is open on this contract'
                                : `${openDisputes.length} disputes are open on this contract`}
                        </p>
                        <p className="mt-1 break-words">
                            The escrowed money is frozen. Submit, approve, request-changes and automatic approval are
                            paused until an admin resolves the dispute.
                        </p>
                        {openDisputes[0]?.reason && (
                            <p className="mt-1 break-words text-secondary">Reason: {openDisputes[0].reason}</p>
                        )}
                    </div>
                    {tab !== 'escrow' && (
                        <Button size="sm" variant="secondary" onClick={() => selectTab('escrow')}>
                            View in Escrow
                        </Button>
                    )}
                </div>
            )}

            {boardLocked && (
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-warning-soft p-4 text-body-md text-warning-ink">
                    <p className="flex min-w-0 items-center gap-2">
                        <Icon name="lock" className="text-[18px]" />
                        {isClient
                            ? 'Escrow pending: fund a milestone to unlock the board. Until then cards stay in To do.'
                            : 'Escrow pending: work starts once the client funds a milestone. You can plan cards in To do meanwhile.'}
                    </p>
                    {isClient && tab !== 'escrow' && (
                        <Button size="sm" variant="secondary" onClick={() => selectTab('escrow')}>
                            Open Escrow
                        </Button>
                    )}
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

            {isClient && open && completeBlocked && (
                <p className="mb-6 flex items-center gap-2 rounded-lg bg-warning-soft px-3 py-2 text-label-md text-warning-ink">
                    <Icon name="lock" className="text-[18px]" />
                    The contract can be completed once every milestone is paid ({paidCount} of {milestoneTotal} paid so far).
                </p>
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

            {contract.status === 'COMPLETED' && (isClient || isFreelancer) && (
                <ContractReviews
                    contractId={contract.id}
                    currentUserId={user?.id}
                    otherName={other?.fullName}
                    onWriteReview={() => setReviewOpen(true)}
                />
            )}

            <div className="mb-6 inline-flex max-w-full gap-1 overflow-x-auto rounded-xl bg-surface-container-low p-1" role="tablist">
                {[
                    { key: 'board', label: 'Board', icon: 'view_kanban' },
                    { key: 'escrow', label: 'Escrow', icon: 'account_balance' },
                ].map((t) => (
                    <button
                        key={t.key}
                        type="button"
                        role="tab"
                        aria-selected={tab === t.key}
                        onClick={() => selectTab(t.key)}
                        className={cn(
                            'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-1.5 text-label-md transition-all',
                            tab === t.key
                                ? 'bg-surface-container-lowest font-semibold text-primary shadow-sm'
                                : 'text-on-surface-variant hover:text-on-surface',
                        )}
                    >
                        <Icon name={t.icon} className="text-[18px]" />
                        {t.label}
                        {t.key === 'escrow' && escrowAttention > 0 && (
                            <span className="rounded-full bg-primary-container px-1.5 text-caption font-semibold text-on-primary">
                                {escrowAttention}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Board gizlənəndə də mount qalır: soket bağlantısı (issue, milestone hadisələri) kəsilmir */}
            <div className={tab === 'board' ? undefined : 'hidden'}>
                <KanbanBoard contract={contract} readOnly={!active} />
            </div>

            {tab === 'escrow' && <EscrowPanel contract={contract} isClient={isClient} isFreelancer={isFreelancer} />}

            <ConfirmDialog
                open={!!action}
                onClose={() => setAction(null)}
                onConfirm={handleConfirm}
                loading={
                    completing ||
                    cancelling ||
                    accepting ||
                    declining ||
                    withdrawing ||
                    acceptingOffer ||
                    decliningOffer
                }
                variant={current?.variant}
                title={current?.title}
                message={current?.message}
                confirmText={current?.confirmText}
            />

            <ConfirmDialog
                open={!!msAction}
                onClose={() => setMsAction(null)}
                onConfirm={handleMsConfirm}
                loading={submittingMs || approvingMs || requestingMs}
                variant={msDialog?.variant}
                title={msDialog?.title}
                message={msDialog?.message}
                confirmText={msDialog?.confirmText}
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

            {/* P3: rəy pəncərəsi (yalnız tərəflər; backend COMPLETED və təkrar rəyi yoxlayır) */}
            {(isClient || isFreelancer) && (
                <ReviewModal
                    open={reviewOpen}
                    onClose={() => setReviewOpen(false)}
                    contractId={contract.id}
                    revieweeName={other?.fullName}
                    jobTitle={contract.jobPost?.title}
                />
            )}

            {/* P2: şikayət pəncərəsi */}
            <Modal
                open={reportOpen}
                onClose={closeReport}
                title="Send a report"
                footer={
                    <>
                        <Button variant="secondary" onClick={closeReport} disabled={reporting}>
                            Cancel
                        </Button>
                        <Button
                            variant="danger"
                            onClick={handleSendReport}
                            loading={reporting || uploadingReportFiles}
                            disabled={reportReason.trim().length < 5 || !reportTargetId}
                        >
                            Send report
                        </Button>
                    </>
                }
            >
                <p className="mb-3 text-body-md text-secondary">
                    Reports are sent to platform admins. Use this for abuse, fraud or other serious problems.
                </p>
                <Select
                    label="What are you reporting?"
                    value={reportTarget}
                    onChange={(e) => setReportTarget(e.target.value)}
                    options={reportTargets.map((t) => ({ value: t.key, label: t.label }))}
                />
                <Textarea
                    className="mt-3"
                    label="Reason"
                    rows={2}
                    maxLength={500}
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    hint="At least 5 characters."
                />
                <Textarea
                    className="mt-3"
                    label="Details (optional)"
                    rows={4}
                    maxLength={2000}
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                />
                <div className="mt-3">
                    <p className="mb-1.5 block text-label-md text-on-surface">Evidence files (optional)</p>
                    <FilePicker
                        purpose="REPORT_EVIDENCE"
                        target={{}}
                        files={reportFiles}
                        onFilesChange={setReportFiles}
                        showUploadButton={false}
                        label="Choose evidence files"
                    />
                    <p className="mt-1 text-caption text-secondary">Files are uploaded after the report is created.</p>
                </div>
            </Modal>
        </>
    );
};

export default ContractDetailPage;
