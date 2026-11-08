import { useState } from 'react';
import toast from 'react-hot-toast';
import {
    Badge,
    Button,
    Card,
    EmptyState,
    ErrorState,
    Icon,
    Modal,
    PageHeader,
    Skeleton,
    Textarea,
} from '../../components/ui';
import { formatCents, formatDate, getErrorMessage } from '../../lib/format';
import { cn } from '../../lib/cn';
import { useGetAdminDisputesQuery, useResolveAdminDisputeMutation } from '../../features/admin/adminApi';
import { AttachmentList } from '../../features/attachments/AttachmentComponents';

const TABS = [
    { key: 'OPEN', label: 'Open' },
    { key: 'RESOLVED', label: 'Resolved' },
    { key: 'ALL', label: 'All' },
];

const RESOLUTIONS = [
    { key: 'RELEASE', label: 'Release to freelancer', hint: 'The freelancer receives the full amount (10% platform fee applies).' },
    { key: 'REFUND', label: 'Refund the client', hint: 'The client gets the full escrowed amount back. No commission.' },
    { key: 'SPLIT', label: 'Split', hint: 'Choose how much is released and how much is refunded. The two must add up to the escrowed amount.' },
];

const dollarsToCents = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) return null;
    return Math.round(num * 100);
};

const ResolutionModal = ({ dispute, onClose }) => {
    const [resolution, setResolution] = useState('RELEASE');
    const [release, setRelease] = useState('');
    const [refund, setRefund] = useState('');
    const [adminNote, setAdminNote] = useState('');
    const [resolveDispute, { isLoading }] = useResolveAdminDisputeMutation();

    const gross = dispute.milestone?.amountCents ?? 0;
    const releaseCents = dollarsToCents(release);
    const refundCents = dollarsToCents(refund);
    const splitValid =
        resolution !== 'SPLIT' || (releaseCents !== null && refundCents !== null && releaseCents + refundCents === gross);

    const submit = async () => {
        try {
            const body =
                resolution === 'SPLIT'
                    ? { resolution, releaseCents, refundCents, adminNote: adminNote.trim() || undefined }
                    : { resolution, adminNote: adminNote.trim() || undefined };

            await resolveDispute({ id: dispute.id, contractId: dispute.contractId, ...body }).unwrap();
            toast.success('Dispute resolved');
            onClose();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not resolve the dispute'));
        }
    };

    return (
        <Modal
            open
            onClose={onClose}
            title="Resolve dispute"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={isLoading}>
                        Cancel
                    </Button>
                    <Button onClick={submit} loading={isLoading} disabled={!splitValid}>
                        Resolve dispute
                    </Button>
                </>
            }
        >
            <p className="mb-4 rounded-lg bg-surface-container px-3 py-2 text-label-md text-on-surface-variant">
                Escrowed amount on {dispute.milestone?.title}:{' '}
                <span className="tabular font-semibold text-on-surface">{formatCents(gross)}</span>
            </p>

            <div className="flex flex-col gap-2">
                {RESOLUTIONS.map((r) => (
                    <label
                        key={r.key}
                        className={cn(
                            'flex cursor-pointer gap-3 rounded-xl border px-3 py-2.5 transition',
                            resolution === r.key
                                ? 'border-primary-container bg-primary-fixed/30'
                                : 'border-line bg-white hover:bg-surface-container-low',
                        )}
                    >
                        <input
                            type="radio"
                            name="resolution"
                            value={r.key}
                            checked={resolution === r.key}
                            onChange={() => setResolution(r.key)}
                            className="mt-1"
                        />
                        <span>
                            <span className="block text-body-md font-medium text-on-surface">{r.label}</span>
                            <span className="mt-0.5 block text-label-md text-secondary">{r.hint}</span>
                        </span>
                    </label>
                ))}
            </div>

            {resolution === 'SPLIT' && (
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                        <label className="mb-1.5 block text-label-md text-on-surface" htmlFor="release-amount">
                            Release to freelancer (USD)
                        </label>
                        <input
                            id="release-amount"
                            type="number"
                            min="0"
                            step="0.01"
                            value={release}
                            onChange={(e) => setRelease(e.target.value)}
                            className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-body-md text-on-surface shadow-sm focus:border-primary-container focus:outline-none focus:ring-2 focus:ring-primary-container"
                        />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-label-md text-on-surface" htmlFor="refund-amount">
                            Refund to client (USD)
                        </label>
                        <input
                            id="refund-amount"
                            type="number"
                            min="0"
                            step="0.01"
                            value={refund}
                            onChange={(e) => setRefund(e.target.value)}
                            className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-body-md text-on-surface shadow-sm focus:border-primary-container focus:outline-none focus:ring-2 focus:ring-primary-container"
                        />
                    </div>
                    <p className={cn('text-label-md sm:col-span-2', splitValid ? 'text-secondary' : 'text-error')}>
                        {releaseCents !== null && refundCents !== null
                            ? `${formatCents(releaseCents)} + ${formatCents(refundCents)} = ${formatCents(
                                  releaseCents + refundCents
                              )} / ${formatCents(gross)}`
                            : `The two amounts must add up to ${formatCents(gross)}.`}
                    </p>
                </div>
            )}

            <Textarea
                className="mt-4"
                label="Admin note (optional)"
                rows={3}
                maxLength={2000}
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                hint="Visible to both parties in the dispute details."
            />
        </Modal>
    );
};

const DisputeCard = ({ dispute, onResolve }) => {
    const isOpen = dispute.status === 'OPEN';
    const m = dispute.milestone;

    return (
        <Card className="flex flex-col gap-3 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-caption uppercase tracking-wider text-secondary">
                        {dispute.contract?.jobPost?.title || 'Contract'} · milestone {m?.sequence}
                    </p>
                    <h2 className="break-words text-title-md text-on-surface">{m?.title}</h2>
                    <p className="mt-1 text-label-md text-secondary">
                        Opened by {dispute.openedBy?.fullName || 'unknown'} on {formatDate(dispute.openedAt)}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="tabular text-title-md font-semibold text-on-surface">{formatCents(m?.amountCents)}</span>
                    <Badge tone={isOpen ? 'red' : 'green'}>{isOpen ? 'Open' : 'Resolved'}</Badge>
                </div>
            </div>

            <div className="rounded-xl bg-surface-container-lowest p-3">
                <p className="text-label-md text-on-surface">
                    <span className="font-semibold">Reason:</span> {dispute.reason}
                </p>
                {dispute.details && (
                    <p className="mt-1 whitespace-pre-wrap break-words text-label-md text-on-surface-variant">
                        {dispute.details}
                    </p>
                )}
            </div>

            <p className="text-label-md text-secondary">
                Client: {dispute.contract?.client?.fullName || '—'} · Freelancer:{' '}
                {dispute.contract?.freelancer?.fullName || '—'}
            </p>

            <AttachmentList attachments={dispute.attachments} label="Evidence" compact />

            {isOpen ? (
                <div className="flex justify-end">
                    <Button size="sm" onClick={() => onResolve(dispute)}>
                        <Icon name="gavel" className="text-[16px]" />
                        Resolve
                    </Button>
                </div>
            ) : (
                <div className="flex flex-col gap-1 rounded-xl bg-surface-container-lowest p-3 text-label-md text-secondary">
                    <p className="font-semibold text-on-surface">{dispute.resolution}</p>
                    <p>
                        Released to freelancer: {formatCents(dispute.releaseToFreelancerCents)} · Refunded to client:{' '}
                        {formatCents(dispute.refundToClientCents)}
                    </p>
                    <p>
                        Resolved by {dispute.admin?.fullName || 'admin'} on {formatDate(dispute.resolvedAt)}
                        {dispute.adminNote ? ` · ${dispute.adminNote}` : ''}
                    </p>
                </div>
            )}
        </Card>
    );
};

const AdminDisputesPage = () => {
    const [tab, setTab] = useState('OPEN');
    const [target, setTarget] = useState(null);
    const { data, isLoading, isError, refetch } = useGetAdminDisputesQuery(
        tab === 'ALL' ? {} : { status: tab }
    );

    const disputes = data?.disputes ?? [];

    return (
        <>
            <PageHeader
                title="Disputes"
                description="Escrowed money stays frozen until you resolve a dispute. Every resolution is written to the ledger."
            />

            <div className="mb-6 inline-flex gap-1 rounded-xl bg-surface-container-low p-1">
                {TABS.map((t) => (
                    <button
                        key={t.key}
                        type="button"
                        onClick={() => setTab(t.key)}
                        className={cn(
                            'rounded-lg px-4 py-1.5 text-label-md transition-all',
                            tab === t.key
                                ? 'bg-surface-container-lowest font-semibold text-primary shadow-sm'
                                : 'text-on-surface-variant hover:text-on-surface',
                        )}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div className="flex flex-col gap-3">
                    {[0, 1, 2].map((i) => (
                        <Skeleton key={i} className="h-40 w-full" />
                    ))}
                </div>
            ) : isError ? (
                <ErrorState title="Could not load disputes" onRetry={refetch} />
            ) : disputes.length === 0 ? (
                <EmptyState
                    icon="gavel"
                    title="No disputes here"
                    description="When a client or freelancer disputes a funded milestone, it appears here for review."
                />
            ) : (
                <div className="flex flex-col gap-4">
                    {disputes.map((d) => (
                        <DisputeCard key={d.id} dispute={d} onResolve={setTarget} />
                    ))}
                </div>
            )}

            {target && <ResolutionModal dispute={target} onClose={() => setTarget(null)} />}
        </>
    );
};

export default AdminDisputesPage;
