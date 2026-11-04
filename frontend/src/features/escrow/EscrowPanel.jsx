import { useState } from 'react';
import toast from 'react-hot-toast';
import { Button, Card, ConfirmDialog, EmptyState, Icon } from '../../components/ui';
import { formatCents, formatDate, getErrorMessage } from '../../lib/format';
import TopUpModal from '../wallet/TopUpModal';
import { useGetWalletQuery } from '../wallet/walletApi';
import {
    useApproveMilestoneMutation,
    useFundMilestoneMutation,
    useRequestMilestoneChangesMutation,
    useSubmitMilestoneMutation,
} from './escrowApi';
import { MilestoneBadge, calcCommissionCents, summarizeMilestones } from './escrow';

const AUTO_APPROVE_DAYS = 7; // backend: AUTO_APPROVE_DAYS
const DAY_MS = 24 * 60 * 60 * 1000;

const SummaryCard = ({ label, value, hint }) => (
    <Card className="p-4">
        <p className="text-caption uppercase tracking-wider text-secondary">{label}</p>
        <p className="tabular mt-1 text-headline-sm text-on-surface">{value}</p>
        {hint && <p className="mt-0.5 text-caption text-secondary">{hint}</p>}
    </Card>
);

// type: 'fund' | 'submit' | 'approve' | 'changes'. Hər biri üçün təsdiq pəncərəsinin mətni
const buildDialog = (type, m) => {
    const amount = formatCents(m.amountCents);
    const fee = formatCents(calcCommissionCents(m.amountCents));

    return {
        fund: {
            title: 'Fund this milestone?',
            confirmText: 'Fund milestone',
            variant: 'primary',
            message: `${amount} moves from your wallet into escrow. The freelancer is paid only after you approve the work.`,
        },
        submit: {
            title: 'Submit this milestone?',
            confirmText: 'Submit for review',
            variant: 'primary',
            message: `The client will review it. If they do not respond, it is approved automatically after ${AUTO_APPROVE_DAYS} days.`,
        },
        approve: {
            title: 'Approve and pay?',
            confirmText: 'Approve & pay',
            variant: 'primary',
            message: `${amount} is released from escrow to the freelancer. A 10% platform fee (${fee}) is taken from the freelancer's payout. This cannot be undone.`,
        },
        changes: {
            title: 'Request changes?',
            confirmText: 'Request changes',
            variant: 'secondary',
            message: 'The milestone goes back to the freelancer. The money stays in escrow.',
        },
    }[type];
};

const EscrowPanel = ({ contract, isClient, isFreelancer }) => {
    const milestones = contract.milestones ?? [];
    const open = contract.status === 'ACTIVE' || contract.status === 'DELIVERED';
    const summary = summarizeMilestones(milestones, isFreelancer);

    // Yalnız client-in pul kisəsi lazımdır (maliyyələşdirmə üçün)
    const walletQ = useGetWalletQuery(undefined, { skip: !isClient });
    const available = walletQ.data?.wallet?.availableCents;

    const [pending, setPending] = useState(null); // { type, milestone }
    const [topUpOpen, setTopUpOpen] = useState(false);

    const [fundMilestone, { isLoading: funding }] = useFundMilestoneMutation();
    const [submitMilestone, { isLoading: submitting }] = useSubmitMilestoneMutation();
    const [approveMilestone, { isLoading: approving }] = useApproveMilestoneMutation();
    const [requestChanges, { isLoading: requesting }] = useRequestMilestoneChangesMutation();

    const RUN = {
        fund: { run: fundMilestone, success: 'Milestone funded' },
        submit: { run: submitMilestone, success: 'Milestone submitted for review' },
        approve: { run: approveMilestone, success: 'Milestone approved and paid' },
        changes: { run: requestChanges, success: 'Changes requested' },
    };

    // Backend qaydası: əvvəlki bütün mərhələlər PAID olmalıdır
    const canFund = (m) =>
        milestones.filter((x) => x.sequence < m.sequence).every((x) => x.status === 'PAID');

    const startFund = (m) => {
        // Balans məlumdursa və çatmırsa, əvvəl pul əlavə etməyə yönləndiririk
        if (available !== undefined && available < m.amountCents) {
            toast('Your wallet balance is too low. Add demo funds first.', { icon: '💳' });
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
            toast.error(getErrorMessage(err, 'Action failed'));
            setPending(null);
        }
    };

    const dialog = pending ? buildDialog(pending.type, pending.milestone) : null;

    return (
        <>
            <p className="mb-4 flex items-center gap-2 rounded-lg bg-warning-soft px-3 py-2 text-label-md text-warning-ink">
                <Icon name="science" className="text-[18px]" />
                Demo: all money here is simulated (USD). No real payments are made.
            </p>

            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <SummaryCard label="Locked in escrow" value={formatCents(summary.lockedCents)} hint="Funded, not paid yet" />
                <SummaryCard
                    label={isFreelancer ? 'Earned' : 'Released'}
                    value={formatCents(summary.releasedCents)}
                    hint={isFreelancer ? 'After the 10% platform fee' : 'Paid to the freelancer'}
                />
                <SummaryCard label="Not yet funded" value={formatCents(summary.unfundedCents)} hint="Waiting for the client" />
            </div>

            {isClient && (
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-container-lowest px-4 py-3">
                    <p className="text-body-md text-on-surface">
                        Wallet balance:{' '}
                        <span className="tabular font-semibold">{available === undefined ? '…' : formatCents(available)}</span>
                    </p>
                    <Button variant="secondary" size="sm" onClick={() => setTopUpOpen(true)}>
                        <Icon name="add_card" className="text-[16px]" />
                        Add demo funds
                    </Button>
                </div>
            )}

            <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-headline-sm text-on-surface">
                    <Icon name="account_balance" className="text-[22px] text-primary-container" />
                    Milestones
                    <span className="text-label-md font-normal text-secondary">
                        {summary.paid} / {summary.total} paid
                    </span>
                </h2>
            </div>

            {milestones.length === 0 ? (
                <EmptyState icon="flag" title="No milestones" description="This contract has no milestone plan." />
            ) : (
                <div className="flex flex-col gap-3">
                    {milestones.map((m) => {
                        const fee = calcCommissionCents(m.amountCents);
                        const autoDate =
                            m.status === 'IN_REVIEW' && m.submittedAt
                                ? new Date(new Date(m.submittedAt).getTime() + AUTO_APPROVE_DAYS * DAY_MS)
                                : null;

                        return (
                            <Card key={m.id} className="flex flex-col gap-3 p-4 sm:p-5">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-caption uppercase tracking-wider text-secondary">
                                            Milestone {m.sequence}
                                        </p>
                                        <h3 className="break-words text-title-md text-on-surface">{m.title}</h3>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="tabular text-title-md font-semibold text-on-surface">
                                            {formatCents(m.amountCents)}
                                        </span>
                                        <MilestoneBadge status={m.status} />
                                    </div>
                                </div>

                                <p className="text-caption text-secondary">
                                    {m.dueDate && `Due ${formatDate(m.dueDate)}`}
                                    {m.fundedAt && `${m.dueDate ? ' · ' : ''}Funded ${formatDate(m.fundedAt)}`}
                                    {m.submittedAt && m.status === 'IN_REVIEW' && ` · Submitted ${formatDate(m.submittedAt)}`}
                                    {m.paidAt && ` · Paid ${formatDate(m.paidAt)}`}
                                </p>

                                {autoDate && (
                                    <p className="text-caption text-secondary">
                                        Approved automatically on {formatDate(autoDate)} if the client does not respond.
                                    </p>
                                )}

                                {m.status === 'PAID' && (
                                    <p className="text-label-md text-success-ink">
                                        {isFreelancer
                                            ? `You received ${formatCents(m.amountCents - fee)} (platform fee ${formatCents(fee)}).`
                                            : `Paid ${formatCents(m.amountCents)} to the freelancer.`}
                                    </p>
                                )}

                                {open && (
                                    <div className="flex flex-wrap items-center gap-2">
                                        {isClient && m.status === 'PENDING' &&
                                            (canFund(m) ? (
                                                <Button size="sm" onClick={() => startFund(m)}>
                                                    <Icon name="lock" className="text-[16px]" />
                                                    Fund milestone
                                                </Button>
                                            ) : (
                                                <span className="text-caption text-secondary">
                                                    Pay the earlier milestones first.
                                                </span>
                                            ))}

                                        {isClient && m.status === 'IN_REVIEW' && (
                                            <>
                                                <Button size="sm" onClick={() => setPending({ type: 'approve', milestone: m })}>
                                                    <Icon name="task_alt" className="text-[16px]" />
                                                    Approve &amp; pay
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    onClick={() => setPending({ type: 'changes', milestone: m })}
                                                >
                                                    Request changes
                                                </Button>
                                            </>
                                        )}

                                        {isFreelancer && m.status === 'FUNDED' && (
                                            <Button size="sm" onClick={() => setPending({ type: 'submit', milestone: m })}>
                                                <Icon name="outbox" className="text-[16px]" />
                                                Submit milestone
                                            </Button>
                                        )}

                                        {isFreelancer && m.status === 'PENDING' && (
                                            <span className="text-caption text-secondary">
                                                Waiting for the client to fund this milestone.
                                            </span>
                                        )}
                                        {isClient && m.status === 'FUNDED' && (
                                            <span className="text-caption text-secondary">
                                                Funded. Waiting for the freelancer to submit.
                                            </span>
                                        )}
                                        {isFreelancer && m.status === 'IN_REVIEW' && (
                                            <span className="text-caption text-secondary">Waiting for the client to review.</span>
                                        )}
                                    </div>
                                )}
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

            <TopUpModal open={topUpOpen} onClose={() => setTopUpOpen(false)} />
        </>
    );
};

export default EscrowPanel;
