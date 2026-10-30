import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PageHeader } from '../components/ui';
import JobForm from '../features/jobs/JobForm';
import { useCreateJobMutation } from '../features/jobs/jobsApi';
import { getErrorMessage } from '../lib/format';

const CreateJobPage = () => {
    const navigate = useNavigate();
    const [createJob, { isLoading }] = useCreateJobMutation();

    const onSubmit = async (values) => {
        try {
            const { job } = await createJob(values).unwrap();
            toast.success('Job published');
            navigate(`/jobs/${job.id}`, { replace: true });
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not publish the job'));
        }
    };

    return (
        <>
            <PageHeader
                title="Post a job"
                description="Describe what you need. Freelancers will send you proposals."
            />
            <JobForm
                onSubmit={onSubmit}
                submitting={isLoading}
                submitLabel="Publish job"
                cancelTo="/client/jobs"
            />
        </>
    );
};

export default CreateJobPage;
