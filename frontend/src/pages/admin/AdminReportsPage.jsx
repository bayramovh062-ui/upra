import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Badge, Button, Card, EmptyState, ErrorState, Icon, Modal, PageHeader, Skeleton, Textarea } from '../../components/ui';
import { formatDate, getErrorMessage, timeAgo } from '../../lib/format';
import { cn } from '../../lib/cn';
import { useTranslation } from '../../features/locale/useTranslation';
import { useGetAdminReportsQuery, useReviewAdminReportMutation } from '../../features/admin/adminApi';
import { AttachmentList } from '../../features/attachments/AttachmentComponents';

const TABS = [
    { key: 'OPEN', labelKey: 'admin.reports.tabs.OPEN' },
    { key: 'REVIEWED', labelKey: 'admin.reports.tabs.REVIEWED' },
    { key: 'CLOSED', labelKey: 'admin.reports.tabs.CLOSED' },
    { key: 'ALL', labelKey: 'admin.reports.tabs.ALL' },
];

const TARGET_TYPES = ['USER', 'CONTRACT', 'MILESTONE', 'JOB', 'MESSAGE'];

const STATUS_KEYS = {
    OPEN: 'common.status.OPEN',
    REVIEWED: 'common.status.REVIEWED',
    CLOSED: 'common.status.CLOSED',
};

// Target tipinə görə tətbiqdaxili keçid (mümkün olduqda)
const targetLink = (report) => {
    if (report.targetType === 'CONTRACT') return `/contracts/${report.targetId}`;
    if (report.targetType === 'USER') return `/users/${report.targetId}`;
    if (report.targetType === 'JOB') return `/jobs/${report.targetId}`;
    return null;
};

const ReviewModal = ({ report, onClose }) => {
    const { t } = useTranslation();
    const [status, setStatus] = useState('REVIEWED');
    const [adminNote, setAdminNote] = useState('');
    const [reviewReport, { isLoading }] = useReviewAdminReportMutation();

    const submit = async () => {
        try {
            await reviewReport({ id: report.id, status, adminNote: adminNote.trim() || undefined }).unwrap();
            toast.success(t('admin.reports.modal.updated'));
            onClose();
        } catch (err) {
            toast.error(getErrorMessage(err, t('admin.reports.modal.error')));
        }
    };

    const options = [
        {
            key: 'REVIEWED',
            labelKey: 'admin.reports.modal.markReviewed',
            hintKey: 'admin.reports.modal.markReviewedHint',
        },
        {
            key: 'CLOSED',
            labelKey: 'admin.reports.modal.closeWithoutAction',
            hintKey: 'admin.reports.modal.closeWithoutActionHint',
        },
    ];

    const targetLabel = TARGET_TYPES.includes(report.targetType)
        ? t(`admin.reports.targets.${report.targetType}`)
        : report.targetType;

    return (
        <Modal
            open
            onClose={onClose}
            title={t('admin.reports.modal.title')}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={isLoading}>
                        {t('common.actions.cancel')}
                    </Button>
                    <Button onClick={submit} loading={isLoading}>
                        {t('admin.reports.modal.save')}
                    </Button>
                </>
            }
        >
            <p className="mb-3 break-words rounded-lg bg-surface-container px-3 py-2 text-label-md text-on-surface-variant">
                <span className="font-semibold text-on-surface">{targetLabel}</span> · {report.reason}
            </p>

            <div className="flex flex-col gap-2">
                {options.map((s) => (
                    <label
                        key={s.key}
                        className={cn(
                            'flex cursor-pointer gap-3 rounded-xl border px-3 py-2.5 transition',
                            status === s.key
                                ? 'border-primary-container bg-primary-fixed/30'
                                : 'border-line bg-surface-container-lowest hover:bg-surface-container-low',
                        )}
                    >
                        <input
                            type="radio"
                            name="report-status"
                            value={s.key}
                            checked={status === s.key}
                            onChange={() => setStatus(s.key)}
                            className="mt-1"
                        />
                        <span>
                            <span className="block text-body-md font-medium text-on-surface">{t(s.labelKey)}</span>
                            <span className="mt-0.5 block text-label-md text-secondary">{t(s.hintKey)}</span>
                        </span>
                    </label>
                ))}
            </div>

            <Textarea
                className="mt-4"
                label={t('admin.reports.modal.noteLabel')}
                rows={3}
                maxLength={2000}
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
            />
        </Modal>
    );
};

const ReportCard = ({ report, onReview }) => {
    const { t } = useTranslation();
    const link = targetLink(report);
    const statusKey = STATUS_KEYS[report.status];

    const targetLabel = TARGET_TYPES.includes(report.targetType)
        ? t(`admin.reports.targets.${report.targetType}`)
        : report.targetType;

    return (
        <Card className="flex flex-col gap-3 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-caption uppercase tracking-wider text-secondary">
                        {t('admin.reports.subtitle', { target: targetLabel, time: timeAgo(report.createdAt) })}
                    </p>
                    <h2 className="break-words text-title-md text-on-surface">{report.reason}</h2>
                    <p className="mt-1 text-label-md text-secondary">
                        {t('admin.reports.reportedBy', {
                            name: report.reporter?.fullName || t('admin.reports.unknown'),
                        })}
                        {report.reporter?.email ? ` (${report.reporter.email})` : ''}
                    </p>
                </div>
                <Badge tone={report.status === 'OPEN' ? 'amber' : report.status === 'REVIEWED' ? 'green' : 'gray'}>
                    {t(statusKey)}
                </Badge>
            </div>

            {report.details && (
                <p className="rounded-xl bg-surface-container-lowest p-3 whitespace-pre-wrap break-words text-label-md text-on-surface-variant">
                    {report.details}
                </p>
            )}

            <AttachmentList attachments={report.attachments} label={t('admin.reports.evidence')} compact />

            <p className="break-all text-caption text-secondary">
                {t('admin.reports.targetId', { id: report.targetId })}
                {link && (
                    <>
                        {' · '}
                        <Link to={link} className="text-primary-container underline">
                            {t('admin.reports.openTarget')}
                        </Link>
                    </>
                )}
            </p>

            {report.status === 'OPEN' ? (
                <div className="flex justify-end">
                    <Button size="sm" onClick={() => onReview(report)}>
                        <Icon name="fact_check" className="text-[16px]" />
                        {t('admin.reports.modal.title')}
                    </Button>
                </div>
            ) : (
                <div className="rounded-xl bg-surface-container-lowest p-3 text-label-md text-secondary">
                    {t('admin.reports.reviewedBy', {
                        status: t(statusKey),
                        name: report.admin?.fullName || t('admin.reports.adminFallback'),
                        date: formatDate(report.reviewedAt),
                    })}
                    {report.adminNote ? ` · ${report.adminNote}` : ''}
                </div>
            )}
        </Card>
    );
};

const AdminReportsPage = () => {
    const { t } = useTranslation();
    const [tab, setTab] = useState('OPEN');
    const [target, setTarget] = useState(null);
    const { data, isLoading, isError, refetch } = useGetAdminReportsQuery(tab === 'ALL' ? {} : { status: tab });

    const reports = data?.reports ?? [];

    return (
        <>
            <PageHeader title={t('admin.reports.title')} description={t('admin.reports.description')} />

            <div className="mb-6 inline-flex flex-wrap gap-1 rounded-xl bg-surface-container-low p-1">
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
                        <Skeleton key={i} className="h-36 w-full" />
                    ))}
                </div>
            ) : isError ? (
                <ErrorState title={t('admin.reports.loadError')} onRetry={refetch} />
            ) : reports.length === 0 ? (
                <EmptyState
                    icon="flag"
                    title={t('admin.reports.emptyTitle')}
                    description={t('admin.reports.emptyText')}
                />
            ) : (
                <div className="flex flex-col gap-4">
                    {reports.map((r) => (
                        <ReportCard key={r.id} report={r} onReview={setTarget} />
                    ))}
                </div>
            )}

            {target && <ReviewModal report={target} onClose={() => setTarget(null)} />}
        </>
    );
};

export default AdminReportsPage;
