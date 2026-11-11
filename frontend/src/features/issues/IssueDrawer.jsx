import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import toast from 'react-hot-toast';
import {
    Avatar,
    Button,
    ConfirmDialog,
    Drawer,
    Icon,
    Input,
    Select,
    StatusBadge,
    Textarea,
} from '../../components/ui';
import { useTranslation } from '../locale/useTranslation';
import { getErrorMessage, timeAgo } from '../../lib/format';
import { createCommentSchema, createIssueSchema } from '../../validations/issueSchema';
import { assigneeOptions, priorityOptions } from './issueOptions';
import { useAddCommentMutation, useDeleteIssueMutation, useUpdateIssueMutation } from './issuesApi';
import { useUploadCommentFilesMutation } from '../attachments/attachmentsApi';
import { AttachmentList, FilePicker } from '../attachments/AttachmentComponents';

const IssueDetails = ({ issue, contract, readOnly, onDeleted }) => {
    const { t } = useTranslation();
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [commentFiles, setCommentFiles] = useState([]);
    const [deleteIssue, { isLoading: deleting }] = useDeleteIssueMutation();
    const [updateIssue, { isLoading: saving }] = useUpdateIssueMutation();
    const [addComment, { isLoading: commenting }] = useAddCommentMutation();
    const [uploadCommentFiles, { isLoading: uploadingCommentFiles }] = useUploadCommentFilesMutation();

    const form = useForm({
        resolver: zodResolver(createIssueSchema(t)),
        defaultValues: {
            title: issue.title,
            description: issue.description ?? '',
            priority: issue.priority,
            assigneeId: issue.assigneeId ?? issue.assignee?.id ?? '',
        },
    });
    const commentForm = useForm({
        resolver: zodResolver(createCommentSchema(t)),
        defaultValues: { body: '' },
    });

    const onSave = async (values) => {
        try {
            await updateIssue({
                id: issue.id,
                contractId: contract.id,
                title: values.title,
                description: values.description ?? '',
                priority: values.priority,
                assigneeId: values.assigneeId || null,
            }).unwrap();
            toast.success(t('issues.toasts.updated'));
            form.reset(values);
        } catch (err) {
            toast.error(getErrorMessage(err, t('issues.toasts.updateError')));
        }
    };

    const onComment = async ({ body }) => {
        try {
            const res = await addComment({ id: issue.id, contractId: contract.id, body }).unwrap();
            const commentId = res?.comment?.id;
            if (commentFiles.length && commentId) {
                try {
                    await uploadCommentFiles({ commentId, files: commentFiles, contractId: contract.id }).unwrap();
                } catch (uploadErr) {
                    toast.error(getErrorMessage(uploadErr, t('issues.toasts.commentUploadFailed')));
                }
            }
            setCommentFiles([]);
            commentForm.reset({ body: '' });
        } catch (err) {
            toast.error(getErrorMessage(err, t('issues.toasts.commentError')));
        }
    };

    const handleDelete = async () => {
        try {
            await deleteIssue({ id: issue.id, contractId: contract.id }).unwrap();
            toast.success(t('issues.toasts.deleted'));
            setConfirmOpen(false);
            onDeleted();
        } catch (err) {
            toast.error(getErrorMessage(err, t('issues.toasts.deleteError')));
        }
    };

    const comments = issue.comments ?? [];

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-2 text-label-sm text-secondary">
                <StatusBadge status={issue.status} />
                <span>{t(`common.status.${issue.status}`)}</span>
                <span>
                    · {t('issues.details.createdBy', {
                        name: issue.createdBy?.fullName,
                        time: timeAgo(issue.createdAt),
                    })}
                </span>
            </div>

            <form onSubmit={form.handleSubmit(onSave)} noValidate className="flex flex-col gap-4">
                <fieldset disabled={readOnly} className="flex flex-col gap-4">
                    <Input
                        label={t('issues.form.title')}
                        error={form.formState.errors.title?.message}
                        {...form.register('title')}
                    />
                    <Textarea
                        rows={5}
                        placeholder={t('issues.form.descriptionPlaceholder')}
                        error={form.formState.errors.description?.message}
                        {...form.register('description')}
                    />
                    <div className="grid grid-cols-2 gap-3">
                        <Select label={t('issues.form.priority')} options={priorityOptions()} {...form.register('priority')} />
                        <Select
                            label={t('issues.form.assignee')}
                            placeholder={t('issues.form.unassigned')}
                            options={assigneeOptions(contract)}
                            {...form.register('assigneeId')}
                        />
                    </div>
                </fieldset>
                {!readOnly && (
                    <div className="flex justify-end">
                        <Button type="submit" loading={saving} disabled={!form.formState.isDirty}>
                            {t('issues.form.save')}
                        </Button>
                    </div>
                )}
            </form>

            {!readOnly && (
                <div className="rounded-xl border border-dashed border-line p-3">
                    <p className="mb-2 text-label-md text-secondary">{t('issues.attachments.title')}</p>
                    <AttachmentList attachments={issue.attachments} />
                    <div className="mt-2">
                        <FilePicker
                            purpose="ISSUE"
                            target={{ issueId: issue.id }}
                            contractId={contract.id}
                            label={t('issues.attachments.upload')}
                        />
                    </div>
                </div>
            )}
            {readOnly && <AttachmentList attachments={issue.attachments} />}

            <div>
                <h3 className="mb-3 text-title-md text-on-surface">
                    {t('issues.comments.title', { count: comments.length })}
                </h3>
                <div className="flex flex-col gap-3">
                    {comments.length === 0 && (
                        <p className="text-body-md text-secondary">{t('issues.comments.empty')}</p>
                    )}
                    {comments.map((c) => (
                        <div key={c.id} className="flex gap-3">
                            <Avatar name={c.author?.fullName} size="sm" />
                            <div className="min-w-0 flex-1 rounded-xl bg-surface-container-low px-3 py-2">
                                <p className="text-label-sm text-on-surface">
                                    <span className="font-semibold">{c.author?.fullName}</span>
                                    <span className="ml-2 text-secondary">{timeAgo(c.createdAt)}</span>
                                </p>
                                <p className="mt-0.5 whitespace-pre-line break-words text-body-md text-on-surface">
                                    {c.body}
                                </p>
                                <AttachmentList attachments={c.attachments} compact />
                            </div>
                        </div>
                    ))}
                </div>

                {!readOnly && (
                    <form onSubmit={commentForm.handleSubmit(onComment)} noValidate className="mt-4 flex flex-col gap-2">
                        <Textarea
                            rows={3}
                            placeholder={t('issues.comments.placeholder')}
                            error={commentForm.formState.errors.body?.message}
                            {...commentForm.register('body')}
                        />
                        <FilePicker
                            purpose="ISSUE_COMMENT"
                            target={{}}
                            contractId={contract.id}
                            files={commentFiles}
                            onFilesChange={setCommentFiles}
                            showUploadButton={false}
                            label={t('issues.comments.attach')}
                            compact
                        />
                        <div className="flex items-center justify-end gap-2">
                            <Button type="submit" size="sm" loading={commenting || uploadingCommentFiles}>
                                {t('issues.comments.submit')}
                            </Button>
                        </div>
                    </form>
                )}
            </div>

            {!readOnly && (
                <div className="border-t border-line pt-4">
                    <Button
                        variant="ghost"
                        className="text-error hover:bg-error-container"
                        onClick={() => setConfirmOpen(true)}
                    >
                        <Icon name="delete_outline" className="text-[18px]" />
                        {t('issues.delete.button')}
                    </Button>
                </div>
            )}

            <ConfirmDialog
                open={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                onConfirm={handleDelete}
                loading={deleting}
                variant="danger"
                title={t('issues.delete.title')}
                message={t('issues.delete.message')}
                confirmText={t('issues.delete.confirm')}
            />
        </div>
    );
};

// issue: siyahıdan canlı götürülür; yenilənəndə key ilə forma sıfırlanır
const IssueDrawer = ({ issue, contract, readOnly, onClose }) => {
    const { t } = useTranslation();
    return (
        <Drawer open={!!issue} onClose={onClose} title={t('issues.details.title')}>
            {issue && (
                <IssueDetails key={issue.id} issue={issue} contract={contract} readOnly={readOnly} onDeleted={onClose} />
            )}
        </Drawer>
    );
};

export default IssueDrawer;
