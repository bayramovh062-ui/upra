import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { Button, EmptyState, ErrorState, PageHeader, Skeleton } from '../components/ui';
import JobForm from '../features/jobs/JobForm';
import { useGetJobQuery, useUpdateJobMutation } from '../features/jobs/jobsApi';
import { getErrorMessage } from '../lib/format';

const EditJobPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const user = useSelector((state) => state.auth.user);

    const { data, isLoading, isError, error, refetch } = useGetJobQuery(id);
    const [updateJob, { isLoading: saving }] = useUpdateJobMutation();

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
    if (job.status !== 'OPEN') {
        return (
            <EmptyState
                icon="lock"
                title="This job can no longer be edited"
                description="Only open jobs can be edited. Once a contract starts, the job is locked."
                action={backButton}
            />
        );
    }

    const onSubmit = async (values) => {
        try {
            await updateJob({ id: job.id, ...values }).unwrap();
            toast.success('Job updated');
            navigate(`/jobs/${job.id}`, { replace: true });
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not update the job'));
        }
    };

    return (
        <>
            <PageHeader title="Edit job" description="Changes are visible to freelancers right away." />
            <JobForm
                // Prisma Decimal string qayıdır ("500.00"), formada rəqəm lazımdır
                defaultValues={{
                    title: job.title,
                    description: job.description,
                    budget: Number(job.budget),
                }}
                onSubmit={onSubmit}
                submitting={saving}
                submitLabel="Save changes"
                cancelTo={`/jobs/${job.id}`}
            />
        </>
    );
};

export default EditJobPage;
