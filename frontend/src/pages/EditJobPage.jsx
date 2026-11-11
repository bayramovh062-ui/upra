import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { Button, EmptyState, ErrorState, PageHeader, Skeleton } from '../components/ui';
import JobForm from '../features/jobs/JobForm';
import { useGetJobQuery, usePublishJobMutation, useUpdateJobMutation } from '../features/jobs/jobsApi';
import { useTranslation } from '../features/locale/useTranslation';
import { getErrorMessage } from '../lib/format';

const EditJobPage = () => {
    const { t } = useTranslation();
    const { id } = useParams();
    const navigate = useNavigate();
    const user = useSelector((state) => state.auth.user);

    const { data, isLoading, isError, error, refetch } = useGetJobQuery(id);
    const [updateJob, { isLoading: updating }] = useUpdateJobMutation();
    const [publishJob, { isLoading: publishing }] = usePublishJobMutation();

    const backButton = (
        <Link to="/client/jobs">
            <Button>{t('jobs.edit.back')}</Button>
        </Link>
    );

    if (isLoading) {
        return (
            <>
                <Skeleton className="mb-6 h-9 w-48" />
                <Skeleton className="h-96 w-full" />
            </>
        );
    }

    if (isError) {
        if (error?.status === 404 || error?.status === 400) {
            return <EmptyState icon="search_off" title={t('jobs.edit.notFound')} action={backButton} />;
        }
        return <ErrorState title={t('jobs.edit.loadError')} onRetry={refetch} />;
    }

    const { job } = data;

    // Backend də bunu yoxlayır, burada istifadəçiyə aydın mesaj göstəririk
    if (job.client?.id !== user?.id) {
        return (
            <EmptyState
                icon="lock"
                title={t('jobs.edit.onlyOwn')}
                action={backButton}
            />
        );
    }

    const isDraft = job.status === 'DRAFT';
    if (job.status !== 'OPEN' && !isDraft) {
        return (
            <EmptyState
                icon="lock"
                title={t('jobs.edit.lockedTitle')}
                description={t('jobs.edit.lockedText')}
                action={backButton}
            />
        );
    }

    // intent: 'publish' (qaralamanı dərc et), 'draft' (qaralamanı saxla), 'save' (açıq elanı saxla)
    const onSubmit = async (payload, intent) => {
        try {
            await updateJob({ id: job.id, ...payload }).unwrap();

            if (intent === 'publish') {
                await publishJob(job.id).unwrap();
                toast.success(t('jobs.edit.toastPublished'));
                navigate(`/jobs/${job.id}`, { replace: true });
            } else if (intent === 'draft') {
                toast.success(t('jobs.edit.toastDraftSaved'));
                navigate('/client/jobs?tab=DRAFT', { replace: true });
            } else {
                toast.success(t('jobs.edit.toastUpdated'));
                navigate(`/jobs/${job.id}`, { replace: true });
            }
        } catch (err) {
            toast.error(getErrorMessage(err, t('jobs.edit.errorSave')));
        }
    };

    return (
        <>
            <PageHeader
                title={isDraft ? t('jobs.edit.titleDraft') : t('jobs.edit.titleOpen')}
                description={
                    isDraft ? t('jobs.edit.descriptionDraft') : t('jobs.edit.descriptionOpen')
                }
            />
            <JobForm
                key={job.id}
                mode={isDraft ? 'editDraft' : 'editOpen'}
                // Prisma Decimal string qayıdır ("500.00"), formada rəqəm lazımdır.
                // Köhnə elanlarda kateqoriya, səviyyə və bacarıq boş ola bilər.
                defaultValues={{
                    title: job.title,
                    description: job.description,
                    budget: Number(job.budget),
                    categoryId: job.category?.id ?? '',
                    experienceLevel: job.experienceLevel ?? '',
                    paymentStructure: job.paymentStructure ?? 'MILESTONES',
                    skills: (job.skills ?? []).map((skill) => skill.name),
                    deadline: job.deadline ? String(job.deadline).slice(0, 10) : '',
                }}
                onSubmit={onSubmit}
                submitting={updating || publishing}
                cancelTo={`/jobs/${job.id}`}
            />
        </>
    );
};

export default EditJobPage;
