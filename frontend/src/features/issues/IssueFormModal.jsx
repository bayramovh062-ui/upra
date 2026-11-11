import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { Button, Input, Modal, Select, Textarea } from '../../components/ui';
import { useTranslation } from '../locale/useTranslation';
import { getErrorMessage } from '../../lib/format';
import { createIssueSchema } from '../../validations/issueSchema';
import { useCreateIssueMutation } from './issuesApi';
import { assigneeOptions, priorityOptions } from './issueOptions';

// Yeni tapşırıq (həmişə TODO sütununun sonuna düşür, bunu backend edir)
const IssueFormModal = ({ open, onClose, contract }) => {
    const { t } = useTranslation();
    const [createIssue, { isLoading }] = useCreateIssueMutation();
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(createIssueSchema(t)),
        defaultValues: { title: '', description: '', priority: 'MEDIUM', assigneeId: '' },
    });

    useEffect(() => {
        if (open) reset({ title: '', description: '', priority: 'MEDIUM', assigneeId: '' });
    }, [open, reset]);

    const onSubmit = async (values) => {
        const body = { contractId: contract.id, title: values.title, priority: values.priority };
        if (values.description) body.description = values.description;
        if (values.assigneeId) body.assigneeId = values.assigneeId;
        try {
            await createIssue(body).unwrap();
            toast.success(t('issues.toasts.created'));
            onClose();
        } catch (err) {
            toast.error(getErrorMessage(err, t('issues.toasts.createError')));
        }
    };

    return (
        <Modal open={open} onClose={onClose} title={t('issues.create.title')} className="max-w-lg">
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
                <Input
                    label={t('issues.create.titleLabel')}
                    placeholder={t('issues.create.titlePlaceholder')}
                    error={errors.title?.message}
                    {...register('title')}
                />
                <Textarea
                    rows={4}
                    placeholder={t('issues.create.descriptionPlaceholder')}
                    error={errors.description?.message}
                    {...register('description')}
                />
                <div className="grid grid-cols-2 gap-3">
                    <Select label={t('issues.form.priority')} options={priorityOptions()} {...register('priority')} />
                    <Select
                        label={t('issues.form.assignee')}
                        placeholder={t('issues.form.unassigned')}
                        options={assigneeOptions(contract)}
                        {...register('assigneeId')}
                    />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                    <Button type="button" variant="secondary" onClick={onClose}>
                        {t('common.actions.cancel')}
                    </Button>
                    <Button type="submit" loading={isLoading}>
                        {t('issues.create.submit')}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

export default IssueFormModal;
