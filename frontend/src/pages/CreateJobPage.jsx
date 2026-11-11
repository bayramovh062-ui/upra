import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PageHeader } from '../components/ui';
import JobForm from '../features/jobs/JobForm';
import { useCreateJobMutation } from '../features/jobs/jobsApi';
import { useTranslation } from '../features/locale/useTranslation';
import { getErrorMessage } from '../lib/format';

const CreateJobPage = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [createJob, { isLoading }] = useCreateJobMutation();

    // intent: 'publish' → dərhal OPEN, 'draft' → yalnız client görür
    const onSubmit = async (payload, intent) => {
        const isDraft = intent === 'draft';
        try {
            const { job } = await createJob({ ...payload, status: isDraft ? 'DRAFT' : 'OPEN' }).unwrap();
            if (isDraft) {
                toast.success(t('jobs.create.toastDraftSaved'));
                navigate('/client/jobs?tab=DRAFT', { replace: true });
            } else {
                toast.success(t('jobs.create.toastPublished'));
                navigate(`/jobs/${job.id}`, { replace: true });
            }
        } catch (err) {
            toast.error(
                getErrorMessage(err, isDraft ? t('jobs.create.errorDraft') : t('jobs.create.errorPublish'))
            );
        }
    };

    return (
        <>
            <PageHeader title={t('jobs.create.title')} description={t('jobs.create.description')} />
            <JobForm mode="create" onSubmit={onSubmit} submitting={isLoading} cancelTo="/client/jobs" />
        </>
    );
};

export default CreateJobPage;
