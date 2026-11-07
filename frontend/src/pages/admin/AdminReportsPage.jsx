import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Badge, Button, Card, EmptyState, ErrorState, Icon, Modal, PageHeader, Skeleton, Textarea } from '../../components/ui';
import { formatDate, getErrorMessage, timeAgo } from '../../lib/format';
import { cn } from '../../lib/cn';
import { useGetAdminReportsQuery, useReviewAdminReportMutation } from '../../features/admin/adminApi';

const TABS = [
    { key: 'OPEN', label: 'Open' },
    { key: 'REVIEWED', label: 'Reviewed' },
    { key: 'CLOSED', label: 'Closed' },
    { key: 'ALL', label: 'All' },
];

const TARGET_LABELS = {
    USER: 'User',
    CONTRACT: 'Contract',
    MILESTONE: 'Milestone',
    JOB: 'Job',
    MESSAGE: 'Message',
};

// Target tipinə görə tətbiqdaxili keçid (mümkün olduqda)
const targetLink = (report) => {
    if (report.targetType === 'CONTRACT') return `/contracts/${report.targetId}`;
    if (report.targetType === 'USER') return `/users/${report.targetId}`;
    if (report.targetType === 'JOB') return `/jobs/${report.targetId}`;
    return null;
};

const ReviewModal = ({ report, onClose }) => {
    const [status, setStatus] = useState('REVIEWED');
    const [adminNote, setAdminNote] = useState('');
    const [reviewReport, { isLoading }] = useReviewAdminReportMutation();

    const submit = async () => {
        try {
            await reviewReport({ id: report.id, status, adminNote: adminNote.trim() || undefined }).unwrap();
            toast.success('Report updated');
            onClose();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not update the report'));
        }
    };

    return (
        <Modal
            open
            onClose={onClose}
            title="Review report"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={isLoading}>
                        Cancel
                    </Button>
                    <Button onClick={submit} loading={isLoading}>
                        Save
                    </Button>
                </>
            }
        >
            <p className="mb-3 break-words rounded-lg bg-surface-container px-3 py-2 text-label-md text-on-surface-variant">
                <span className="font-semibold text-on-surface">{TARGET_LABELS[report.targetType]}</span> ·{' '}
                {report.reason}
            </p>

            <div className="flex flex-col gap-2">
                {[
                    { key: 'REVIEWED', label: 'Mark as reviewed', hint: 'The report has been seen and handled.' },
                    { key: 'CLOSED', label: 'Close without action', hint: 'The report is dismissed.' },
                ].map((s) => (
                    <label
                        key={s.key}
                        className={cn(
                            'flex cursor-pointer gap-3 rounded-xl border px-3 py-2.5 transition',
                            status === s.key
                                ? 'border-primary-container bg-primary-fixed/30'
                                : 'border-line bg-white hover:bg-surface-container-low',
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
                            <span className="block text-body-md font-medium text-on-surface">{s.label}</span>
                            <span className="mt-0.5 block text-label-md text-secondary">{s.hint}</span>
                        </span>
                    </label>
                ))}
            </div>

            <Textarea
                className="mt-4"
                label="Admin note (optional)"
                rows={3}
                maxLength={2000}
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
            />
        </Modal>
    );
};

const ReportCard = ({ report, onReview }) => {
    const isOpen = report.status === 'OPEN';
    const link = targetLink(report);

    return (
        <Card className="flex flex-col gap-3 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-caption uppercase tracking-wider text-secondary">
                        {TARGET_LABELS[report.targetType] || report.targetType} report · {timeAgo(report.createdAt)}
                    </p>
                    <h2 className="break-words text-title-md text-on-surface">{report.reason}</h2>
                    <p className="mt-1 text-label-md text-secondary">
                        Reported by {report.reporter?.fullName || 'unknown'}
                        {report.reporter?.email ? ` (${report.reporter.email})` : ''}
                    </p>
                </div>
                <Badge tone={isOpen ? 'amber' : report.status === 'REVIEWED' ? 'green' : 'gray'}>
                    {isOpen ? 'Open' : report.status === 'REVIEWED' ? 'Reviewed' : 'Closed'}
                </Badge>
            </div>

            {report.details && (
                <p className="rounded-xl bg-surface-container-lowest p-3 whitespace-pre-wrap break-words text-label-md text-on-surface-variant">
                    {report.details}
                </p>
            )}

            <p className="break-all text-caption text-secondary">
                Target ID: {report.targetId}
                {link && (
                    <>
                        {' · '}
                        <Link to={link} className="text-primary-container underline">
                            Open target
                        </Link>
                    </>
                )}
            </p>

            {isOpen ? (
                <div className="flex justify-end">
                    <Button size="sm" onClick={() => onReview(report)}>
                        <Icon name="fact_check" className="text-[16px]" />
                        Review
                    </Button>
                </div>
            ) : (
                <div className="rounded-xl bg-surface-container-lowest p-3 text-label-md text-secondary">
                    {report.status === 'CLOSED' ? 'Closed' : 'Reviewed'} by {report.admin?.fullName || 'admin'} on{' '}
                    {formatDate(report.reviewedAt)}
                    {report.adminNote ? ` · ${report.adminNote}` : ''}
                </div>
            )}
        </Card>
    );
};

const AdminReportsPage = () => {
    const [tab, setTab] = useState('OPEN');
    const [target, setTarget] = useState(null);
    const { data, isLoading, isError, refetch } = useGetAdminReportsQuery(tab === 'ALL' ? {} : { status: tab });

    const reports = data?.reports ?? [];

    return (
        <>
            <PageHeader
                title="Reports"
                description="User-submitted reports about users, jobs, contracts, milestones and messages."
            />

            <div className="mb-6 inline-flex flex-wrap gap-1 rounded-xl bg-surface-container-low p-1">
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
                        <Skeleton key={i} className="h-36 w-full" />
                    ))}
                </div>
            ) : isError ? (
                <ErrorState title="Could not load reports" onRetry={refetch} />
            ) : reports.length === 0 ? (
                <EmptyState
                    icon="flag"
                    title="No reports here"
                    description="Reports submitted by users appear here for moderation."
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
