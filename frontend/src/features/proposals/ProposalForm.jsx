import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { Button, Icon, Input, Textarea } from '../../components/ui';
import { formatMoney, getErrorMessage } from '../../lib/format';
import { proposalSchema } from '../../validations/proposalSchema';
import { useCreateProposalMutation } from './proposalsApi';

// Elan detalındakı "Submit a proposal" kartı (Stitch dizaynı).
// Uğurlu göndərişdən sonra getJob yenidən çəkilir və kart avtomatik "Proposal submitted" görünüşünə keçir.
const ProposalForm = ({ job }) => {
    const [createProposal, { isLoading }] = useCreateProposalMutation();

    const {
        register,
        handleSubmit,
        watch,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(proposalSchema),
        defaultValues: { bidAmount: undefined, coverLetter: '' },
    });

    const coverLetter = watch('coverLetter') ?? '';

    const onSubmit = async (values) => {
        try {
            await createProposal({ jobPostId: job.id, ...values }).unwrap();
            toast.success('Proposal sent');
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not send the proposal'));
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-headline-sm text-on-surface">Submit a proposal</h3>
                    <p className="text-caption text-secondary">One proposal per job</p>
                </div>
                <Icon name="post_add" className="text-[28px] text-primary-container" />
            </div>

            <Input
                label={`Your bid (USD) · client budget ${formatMoney(job.budget)}`}
                type="number"
                inputMode="decimal"
                step="0.01"
                min="1"
                icon="attach_money"
                placeholder="0.00"
                error={errors.bidAmount?.message}
                {...register('bidAmount', { valueAsNumber: true })}
            />

            <div>
                <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-label-md text-on-surface">Cover letter</span>
                    <span className="tabular text-caption text-secondary">{coverLetter.length} / 2000</span>
                </div>
                <Textarea
                    rows={6}
                    maxLength={2000}
                    placeholder="Explain why you are a good fit and how you would approach this job..."
                    error={errors.coverLetter?.message}
                    {...register('coverLetter')}
                />
            </div>

            <Button type="submit" size="lg" loading={isLoading} className="w-full">
                Send proposal
                {!isLoading && <Icon name="arrow_forward" className="text-[18px]" />}
            </Button>
        </form>
    );
};

export default ProposalForm;
