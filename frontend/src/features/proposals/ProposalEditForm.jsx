import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { Button, Input, Textarea } from '../../components/ui';
import { getErrorMessage } from '../../lib/format';
import { createProposalSchema } from '../../validations/proposalSchema';
import { useTranslation } from '../locale/useTranslation';
import { useUpdateProposalMutation } from './proposalsApi';

// PENDING təklifi redaktə etmək üçün (elan detalındakı kartda açılır)
const ProposalEditForm = ({ proposal, jobPostId, onDone }) => {
    const { t } = useTranslation();
    const [updateProposal, { isLoading }] = useUpdateProposalMutation();
    const schema = useMemo(() => createProposalSchema(t), [t]);
    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(schema),
        defaultValues: { bidAmount: Number(proposal.bidAmount), coverLetter: proposal.coverLetter },
    });

    const onSubmit = async (values) => {
        try {
            await updateProposal({ id: proposal.id, jobPostId, ...values }).unwrap();
            toast.success(t('proposals.edit.updated'));
            onDone();
        } catch (err) {
            toast.error(getErrorMessage(err, t('proposals.edit.errorUpdate')));
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            <h3 className="text-headline-sm text-on-surface">{t('proposals.edit.title')}</h3>
            <Input
                label={t('proposals.edit.bid')}
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
                    {t('proposals.edit.cancel')}
                </Button>
                <Button type="submit" loading={isLoading} className="flex-1">
                    {t('proposals.edit.save')}
                </Button>
            </div>
        </form>
    );
};

export default ProposalEditForm;
