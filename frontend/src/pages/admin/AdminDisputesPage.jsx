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
import { useTranslation } from '../../features/locale/useTranslation';
import { useGetAdminDisputesQuery, useResolveAdminDisputeMutation } from '../../features/admin/adminApi';
import { AttachmentList } from '../../features/attachments/AttachmentComponents';

const TABS = [
    { key: 'OPEN', labelKey: 'disputes.tabs.OPEN' },
    { key: 'RESOLVED', labelKey: 'disputes.tabs.RESOLVED' },
    { key: 'ALL', labelKey: 'disputes.tabs.ALL' },
];

const RESOLUTIONS = [
    {
        key: 'RELEASE',
        labelKey: 'disputes.modal.release',
        hintKey: 'disputes.modal.releaseHint',
    },
    {
        key: 'REFUND',
        labelKey: 'disputes.modal.refund',
        hintKey: 'disputes.modal.refundHint',
    },
    {
        key: 'SPLIT',
        labelKey: 'disputes.modal.split',
        hintKey: 'disputes.modal.splitHint',
    },
];

const dollarsToCents = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) return null;
    return Math.round(num * 100);
};

const ResolutionModal = ({ dispute, onClose }) => {
    const { t } = useTranslation();
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
            toast.success(t('disputes.modal.resolved'));
            onClose();
        } catch (err) {
            toast.error(getErrorMessage(err, t('disputes.modal.error')));
        }
    };

    return (
        <Modal
            open
            onClose={onClose}
            title={t('disputes.modal.title')}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={isLoading}>
                        {t('common.actions.cancel')}
                    </Button>
                    <Button onClick={submit} loading={isLoading} disabled={!splitValid}>
                        {t('disputes.modal.submit')}
                    </Button>
                </>
            }
        >
            <p className="mb-4 rounded-lg bg-surface-container px-3 py-2 text-label-md text-on-surface-variant">
                {t('disputes.modal.escrowAmount', {
                    title: dispute.milestone?.title ?? '',
                    amount: formatCents(gross),
                })}
            </p>

            <div className="flex flex-col gap-2">
                {RESOLUTIONS.map((r) => (
                    <label
                        key={r.key}
                        className={cn(
                            'flex cursor-pointer gap-3 rounded-xl border px-3 py-2.5 transition',
                            resolution === r.key
                                ? 'border-primary-container bg-primary-fixed/30'
                                : 'border-line bg-surface-container-lowest hover:bg-surface-container-low',
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
                            <span className="block text-body-md font-medium text-on-surface">{t(r.labelKey)}</span>
                            <span className="mt-0.5 block text-label-md text-secondary">{t(r.hintKey)}</span>
                        </span>
                    </label>
                ))}
            </div>

            {resolution === 'SPLIT' && (
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                        <label className="mb-1.5 block text-label-md text-on-surface" htmlFor="release-amount">
                            {t('disputes.modal.releaseAmount')}
                        </label>
                        <input
                            id="release-amount"
                            type="number"
                            min="0"
                            step="0.01"
                            value={release}
                            onChange={(e) => setRelease(e.target.value)}
                            className="w-full rounded-xl border border-line bg-surface-container-lowest px-3.5 py-2.5 text-body-md text-on-surface shadow-sm focus:border-primary-container focus:outline-none focus:ring-2 focus:ring-primary-container"
                        />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-label-md text-on-surface" htmlFor="refund-amount">
                            {t('disputes.modal.refundAmount')}
                        </label>
                        <input
                            id="refund-amount"
                            type="number"
                            min="0"
                            step="0.01"
                            value={refund}
                            onChange={(e) => setRefund(e.target.value)}
                            className="w-full rounded-xl border border-line bg-surface-container-lowest px-3.5 py-2.5 text-body-md text-on-surface shadow-sm focus:border-primary-container focus:outline-none focus:ring-2 focus:ring-primary-container"
                        />
                    </div>
                    <p className={cn('text-label-md sm:col-span-2', splitValid ? 'text-secondary' : 'text-error')}>
                        {releaseCents !== null && refundCents !== null
                            ? `${formatCents(releaseCents)} + ${formatCents(refundCents)} = ${formatCents(
                                  releaseCents + refundCents
                              )} / ${formatCents(gross)}`
                            : t('disputes.modal.splitMismatch', { amount: formatCents(gross) })}
                    </p>
                </div>
            )}

            <Textarea
                className="mt-4"
                label={t('disputes.modal.noteLabel')}
                rows={3}
                maxLength={2000}
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                hint={t('disputes.modal.noteHint')}
            />
        </Modal>
    );
};

const DisputeCard = ({ dispute, onResolve }) => {
    const { t } = useTranslation();
    const isOpen = dispute.status === 'OPEN';
    const m = dispute.milestone;
    const resolution = dispute.resolution
        ? t(`disputes.resolutions.${dispute.resolution}`)
        : dispute.resolution;

    return (
        <Card className="flex flex-col gap-3 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-caption uppercase tracking-wider text-secondary">
                        {dispute.contract?.jobPost?.title || t('disputes.card.fallback')} ·{' '}
                        {t('disputes.card.milestone', { number: m?.sequence })}
                    </p>
                    <h2 className="break-words text-title-md text-on-surface">{m?.title}</h2>
                    <p className="mt-1 text-label-md text-secondary">
                        {t('disputes.card.openedBy', {
                            name: dispute.openedBy?.fullName || t('disputes.card.unknown'),
                            date: formatDate(dispute.openedAt),
                        })}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="tabular text-title-md font-semibold text-on-surface">{formatCents(m?.amountCents)}</span>
                    <Badge tone={isOpen ? 'red' : 'green'}>
                        {t(isOpen ? 'disputes.tabs.OPEN' : 'disputes.tabs.RESOLVED')}
                    </Badge>
                </div>
            </div>

            <div className="rounded-xl bg-surface-container-lowest p-3">
                <p className="text-label-md text-on-surface">
                    <span className="font-semibold">{t('disputes.card.reason')}</span> {dispute.reason}
                </p>
                {dispute.details && (
                    <p className="mt-1 whitespace-pre-wrap break-words text-label-md text-on-surface-variant">
                        {dispute.details}
                    </p>
                )}
            </div>

            <p className="text-label-md text-secondary">
                {t('disputes.card.parties', {
                    client: dispute.contract?.client?.fullName || t('common.labels.noValue'),
                    freelancer: dispute.contract?.freelancer?.fullName || t('common.labels.noValue'),
                })}
            </p>

            <AttachmentList attachments={dispute.attachments} label={t('disputes.card.evidence')} compact />

            {isOpen ? (
                <div className="flex justify-end">
                    <Button size="sm" onClick={() => onResolve(dispute)}>
                        <Icon name="report_problem" className="text-[16px]" />
                        {t('disputes.card.resolve')}
                    </Button>
                </div>
            ) : (
                <div className="flex flex-col gap-1 rounded-xl bg-surface-container-lowest p-3 text-label-md text-secondary">
                    <p className="font-semibold text-on-surface">{resolution}</p>
                    <p>
                        {t('disputes.card.releasedToFreelancer', {
                            amount: formatCents(dispute.releaseToFreelancerCents),
                        })}{' '}
                        · {t('disputes.card.refundedToClient', { amount: formatCents(dispute.refundToClientCents) })}
                    </p>
                    <p>
                        {t('disputes.card.resolvedBy', {
                            name: dispute.admin?.fullName || t('disputes.card.adminFallback'),
                            date: formatDate(dispute.resolvedAt),
                        })}
                        {dispute.adminNote ? ` · ${dispute.adminNote}` : ''}
                    </p>
                </div>
            )}
        </Card>
    );
};

const AdminDisputesPage = () => {
    const { t } = useTranslation();
    const [tab, setTab] = useState('OPEN');
    const [target, setTarget] = useState(null);
    const { data, isLoading, isError, refetch } = useGetAdminDisputesQuery(
        tab === 'ALL' ? {} : { status: tab }
    );

    const disputes = data?.disputes ?? [];

    return (
        <>
            <PageHeader title={t('disputes.page.title')} description={t('disputes.page.description')} />

            <div className="mb-6 inline-flex gap-1 rounded-xl bg-surface-container-low p-1">
                {TABS.map((item) => (
                    <button
                        key={item.key}
                        type="button"
                        onClick={() => setTab(item.key)}
                        className={cn(
                            'rounded-lg px-4 py-1.5 text-label-md transition-all',
                            tab === item.key
                                ? 'bg-surface-container-lowest font-semibold text-primary shadow-sm'
                                : 'text-on-surface-variant hover:text-on-surface',
                        )}
                    >
                        {t(item.labelKey)}
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
                <ErrorState title={t('disputes.page.loadError')} onRetry={refetch} />
            ) : disputes.length === 0 ? (
                <EmptyState
                    icon="report_problem"
                    title={t('disputes.page.emptyTitle')}
                    description={t('disputes.page.emptyText')}
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
