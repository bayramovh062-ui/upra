import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
import { useDeleteJobMutation, useGetMyJobsQuery } from '../features/jobs/jobsApi';
import { useTranslation } from '../features/locale/useTranslation';
import { formatMoney, getErrorMessage } from '../lib/format';
import { cn } from '../lib/cn';

const TAB_KEYS = ['ALL', 'DRAFT', 'OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

const IconLink = ({ to, label, icon }) => (
    <Link
        to={to}
        title={label}
        aria-label={label}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-secondary transition-colors hover:bg-surface-container hover:text-primary-container"
    >
        <Icon name={icon} className="text-[18px]" />
    </Link>
);

// Client: "My jobs" cədvəli (Stitch client dashboard-dakı My jobs bölməsinin tam səhifə variantı)
const MyJobsPage = () => {
    const { t, timeAgo } = useTranslation();
    // Tab URL-də saxlanır (?tab=DRAFT): qaralama saxlayandan sonra birbaşa Drafts tab-ına düşür
    const [searchParams, setSearchParams] = useSearchParams();
    const tabParam = searchParams.get('tab');
    const tab = TAB_KEYS.includes(tabParam) ? tabParam : 'ALL';
    const setTab = (key) => setSearchParams(key === 'ALL' ? {} : { tab: key }, { replace: true });
    const [jobToCancel, setJobToCancel] = useState(null);

    const { data, isLoading, isError, refetch } = useGetMyJobsQuery();
    const [deleteJob, { isLoading: cancelling }] = useDeleteJobMutation();

    const jobs = data?.jobs ?? [];
    const countOf = (key) => (key === 'ALL' ? jobs.length : jobs.filter((j) => j.status === key).length);
    const visible = tab === 'ALL' ? jobs : jobs.filter((j) => j.status === tab);

    const confirmCancel = async () => {
        try {
            await deleteJob(jobToCancel.id).unwrap();
            toast.success(
                jobToCancel.status === 'DRAFT'
                    ? t('jobs.myJobs.toastDraftDiscarded')
                    : t('jobs.myJobs.toastJobCancelled')
            );
        } catch (err) {
            toast.error(getErrorMessage(err, t('jobs.myJobs.errorCancel')));
        } finally {
            setJobToCancel(null);
        }
    };

    return (
        <>
            <PageHeader
                title={t('jobs.myJobs.title')}
                description={t('jobs.myJobs.description')}
                action={
                    <Link to="/client/jobs/new">
                        <Button>
                            <Icon name="add" />
                            {t('jobs.myJobs.postNew')}
                        </Button>
                    </Link>
                }
            />

            <div className="mb-4 flex gap-1 overflow-x-auto">
                {TAB_KEYS.map((key) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => setTab(key)}
                        className={cn(
                            'flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-body-md transition-colors',
                            tab === key
                                ? 'bg-inverse-surface font-medium text-on-primary shadow-sm'
                                : 'bg-surface-container-low text-secondary hover:bg-surface-container hover:text-on-surface'
                        )}
                    >
                        {t(`jobs.myJobs.tabs.${key}`)}
                        {!isLoading && <span className="tabular text-caption opacity-80">{countOf(key)}</span>}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <Card className="flex flex-col gap-4 p-5">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                    ))}
                </Card>
            ) : isError ? (
                <ErrorState title={t('jobs.myJobs.loadError')} onRetry={refetch} />
            ) : visible.length === 0 ? (
                <EmptyState
                    icon="work"
                    title={tab === 'ALL' ? t('jobs.myJobs.emptyAllTitle') : t('jobs.myJobs.emptyTabTitle')}
                    description={
                        tab === 'ALL' ? t('jobs.myJobs.emptyAllText') : t('jobs.myJobs.emptyTabText')
                    }
                    action={
                        tab === 'ALL' && (
                            <Link to="/client/jobs/new">
                                <Button>
                                    <Icon name="add" />
                                    {t('jobs.myJobs.postJob')}
                                </Button>
                            </Link>
                        )
                    }
                />
            ) : (
                <Card className="overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[720px] text-left">
                            <thead>
                                <tr className="border-b border-line bg-surface-container-low text-label-sm uppercase tracking-wider text-secondary">
                                    <th className="px-5 py-3 font-semibold">{t('jobs.myJobs.tableJob')}</th>
                                    <th className="px-5 py-3 font-semibold">{t('jobs.myJobs.tableStatus')}</th>
                                    <th className="px-5 py-3 text-right font-semibold">{t('jobs.myJobs.tableBudget')}</th>
                                    <th className="px-5 py-3 text-right font-semibold">{t('jobs.myJobs.tableProposals')}</th>
                                    <th className="px-5 py-3 text-right font-semibold">{t('jobs.myJobs.tableActions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visible.map((job) => {
                                    const isOpen = job.status === 'OPEN';
                                    const isDraft = job.status === 'DRAFT';
                                    const canEdit = isOpen || isDraft;
                                    return (
                                        <tr
                                            key={job.id}
                                            className="border-b border-line last:border-0 hover:bg-surface-container-low/60"
                                        >
                                            <td className="max-w-[320px] px-5 py-4">
                                                <Link
                                                    to={`/jobs/${job.id}`}
                                                    className="line-clamp-1 text-title-md text-on-surface transition-colors hover:text-primary-container"
                                                >
                                                    {job.title}
                                                </Link>
                                                <p className="text-caption text-secondary">
                                                    {isDraft
                                                        ? t('jobs.detail.savedAt', { time: timeAgo(job.createdAt) })
                                                        : t('jobs.detail.postedAt', { time: timeAgo(job.createdAt) })}
                                                </p>
                                            </td>
                                            <td className="px-5 py-4">
                                                <StatusBadge status={job.status} />
                                            </td>
                                            <td className="tabular px-5 py-4 text-right text-body-md text-on-surface">
                                                {formatMoney(job.budget)}
                                            </td>
                                            <td className="tabular px-5 py-4 text-right text-body-md text-on-surface">
                                                {job._count?.proposals ?? 0}
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex justify-end gap-1">
                                                    {!isDraft && (
                                                        <IconLink
                                                            to={`/client/jobs/${job.id}/proposals`}
                                                            label={t('jobs.myJobs.viewProposals')}
                                                            icon="inbox"
                                                        />
                                                    )}
                                                    {canEdit && (
                                                        <>
                                                            <IconLink
                                                                to={`/client/jobs/${job.id}/edit`}
                                                                label={t('jobs.detail.editJob')}
                                                                icon="edit"
                                                            />
                                                            <button
                                                                type="button"
                                                                title={
                                                                    isDraft
                                                                        ? t('jobs.detail.discardDraft')
                                                                        : t('jobs.detail.cancelJob')
                                                                }
                                                                aria-label={
                                                                    isDraft
                                                                        ? t('jobs.detail.discardDraft')
                                                                        : t('jobs.detail.cancelJob')
                                                                }
                                                                onClick={() => setJobToCancel(job)}
                                                                className="flex h-8 w-8 items-center justify-center rounded-lg text-secondary transition-colors hover:bg-error-container hover:text-error"
                                                            >
                                                                <Icon name="delete_outline" className="text-[18px]" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            <ConfirmDialog
                open={Boolean(jobToCancel)}
                onClose={() => setJobToCancel(null)}
                onConfirm={confirmCancel}
                loading={cancelling}
                variant="danger"
                title={
                    jobToCancel?.status === 'DRAFT'
                        ? t('jobs.myJobs.confirmDiscardTitle')
                        : t('jobs.myJobs.confirmCancelTitle')
                }
                message={
                    jobToCancel?.status === 'DRAFT'
                        ? t('jobs.myJobs.confirmDiscardText', { title: jobToCancel?.title ?? '' })
                        : t('jobs.myJobs.confirmCancelText', { title: jobToCancel?.title ?? '' })
                }
                confirmText={
                    jobToCancel?.status === 'DRAFT'
                        ? t('jobs.detail.discardDraft')
                        : t('jobs.detail.cancelJob')
                }
            />
        </>
    );
};

export default MyJobsPage;
