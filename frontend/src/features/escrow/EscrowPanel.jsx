import { useState } from 'react';
import toast from 'react-hot-toast';
import { Button, Card, ConfirmDialog, EmptyState, Icon, Modal, Textarea } from '../../components/ui';
import { formatCents, formatDate, getErrorMessage } from '../../lib/format';
import { useTranslation } from '../locale/useTranslation';
import TopUpModal from '../wallet/TopUpModal';
import { useGetWalletQuery } from '../wallet/walletApi';
import {
    useApproveMilestoneMutation,
    useFundMilestoneMutation,
    useGetContractHistoryQuery,
    useOpenMilestoneDisputeMutation,
    useRequestMilestoneChangesMutation,
    useSubmitMilestoneMutation,
} from './escrowApi';
import { MilestoneBadge } from './escrow';
import { calcCommissionCents, hasReachedRevisionLimit, summarizeMilestones } from './escrowUtils';
import { AttachmentList, FilePicker } from '../attachments/AttachmentComponents';

const AUTO_APPROVE_DAYS = 7; // backend: AUTO_APPROVE_DAYS
const DAY_MS = 24 * 60 * 60 * 1000;

const RESOLUTION_KEYS = {
    RELEASE: 'escrow.dispute.resolutions.RELEASE',
    REFUND: 'escrow.dispute.resolutions.REFUND',
    SPLIT: 'escrow.dispute.resolutions.SPLIT',
};

const SummaryCard = ({ label, value, hint }) => (
    <Card className="p-4">
        <p className="text-caption uppercase tracking-wider text-secondary">{label}</p>
        <p className="tabular mt-1 text-headline-sm text-on-surface">{value}</p>
        {hint && <p className="mt-0.5 text-caption text-secondary">{hint}</p>}
    </Card>
);

// type: 'fund' | 'submit' | 'approve' | 'changes'. Hər biri üçün təsdiq pəncərəsinin mətni
const buildDialog = (type, m, t) => {
    const amount = formatCents(m.amountCents);
    const fee = formatCents(calcCommissionCents(m.amountCents));

    return {
        fund: {
            title: t('escrow.dialog.fund.title'),
            confirmText: t('escrow.dialog.fund.confirm'),
            variant: 'primary',
            message: t('escrow.dialog.fund.message', { amount, note: t('common.demo.moneyNote') }),
        },
        submit: {
            title: t('escrow.dialog.submit.title'),
            confirmText: t('escrow.dialog.submit.confirm'),
            variant: 'primary',
            message: t('escrow.dialog.submit.message', { days: AUTO_APPROVE_DAYS }),
        },
        approve: {
            title: t('escrow.dialog.approve.title'),
            confirmText: t('escrow.dialog.approve.confirm'),
            variant: 'primary',
            message: t('escrow.dialog.approve.message', { amount, fee, note: t('common.demo.moneyNote') }),
        },
        changes: {
            title: t('escrow.dialog.changes.title'),
            confirmText: t('escrow.dialog.changes.confirm'),
            variant: 'secondary',
            message: t('escrow.dialog.changes.message', {
                used: m.revisionCount,
                max: m.maxRevisions,
            }),
        },
    }[type];
};

const SubmissionHistory = ({ submissions }) => {
    const { t } = useTranslation();
    if (!submissions?.length) return null;

    return (
        <details className="rounded-lg border border-line bg-surface-container-lowest px-3 py-2">
            <summary className="cursor-pointer text-label-md text-secondary">
                {t('escrow.submission.title', { count: submissions.length })}
            </summary>
            <ul className="mt-2 flex flex-col gap-2">
                {submissions.map((s) => (
                    <li key={s.id} className="text-caption text-secondary">
                        <span className="font-semibold text-on-surface">
                            {s.type === 'SUBMITTED'
                                ? t('escrow.submission.submitted')
                                : t('escrow.submission.changes')}
                        </span>{' '}
                        · {t('escrow.submission.revision', { number: s.revisionNumber })} ·{' '}
                        {s.actor?.fullName || t('escrow.submission.unknown')} · {formatDate(s.createdAt)}
                        {s.note && <p className="mt-0.5 break-words text-on-surface-variant">{s.note}</p>}
                        <AttachmentList attachments={s.attachments} compact />
                    </li>
                ))}
            </ul>
        </details>
    );
};

const DisputeBox = ({ dispute, contractId, canUpload }) => {
    const { t } = useTranslation();
    const isOpen = dispute.status === 'OPEN';
    const resolutionKey = RESOLUTION_KEYS[dispute.resolution];
    const resolutionLabel = resolutionKey ? t(resolutionKey) : dispute.resolution;

    return (
        <div className={`rounded-lg px-3 py-2 text-label-md ${isOpen ? 'bg-danger-soft text-danger-ink' : 'bg-surface-container text-on-surface-variant'}`}>
            <p className="flex items-center gap-1.5 font-semibold">
                <Icon name={isOpen ? 'report_problem' : 'task_alt'} className="text-[16px]" />
                {isOpen
                    ? t('escrow.dispute.open')
                    : t('escrow.dispute.resolved', { resolution: resolutionLabel })}
            </p>
            <p className="mt-0.5 break-words">{t('escrow.dispute.reason', { reason: dispute.reason })}</p>
            {dispute.details && (
                <p className="mt-0.5 break-words">{t('escrow.dispute.details', { details: dispute.details })}</p>
            )}
            {dispute.openedBy && (
                <p className="mt-0.5">
                    {t('escrow.dispute.openedBy', {
                        name: dispute.openedBy.fullName,
                        date: formatDate(dispute.openedAt),
                    })}
                </p>
            )}
            {!isOpen && (
                <p className="mt-0.5">
                    {t('escrow.dispute.released', {
                        amount: formatCents(dispute.releaseToFreelancerCents),
                    })}{' '}
                    ·{' '}
                    {t('escrow.dispute.refunded', { amount: formatCents(dispute.refundToClientCents) })}
                    {dispute.adminNote ? ` · ${dispute.adminNote}` : ''}
                </p>
            )}
            <AttachmentList attachments={dispute.attachments} compact />
            {isOpen && canUpload && (
                <div className="mt-2">
                    <FilePicker
                        purpose="DISPUTE_EVIDENCE"
                        target={{ disputeId: dispute.id }}
                        contractId={contractId}
                        label={t('escrow.dispute.upload')}
                    />
                </div>
            )}
        </div>
    );
};

const EscrowPanel = ({ contract, isClient, isFreelancer }) => {
    const { t } = useTranslation();
    const milestones = contract.milestones ?? [];
    const open = contract.status === 'ACTIVE' || contract.status === 'DELIVERED';
    const summary = summarizeMilestones(milestones, isFreelancer);

    // Yalnız client-in pul kisəsi lazımdır (maliyyələşdirmə üçün)
    const walletQ = useGetWalletQuery(undefined, { skip: !isClient });
    const available = walletQ.data?.wallet?.availableCents;

    const historyQ = useGetContractHistoryQuery(contract.id);
    const submissions = historyQ.data?.submissions ?? [];
    const disputes = historyQ.data?.disputes ?? [];
    const milestoneFiles = historyQ.data?.milestoneFiles ?? [];

    const submissionsByMilestone = submissions.reduce((acc, s) => {
        (acc[s.milestoneId] ||= []).push(s);
        return acc;
    }, {});
    const disputesByMilestone = disputes.reduce((acc, d) => {
        (acc[d.milestoneId] ||= []).push(d);
        return acc;
    }, {});
    const filesByMilestone = milestoneFiles.reduce((acc, f) => {
        if (f.milestoneId) (acc[f.milestoneId] ||= []).push(f);
        return acc;
    }, {});

    const [pending, setPending] = useState(null); // { type, milestone }
    const [topUpOpen, setTopUpOpen] = useState(false);
    const [disputeFor, setDisputeFor] = useState(null); // milestone
    const [disputeReason, setDisputeReason] = useState('');
    const [disputeDetails, setDisputeDetails] = useState('');

    const [fundMilestone, { isLoading: funding }] = useFundMilestoneMutation();
    const [submitMilestone, { isLoading: submitting }] = useSubmitMilestoneMutation();
    const [approveMilestone, { isLoading: approving }] = useApproveMilestoneMutation();
    const [requestChanges, { isLoading: requesting }] = useRequestMilestoneChangesMutation();
    const [openDispute, { isLoading: openingDispute }] = useOpenMilestoneDisputeMutation();

    const RUN = {
        fund: { run: fundMilestone, success: t('escrow.toasts.funded') },
        submit: { run: submitMilestone, success: t('escrow.toasts.submitted') },
        approve: { run: approveMilestone, success: t('escrow.toasts.approved') },
        changes: { run: requestChanges, success: t('escrow.toasts.changes') },
    };

    // Backend qaydası: əvvəlki bütün mərhələlər PAID olmalıdır
    const canFund = (m) =>
        milestones.filter((x) => x.sequence < m.sequence).every((x) => x.status === 'PAID');

    const startFund = (m) => {
        // Balans məlumdursa və çatmırsa, əvvəl pul əlavə etməyə yönləndiririk
        if (available !== undefined && available < m.amountCents) {
            toast(t('escrow.toasts.lowBalance'), { icon: '💳' });
            setTopUpOpen(true);
            return;
        }
        setPending({ type: 'fund', milestone: m });
    };

    const handleConfirm = async () => {
        const { type, milestone } = pending;
        try {
            await RUN[type].run({ id: milestone.id, contractId: contract.id }).unwrap();
            toast.success(RUN[type].success);
            setPending(null);
        } catch (err) {
            toast.error(getErrorMessage(err, t('escrow.toasts.actionFailed')));
            setPending(null);
        }
    };

    const closeDisputeModal = () => {
        setDisputeFor(null);
        setDisputeReason('');
        setDisputeDetails('');
    };

    const handleOpenDispute = async () => {
        try {
            await openDispute({
                id: disputeFor.id,
                contractId: contract.id,
                reason: disputeReason.trim(),
                details: disputeDetails.trim() || undefined,
            }).unwrap();
            toast.success(t('escrow.toasts.disputeOpened'));
            closeDisputeModal();
        } catch (err) {
            toast.error(getErrorMessage(err, t('escrow.toasts.disputeError')));
        }
    };

    const dialog = pending ? buildDialog(pending.type, pending.milestone, t) : null;

    return (
        <>
            <p className="mb-4 flex items-center gap-2 rounded-lg bg-warning-soft px-3 py-2 text-label-md text-warning-ink">
                <Icon name="science" className="text-[18px]" />
                {t('escrow.demoNotice')}
            </p>

            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <SummaryCard
                    label={t('escrow.summary.locked')}
                    value={formatCents(summary.lockedCents)}
                    hint={t('escrow.summary.lockedHint')}
                />
                <SummaryCard
                    label={isFreelancer ? t('escrow.summary.earned') : t('escrow.summary.released')}
                    value={formatCents(summary.releasedCents)}
                    hint={isFreelancer ? t('escrow.summary.earnedHint') : t('escrow.summary.releasedHint')}
                />
                <SummaryCard
                    label={t('escrow.summary.unfunded')}
                    value={formatCents(summary.unfundedCents)}
                    hint={t('escrow.summary.unfundedHint')}
                />
            </div>

            {isClient && (
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-container-lowest px-4 py-3">
                    <p className="text-body-md text-on-surface">
                        {t('escrow.walletBalance')}{' '}
                        <span className="tabular font-semibold">{available === undefined ? '…' : formatCents(available)}</span>
                    </p>
                    <Button variant="secondary" size="sm" onClick={() => setTopUpOpen(true)}>
                        <Icon name="add_card" className="text-[16px]" />
                        {t('escrow.addFunds')}
                    </Button>
                </div>
            )}

            <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-headline-sm text-on-surface">
                    <Icon name="account_balance" className="text-[22px] text-primary-container" />
                    {t('escrow.milestonesTitle')}
                    <span className="text-label-md font-normal text-secondary">
                        {t('escrow.paidCount', { paid: summary.paid, total: summary.total })}
                    </span>
                </h2>
            </div>

            {milestones.length === 0 ? (
                <EmptyState
                    icon="flag"
                    title={t('escrow.empty.title')}
                    description={t('escrow.empty.text')}
                />
            ) : (
                <div className="flex flex-col gap-3">
                    {milestones.map((m) => {
                        const fee = calcCommissionCents(m.resolvedReleaseCents ?? m.amountCents);
                        const autoDate =
                            m.status === 'IN_REVIEW' && m.submittedAt
                                ? new Date(new Date(m.submittedAt).getTime() + AUTO_APPROVE_DAYS * DAY_MS)
                                : null;
                        const milestoneSubmissions = submissionsByMilestone[m.id] ?? [];
                        const milestoneDisputes = disputesByMilestone[m.id] ?? [];
                        const activeDispute = milestoneDisputes.find((d) => d.status === 'OPEN');
                        const latestResolved = [...milestoneDisputes].reverse().find((d) => d.status === 'RESOLVED');
                        const limitReached = hasReachedRevisionLimit(m);

                        return (
                            <Card key={m.id} className="flex flex-col gap-3 p-4 sm:p-5">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-caption uppercase tracking-wider text-secondary">
                                            {t('escrow.milestone.number', { number: m.sequence })}
                                        </p>
                                        <h3 className="break-words text-title-md text-on-surface">{m.title}</h3>
                                        <p className="mt-0.5 text-caption text-secondary">
                                            {t('escrow.milestone.revisions', {
                                                used: m.revisionCount,
                                                max: m.maxRevisions,
                                            })}
                                            {limitReached && t('escrow.milestone.limitReached')}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="tabular text-title-md font-semibold text-on-surface">
                                            {formatCents(m.amountCents)}
                                        </span>
                                        <MilestoneBadge status={m.status} />
                                    </div>
                                </div>

                                <p className="text-caption text-secondary">
                                    {m.dueDate && t('escrow.milestone.due', { date: formatDate(m.dueDate) })}
                                    {m.fundedAt &&
                                        `${m.dueDate ? ' · ' : ''}${t('escrow.milestone.funded', { date: formatDate(m.fundedAt) })}`}
                                    {m.submittedAt &&
                                        m.status === 'IN_REVIEW' &&
                                        ` · ${t('escrow.milestone.submitted', { date: formatDate(m.submittedAt) })}`}
                                    {m.disputedAt &&
                                        ` · ${t('escrow.milestone.disputed', { date: formatDate(m.disputedAt) })}`}
                                    {m.paidAt &&
                                        ` · ${t('escrow.milestone.paid', { date: formatDate(m.paidAt) })}`}
                                </p>

                                {autoDate && (
                                    <p className="text-caption text-secondary">
                                        {t('escrow.autoApprove', { date: formatDate(autoDate) })}
                                    </p>
                                )}

                                {activeDispute ? (
                                    <DisputeBox dispute={activeDispute} contractId={contract.id} canUpload={open && (isClient || isFreelancer)} />
                                ) : (
                                    latestResolved && <DisputeBox dispute={latestResolved} contractId={contract.id} />
                                )}

                                {m.status === 'PAID' && (
                                    <p className="text-label-md text-success-ink">
                                        {m.resolvedReleaseCents != null && m.resolvedReleaseCents !== m.amountCents ? (
                                            <>
                                                {t('escrow.paid.split', {
                                                    amount: formatCents(m.resolvedReleaseCents),
                                                })}
                                                {isFreelancer
                                                    ? t('escrow.paid.freelancerSplit', {
                                                          net: formatCents(m.resolvedReleaseCents - fee),
                                                          fee: formatCents(fee),
                                                      })
                                                    : ''}
                                                {m.resolvedRefundCents > 0 &&
                                                    t('escrow.paid.refunded', {
                                                        amount: formatCents(m.resolvedRefundCents),
                                                    })}
                                            </>
                                        ) : isFreelancer ? (
                                            t('escrow.paid.freelancer', {
                                                net: formatCents((m.resolvedReleaseCents ?? m.amountCents) - fee),
                                                fee: formatCents(fee),
                                            })
                                        ) : (
                                            t('escrow.paid.client', {
                                                amount: formatCents(m.resolvedReleaseCents ?? m.amountCents),
                                            })
                                        )}
                                    </p>
                                )}

                                {m.status === 'DISPUTED' && (
                                    <p className="text-caption text-secondary">{t('escrow.disputedNote')}</p>
                                )}

                                {open && (
                                    <div className="flex flex-wrap items-center gap-2">
                                        {isClient && m.status === 'PENDING' &&
                                            (canFund(m) ? (
                                                <Button size="sm" onClick={() => startFund(m)}>
                                                    <Icon name="lock" className="text-[16px]" />
                                                    {t('escrow.actions.fund')}
                                                </Button>
                                            ) : (
                                                <span className="text-caption text-secondary">
                                                    {t('escrow.waiting.payEarlier')}
                                                </span>
                                            ))}

                                        {isClient && m.status === 'IN_REVIEW' && (
                                            <>
                                                <Button size="sm" onClick={() => setPending({ type: 'approve', milestone: m })}>
                                                    <Icon name="task_alt" className="text-[16px]" />
                                                    {t('escrow.actions.approve')}
                                                </Button>
                                                {limitReached ? (
                                                    <span className="text-caption text-warning-ink">
                                                        {t('escrow.waiting.revisionLimit')}
                                                    </span>
                                                ) : (
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        onClick={() => setPending({ type: 'changes', milestone: m })}
                                                    >
                                                        {t('escrow.actions.changes')}
                                                    </Button>
                                                )}
                                            </>
                                        )}

                                        {isFreelancer && (m.status === 'FUNDED' || m.status === 'IN_REVIEW') && (
                                            <div className="flex w-full flex-col gap-2">
                                                {m.status === 'FUNDED' && (
                                                    <Button size="sm" className="w-fit" onClick={() => setPending({ type: 'submit', milestone: m })}>
                                                        <Icon name="outbox" className="text-[16px]" />
                                                        {t('escrow.actions.submit')}
                                                    </Button>
                                                )}
                                                <FilePicker
                                                    purpose="MILESTONE_SUBMIT"
                                                    target={{ milestoneId: m.id }}
                                                    contractId={contract.id}
                                                    label={t('escrow.files.delivery')}
                                                />
                                            </div>
                                        )}

                                        {(isClient || isFreelancer) &&
                                            !activeDispute &&
                                            (m.status === 'FUNDED' || m.status === 'IN_REVIEW') && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="text-error hover:bg-error-container"
                                                    onClick={() => setDisputeFor(m)}
                                                >
                                                    <Icon name="report_problem" className="text-[16px]" />
                                                    {t('escrow.actions.openDispute')}
                                                </Button>
                                            )}

                                        {isFreelancer && m.status === 'PENDING' && (
                                            <span className="text-caption text-secondary">
                                                {t('escrow.waiting.clientFund')}
                                            </span>
                                        )}
                                        {isClient && m.status === 'FUNDED' && (
                                            <span className="text-caption text-secondary">
                                                {t('escrow.waiting.freelancerSubmit')}
                                            </span>
                                        )}
                                        {isFreelancer && m.status === 'IN_REVIEW' && (
                                            <span className="text-caption text-secondary">
                                                {t('escrow.waiting.clientReview')}
                                            </span>
                                        )}
                                    </div>
                                )}

                                {(filesByMilestone[m.id]?.length > 0) && (
                                    <div>
                                        <p className="text-caption font-semibold text-secondary">
                                            {t('escrow.files.delivery')}
                                        </p>
                                        <AttachmentList attachments={filesByMilestone[m.id]} compact />
                                    </div>
                                )}

                                <SubmissionHistory submissions={milestoneSubmissions} />
                            </Card>
                        );
                    })}
                </div>
            )}

            <ConfirmDialog
                open={!!pending}
                onClose={() => setPending(null)}
                onConfirm={handleConfirm}
                loading={funding || submitting || approving || requesting}
                variant={dialog?.variant}
                title={dialog?.title}
                message={dialog?.message}
                confirmText={dialog?.confirmText}
            />

            <Modal
                open={!!disputeFor}
                onClose={closeDisputeModal}
                title={t('escrow.modals.disputeTitle')}
                footer={
                    <>
                        <Button variant="secondary" onClick={closeDisputeModal} disabled={openingDispute}>
                            {t('common.actions.cancel')}
                        </Button>
                        <Button
                            variant="danger"
                            onClick={handleOpenDispute}
                            loading={openingDispute}
                            disabled={disputeReason.trim().length < 5}
                        >
                            {t('escrow.actions.openDispute')}
                        </Button>
                    </>
                }
            >
                <p className="mb-3 text-body-md text-secondary">{t('escrow.modals.disputeIntro')}</p>
                <Textarea
                    label={t('escrow.modals.reasonLabel')}
                    rows={2}
                    maxLength={500}
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    hint={t('escrow.modals.reasonHint')}
                />
                <Textarea
                    className="mt-3"
                    label={t('escrow.modals.detailsLabel')}
                    rows={4}
                    maxLength={2000}
                    value={disputeDetails}
                    onChange={(e) => setDisputeDetails(e.target.value)}
                />
            </Modal>

            <TopUpModal open={topUpOpen} onClose={() => setTopUpOpen(false)} />
        </>
    );
};

export default EscrowPanel;
