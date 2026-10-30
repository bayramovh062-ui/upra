import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { Button, Input, Textarea } from '../../components/ui';
import { getErrorMessage } from '../../lib/format';
import { proposalSchema } from '../../validations/proposalSchema';
import { useUpdateProposalMutation } from './proposalsApi';

// PENDING təklifi redaktə etmək üçün (elan detalındakı kartda açılır)
const ProposalEditForm = ({ proposal, jobPostId, onDone }) => {
    const [updateProposal, { isLoading }] = useUpdateProposalMutation();
    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(proposalSchema),
        defaultValues: { bidAmount: Number(proposal.bidAmount), coverLetter: proposal.coverLetter },
    });

    const onSubmit = async (values) => {
        try {
            await updateProposal({ id: proposal.id, jobPostId, ...values }).unwrap();
            toast.success('Proposal updated');
            onDone();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not update the proposal'));
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            <h3 className="text-headline-sm text-on-surface">Edit proposal</h3>
            <Input
                label="Your bid (USD)"
                type="number"
                step="0.01"
                min="1"
                icon="attach_money"
                error={errors.bidAmount?.message}
                {...register('bidAmount', { valueAsNumber: true })}
            />
            <Textarea
                rows={6}
                maxLength={2000}
                error={errors.coverLetter?.message}
                {...register('coverLetter')}
            />
            <div className="flex gap-2">
                <Button type="button" variant="secondary" className="flex-1" onClick={onDone}>
                    Cancel
                </Button>
                <Button type="submit" loading={isLoading} className="flex-1">
                    Save
                </Button>
            </div>
        </form>
    );
};

export default ProposalEditForm;
