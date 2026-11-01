import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { Button, EmptyState, ErrorState, PageHeader, Skeleton } from '../components/ui';
import JobForm from '../features/jobs/JobForm';
import { useGetJobQuery, usePublishJobMutation, useUpdateJobMutation } from '../features/jobs/jobsApi';
import { getErrorMessage } from '../lib/format';

const EditJobPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const user = useSelector((state) => state.auth.user);

    const { data, isLoading, isError, error, refetch } = useGetJobQuery(id);
    const [updateJob, { isLoading: updating }] = useUpdateJobMutation();
    const [publishJob, { isLoading: publishing }] = usePublishJobMutation();

    const backButton = (
        <Link to="/client/jobs">
            <Button>Back to my jobs</Button>
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
            return <EmptyState icon="search_off" title="Job not found" action={backButton} />;
        }
        return <ErrorState title="Could not load this job" onRetry={refetch} />;
    }

    const { job } = data;

    // Backend də bunu yoxlayır, burada istifadəçiyə aydın mesaj göstəririk
    if (job.client?.id !== user?.id) {
        return (
            <EmptyState
                icon="lock"
                title="You can only edit your own jobs"
                action={backButton}
            />
        );
    }

    const isDraft = job.status === 'DRAFT';
    if (job.status !== 'OPEN' && !isDraft) {
        return (
            <EmptyState
                icon="lock"
                title="This job can no longer be edited"
                description="Only drafts and open jobs can be edited. Once a contract starts, the job is locked."
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
                toast.success('Job published');
                navigate(`/jobs/${job.id}`, { replace: true });
            } else if (intent === 'draft') {
                toast.success('Draft saved');
                navigate('/client/jobs?tab=DRAFT', { replace: true });
            } else {
                toast.success('Job updated');
                navigate(`/jobs/${job.id}`, { replace: true });
            }
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not save the job'));
        }
    };

    return (
        <>
            <PageHeader
                title={isDraft ? 'Edit draft' : 'Edit job'}
                description={
                    isDraft
                        ? 'Only you can see this draft. Publish it when it is ready.'
                        : 'Changes are visible to freelancers right away.'
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
