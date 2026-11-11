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
import { calcCommissionCents, hasReachedRevisionLimit, summarizeMilestones } from '../features/escrow/escrowUtils';
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
import { useTranslation } from '../features/locale/useTranslation';
import { cn } from '../lib/cn';
import { formatCents, formatDate, formatMoney, getErrorMessage } from '../lib/format';

const ContractDetailPage = () => {
    const { t } = useTranslation();
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
                    title={t('contracts.detail.unavailableTitle')}
                    description={t('contracts.detail.unavailableText')}
                    action={
                        <Link to="/contracts">
                            <Button>{t('contracts.detail.backToContracts')}</Button>
                        </Link>
                    }
                />
            );
        }
        return <ErrorState title={t('contracts.detail.loadError')} onRetry={refetch} />;
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
        unfinished > 0 ? t('contracts.confirm.complete.unfinished', { count: unfinished }) : '';

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
        { key: 'CONTRACT', label: t('contracts.report.targetContract'), id: contract.id },
        ...(other?.id
            ? [{ key: 'USER', label: t('contracts.report.targetUser', { name: other.fullName }), id: other.id }]
            : []),
        ...(contract.jobPostId
            ? [{ key: 'JOB', label: t('contracts.report.targetJob'), id: contract.jobPostId }]
            : []),
    ];
    const reportTargetId = reportTargets.find((item) => item.key === reportTarget)?.id;
    const refundText =
        lockedCents > 0
            ? ` ${t('contracts.confirm.refund', { amount: formatCents(lockedCents) })}`
            : '';
    // Backend: bütün mərhələlər PAID olmayana qədər müqaviləni bitirmək olmur
    const completeBlocked = !allPaid;
    // Aktiv mərhələlər: frilanser FUNDED-i təhvil verir, client IN_REVIEW-u təsdiqləyir və ya geri qaytarır
    const fundedMilestone = milestones.find((m) => m.status === 'FUNDED');
    const reviewMilestone = milestones.find((m) => m.status === 'IN_REVIEW');
    const MS_ACTIONS = {
        submit: { run: submitMilestone, success: t('contracts.toasts.submitted') },
        approve: { run: approveMilestone, success: t('contracts.toasts.approved') },
        changes: { run: requestChanges, success: t('contracts.toasts.changes') },
    };
    const msDialog = msAction
        ? {
              submit: {
                  title: t('escrow.dialog.submit.title'),
                  confirmText: t('escrow.dialog.submit.confirm'),
                  variant: 'primary',
                  message: t('escrow.dialog.submit.message', { days: 7 }),
              },
              approve: {
                  title: t('escrow.dialog.approve.title'),
                  confirmText: t('escrow.dialog.approve.confirm'),
                  variant: 'primary',
                  message: t('escrow.dialog.approve.message', {
                      amount: formatCents(msAction.milestone.amountCents),
                      fee: formatCents(calcCommissionCents(msAction.milestone.amountCents)),
                      note: t('common.demo.moneyNote'),
                  }),
              },
              changes: {
                  title: t('escrow.dialog.changes.title'),
                  confirmText: t('escrow.dialog.changes.confirm'),
                  variant: 'secondary',
                  message: t('escrow.dialog.changes.message', {
                      used: msAction.milestone.revisionCount,
                      max: msAction.milestone.maxRevisions,
                  }),
              },
          }[msAction.type]
        : null;

    const handleMsConfirm = async () => {
        const { type, milestone } = msAction;
        try {
            await MS_ACTIONS[type].run({ id: milestone.id, contractId: contract.id }).unwrap();
            toast.success(MS_ACTIONS[type].success);
        } catch (err) {
            toast.error(getErrorMessage(err, t('contracts.toasts.actionFailed')));
        } finally {
            setMsAction(null);
        }
    };

    // Hər əməliyyat üçün: backend çağırışı, uğur mesajı və təsdiq pəncərəsinin mətni
    const ACTIONS = {
        complete: {
            run: completeContract,
            success: t('contracts.toasts.completed'),
            title: t('contracts.confirm.complete.title'),
            confirmText: t('contracts.confirm.complete.confirm'),
            variant: 'primary',
            message: t('contracts.confirm.complete.message', { prefix: unfinishedText }),
        },
        cancel: {
            run: cancelContract,
            success: t('contracts.toasts.cancelled'),
            title: t('contracts.confirm.cancel.title'),
            confirmText: t('contracts.confirm.cancel.confirm'),
            variant: 'danger',
            message: t('contracts.confirm.cancel.message', { refund: refundText }),
        },
        acceptCancel: {
            run: acceptCancellation,
            success: t('contracts.toasts.cancelled'),
            title: t('contracts.confirm.acceptCancel.title'),
            confirmText: t('contracts.confirm.acceptCancel.confirm'),
            variant: 'danger',
            message: t('contracts.confirm.acceptCancel.message', { refund: refundText }),
        },
        declineCancel: {
            run: declineCancellation,
            success: t('contracts.toasts.cancelDeclined'),
            title: t('contracts.confirm.declineCancel.title'),
            confirmText: t('contracts.confirm.declineCancel.confirm'),
            variant: 'primary',
            message: t('contracts.confirm.declineCancel.message'),
        },
        withdrawCancel: {
            run: withdrawCancellation,
            success: t('contracts.toasts.cancelWithdrawn'),
            title: t('contracts.confirm.withdrawCancel.title'),
            confirmText: t('contracts.confirm.withdrawCancel.confirm'),
            variant: 'primary',
            message: t('contracts.confirm.withdrawCancel.message'),
        },
        acceptOffer: {
            run: acceptContract,
            success: t('contracts.toasts.offerAccepted'),
            title: t('contracts.confirm.acceptOffer.title'),
            confirmText: t('contracts.confirm.acceptOffer.confirm'),
            variant: 'primary',
            message: t('contracts.confirm.acceptOffer.message', {
                amount: formatMoney(contract.proposal?.bidAmount),
            }),
        },
        declineOffer: {
            run: declineContract,
            success: t('contracts.toasts.offerDeclined'),
            title: t('contracts.confirm.declineOffer.title'),
            confirmText: t('contracts.confirm.declineOffer.confirm'),
            variant: 'danger',
            message: t('contracts.confirm.declineOffer.message'),
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
            toast.error(getErrorMessage(err, t('contracts.toasts.actionFailed')));
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
            toast.success(t('contracts.toasts.cancelRequestSent'));
            closeRequest();
        } catch (err) {
            toast.error(getErrorMessage(err, t('contracts.toasts.cancelRequestError')));
        }
    };

    // Qarshi terefle daimi sohbeti achir (backend her client/freelancer cütü üçün bir conversation saxlayir)
    const handleMessage = async () => {
        if (!other?.id) return;
        try {
            const res = await openConversation(other.id).unwrap();
            navigate(`/messages/${res.conversation.id}`);
        } catch (err) {
            toast.error(getErrorMessage(err, t('contracts.toasts.conversationError')));
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
                    toast.success(t('contracts.toasts.reportSentWithFiles'));
                } catch (uploadErr) {
                    toast.success(t('contracts.toasts.reportUploadFailed'));
                    console.error(uploadErr);
                }
            } else {
                toast.success(t('contracts.toasts.reportSent'));
            }
            closeReport();
        } catch (err) {
            toast.error(getErrorMessage(err, t('contracts.toasts.reportError')));
        }
    };

    return (
        <>
            <Link
                to="/contracts"
                className="mb-4 inline-flex items-center gap-1 text-label-md text-secondary hover:text-primary-container"
            >
                <Icon name="arrow_back" className="text-[18px]" />
                {t('contracts.detail.back')}
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
                        {t('contracts.actions.message')}
                    </Button>
                )}

                {/* Ləğv düyməsi hər iki tərəf üçündür; gözləyən təklif varsa, əvəzinə aşağıdakı bannerdə düymələr olur */}
                {(isClient || isFreelancer) && open && !pendingCancel && (
                    <Button variant="ghost" className="text-error hover:bg-error-container" onClick={handleCancelClick}>
                        {contract.workStarted
                            ? t('contracts.actions.requestCancellation')
                            : t('contracts.actions.cancelContract')}
                    </Button>
                )}

                {/* Qısayollar: aktiv mərhələyə bağlıdır, tam siyahı Escrow tabındadır */}
                {isFreelancer && open && fundedMilestone && (
                    <Button onClick={() => setMsAction({ type: 'submit', milestone: fundedMilestone })}>
                        <Icon name="outbox" className="text-[18px]" />
                        {t('contracts.actions.submitForReview')}
                    </Button>
                )}

                {isClient && open && reviewMilestone && (
                    <>
                        {hasReachedRevisionLimit(reviewMilestone) ? (
                            <Button
                                variant="secondary"
                                disabled
                                title={t('contracts.actions.revisionLimitTitle')}
                            >
                                <Icon name="undo" className="text-[18px]" />
                                {t('contracts.actions.revisionLimit')}
                            </Button>
                        ) : (
                            <Button
                                variant="secondary"
                                onClick={() => setMsAction({ type: 'changes', milestone: reviewMilestone })}
                            >
                                <Icon name="undo" className="text-[18px]" />
                                {t('contracts.actions.requestChanges')}
                            </Button>
                        )}
                        <Button onClick={() => setMsAction({ type: 'approve', milestone: reviewMilestone })}>
                            <Icon name="task_alt" className="text-[18px]" />
                            {t('contracts.actions.approvePay')}
                        </Button>
                    </>
                )}

                {isClient && open && (
                    <Button
                        onClick={() => setAction('complete')}
                        disabled={completeBlocked}
                        title={completeBlocked ? t('contracts.actions.completeBlockedTitle') : undefined}
                    >
                        <Icon name="task_alt" className="text-[18px]" />
                        {t('contracts.actions.completeContract')}
                    </Button>
                )}

                {/* P2: şikayət — hər iki tərəf üçün */}
                {(isClient || isFreelancer) && (
                    <Button
                        variant="ghost"
                        onClick={() => setReportOpen(true)}
                        title={t('contracts.actions.reportTitle')}
                    >
                        <Icon name="flag" className="text-[18px]" />
                        {t('contracts.actions.report')}
                    </Button>
                )}
                </div>
            </div>

            {pendingOffer && (
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-info-soft p-4 text-body-md text-info-ink">
                    <div className="min-w-0">
                        <p className="font-semibold">{t('contracts.offer.title')}</p>
                        <p className="mt-1 break-words">
                            {isFreelancer
                                ? t('contracts.offer.freelancerText', {
                                      name: contract.client?.fullName,
                                      amount: formatMoney(contract.proposal?.bidAmount),
                                  })
                                : t('contracts.offer.clientText', { name: contract.freelancer?.fullName })}
                        </p>
                    </div>
                    {canRespond && (
                        <div className="flex flex-wrap gap-2">
                            <Button variant="secondary" onClick={() => setAction('declineOffer')}>
                                {t('contracts.offer.decline')}
                            </Button>
                            <Button onClick={() => setAction('acceptOffer')}>{t('contracts.offer.accept')}</Button>
                        </div>
                    )}
                </div>
            )}

            {openDisputes.length > 0 && (
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-error-container p-4 text-body-md text-on-surface">
                    <div className="min-w-0">
                        <p className="flex items-center gap-2 font-semibold">
                            <Icon name="report_problem" className="text-[18px]" />
                            {t('contracts.disputes.open', { count: openDisputes.length })}
                        </p>
                        <p className="mt-1 break-words">{t('contracts.disputes.frozen')}</p>
                        {openDisputes[0]?.reason && (
                            <p className="mt-1 break-words text-secondary">
                                {t('contracts.disputes.reason', { reason: openDisputes[0].reason })}
                            </p>
                        )}
                    </div>
                    {tab !== 'escrow' && (
                        <Button size="sm" variant="secondary" onClick={() => selectTab('escrow')}>
                            {t('contracts.disputes.viewInEscrow')}
                        </Button>
                    )}
                </div>
            )}

            {boardLocked && (
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-warning-soft p-4 text-body-md text-warning-ink">
                    <p className="flex min-w-0 items-center gap-2">
                        <Icon name="lock" className="text-[18px]" />
                        {isClient ? t('contracts.boardLocked.client') : t('contracts.boardLocked.freelancer')}
                    </p>
                    {isClient && tab !== 'escrow' && (
                        <Button size="sm" variant="secondary" onClick={() => selectTab('escrow')}>
                            {t('contracts.boardLocked.openEscrow')}
                        </Button>
                    )}
                </div>
            )}

            {pendingCancel && (
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-error-container p-4 text-body-md text-on-surface">
                    <div className="min-w-0">
                        {iRequestedCancel ? (
                            <p>{t('contracts.cancel.pendingMine', { name: other?.fullName })}</p>
                        ) : (
                            <p>{t('contracts.cancel.pendingOther', { name: other?.fullName })}</p>
                        )}
                        {contract.cancelReason && (
                            <p className="mt-1 break-words text-secondary">
                                {t('contracts.cancel.reason', { reason: contract.cancelReason })}
                            </p>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {iRequestedCancel ? (
                            <Button variant="secondary" onClick={() => setAction('withdrawCancel')}>
                                {t('contracts.cancel.withdraw')}
                            </Button>
                        ) : (
                            <>
                                <Button variant="secondary" onClick={() => setAction('declineCancel')}>
                                    {t('contracts.cancel.decline')}
                                </Button>
                                <Button variant="danger" onClick={() => setAction('acceptCancel')}>
                                    {t('contracts.cancel.agree')}
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {isClient && open && completeBlocked && (
                <p className="mb-6 flex items-center gap-2 rounded-lg bg-warning-soft px-3 py-2 text-label-md text-warning-ink">
                    <Icon name="lock" className="text-[18px]" />
                    {t('contracts.completeBlocked', { paid: paidCount, total: milestoneTotal })}
                </p>
            )}

            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                <Card className="p-5">
                    <p className="text-caption uppercase tracking-wider text-secondary">
                        {t('contracts.summary.contractValue')}
                    </p>
                    <p className="tabular mt-1 text-headline-md text-on-surface">
                        {formatMoney(contract.proposal?.bidAmount)}
                    </p>
                    <p className="mt-1 text-caption text-secondary">
                        {t('contracts.summary.jobBudget', { amount: formatMoney(contract.jobPost?.budget) })}
                    </p>
                </Card>
                <Card className="flex items-center gap-3 p-5">
                    <Avatar name={other?.fullName} size="lg" />
                    <div className="min-w-0">
                        <p className="text-caption uppercase tracking-wider text-secondary">
                            {isClient ? t('contracts.card.freelancer') : t('contracts.card.client')}
                        </p>
                        <p className="truncate text-title-md text-on-surface">{other?.fullName}</p>
                        {other?.id && (
                            <Link to={`/users/${other.id}`} className="text-label-sm text-primary hover:underline">
                                {t('contracts.summary.viewProfile')}
                            </Link>
                        )}
                    </div>
                </Card>
                <Card className="p-5">
                    <p className="text-caption uppercase tracking-wider text-secondary">
                        {t('contracts.summary.started')}
                    </p>
                    <p className="mt-1 text-title-md text-on-surface">{formatDate(contract.createdAt)}</p>
                    <Link to={`/jobs/${contract.jobPostId}`} className="mt-1 inline-block text-label-sm text-primary hover:underline">
                        {t('contracts.summary.viewOriginalJob')}
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
                    { key: 'board', label: t('contracts.tabs.board'), icon: 'view_kanban' },
                    { key: 'escrow', label: t('contracts.tabs.escrow'), icon: 'account_balance' },
                ].map((item) => (
                    <button
                        key={item.key}
                        type="button"
                        role="tab"
                        aria-selected={tab === item.key}
                        onClick={() => selectTab(item.key)}
                        className={cn(
                            'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-1.5 text-label-md transition-all',
                            tab === item.key
                                ? 'bg-surface-container-lowest font-semibold text-primary shadow-sm'
                                : 'text-on-surface-variant hover:text-on-surface',
                        )}
                    >
                        <Icon name={item.icon} className="text-[18px]" />
                        {item.label}
                        {item.key === 'escrow' && escrowAttention > 0 && (
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
                title={t('contracts.request.title')}
                footer={
                    <>
                        <Button variant="secondary" onClick={closeRequest} disabled={requesting}>
                            {t('contracts.request.keep')}
                        </Button>
                        <Button variant="danger" onClick={handleSendRequest} loading={requesting}>
                            {t('contracts.request.send')}
                        </Button>
                    </>
                }
            >
                <p className="mb-3 text-body-md text-secondary">
                    {t('contracts.request.body', { name: other?.fullName })}
                </p>
                <Textarea
                    label={t('contracts.request.reasonLabel')}
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
                title={t('contracts.report.title')}
                footer={
                    <>
                        <Button variant="secondary" onClick={closeReport} disabled={reporting}>
                            {t('common.actions.cancel')}
                        </Button>
                        <Button
                            variant="danger"
                            onClick={handleSendReport}
                            loading={reporting || uploadingReportFiles}
                            disabled={reportReason.trim().length < 5 || !reportTargetId}
                        >
                            {t('contracts.report.send')}
                        </Button>
                    </>
                }
            >
                <p className="mb-3 text-body-md text-secondary">{t('contracts.report.intro')}</p>
                <Select
                    label={t('contracts.report.what')}
                    value={reportTarget}
                    onChange={(e) => setReportTarget(e.target.value)}
                    options={reportTargets.map((item) => ({ value: item.key, label: item.label }))}
                />
                <Textarea
                    className="mt-3"
                    label={t('contracts.report.reason')}
                    rows={2}
                    maxLength={500}
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    hint={t('contracts.report.reasonHint')}
                />
                <Textarea
                    className="mt-3"
                    label={t('contracts.report.details')}
                    rows={4}
                    maxLength={2000}
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                />
                <div className="mt-3">
                    <p className="mb-1.5 block text-label-md text-on-surface">{t('contracts.report.evidence')}</p>
                    <FilePicker
                        purpose="REPORT_EVIDENCE"
                        target={{}}
                        files={reportFiles}
                        onFilesChange={setReportFiles}
                        showUploadButton={false}
                        label={t('contracts.report.chooseFiles')}
                    />
                    <p className="mt-1 text-caption text-secondary">{t('contracts.report.filesNote')}</p>
                </div>
            </Modal>
        </>
    );
};

export default ContractDetailPage;
