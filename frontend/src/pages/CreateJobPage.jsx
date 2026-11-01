import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PageHeader } from '../components/ui';
import JobForm from '../features/jobs/JobForm';
import { useCreateJobMutation } from '../features/jobs/jobsApi';
import { getErrorMessage } from '../lib/format';

const CreateJobPage = () => {
    const navigate = useNavigate();
    const [createJob, { isLoading }] = useCreateJobMutation();

    // intent: 'publish' → dərhal OPEN, 'draft' → yalnız client görür
    const onSubmit = async (payload, intent) => {
        const isDraft = intent === 'draft';
        try {
            const { job } = await createJob({ ...payload, status: isDraft ? 'DRAFT' : 'OPEN' }).unwrap();
            if (isDraft) {
                toast.success('Draft saved');
                navigate('/client/jobs?tab=DRAFT', { replace: true });
            } else {
                toast.success('Job published');
                navigate(`/jobs/${job.id}`, { replace: true });
            }
        } catch (err) {
            toast.error(getErrorMessage(err, isDraft ? 'Could not save the draft' : 'Could not publish the job'));
        }
    };

    return (
        <>
            <PageHeader
                title="Post a job"
                description="Describe what you need in three quick steps. Freelancers will send you proposals."
            />
            <JobForm mode="create" onSubmit={onSubmit} submitting={isLoading} cancelTo="/client/jobs" />
        </>
    );
};

export default CreateJobPage;
