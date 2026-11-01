import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { Button, Input, Modal, Select, Textarea } from '../../components/ui';
import { getErrorMessage } from '../../lib/format';
import { issueSchema } from '../../validations/issueSchema';
import { useCreateIssueMutation } from './issuesApi';

export const PRIORITY_OPTIONS = [
    { value: 'LOW', label: 'Low' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'HIGH', label: 'High' },
];

export const assigneeOptions = (contract) =>
    [contract.client, contract.freelancer].filter(Boolean).map((u) => ({ value: u.id, label: u.fullName }));

// Yeni tapşırıq (həmişə TODO sütununun sonuna düşür, bunu backend edir)
const IssueFormModal = ({ open, onClose, contract }) => {
    const [createIssue, { isLoading }] = useCreateIssueMutation();
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(issueSchema),
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
            toast.success('Issue created');
            onClose();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not create the issue'));
        }
    };

    return (
        <Modal open={open} onClose={onClose} title="Create issue" className="max-w-lg">
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
                <Input
                    label="Title"
                    placeholder="What needs to be done?"
                    error={errors.title?.message}
                    {...register('title')}
                />
                <Textarea
                    rows={4}
                    placeholder="Add details (optional)"
                    error={errors.description?.message}
                    {...register('description')}
                />
                <div className="grid grid-cols-2 gap-3">
                    <Select label="Priority" options={PRIORITY_OPTIONS} {...register('priority')} />
                    <Select
                        label="Assignee"
                        placeholder="Unassigned"
                        options={assigneeOptions(contract)}
                        {...register('assigneeId')}
                    />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                    <Button type="button" variant="secondary" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" loading={isLoading}>
                        Create issue
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

export default IssueFormModal;
