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
import { getErrorMessage, timeAgo } from '../../lib/format';
import { commentSchema, issueSchema } from '../../validations/issueSchema';
import { assigneeOptions, PRIORITY_OPTIONS } from './IssueFormModal';
import { useAddCommentMutation, useDeleteIssueMutation, useUpdateIssueMutation } from './issuesApi';
import { useUploadCommentFilesMutation } from '../attachments/attachmentsApi';
import { AttachmentList, FilePicker } from '../attachments/AttachmentComponents';

const STATUS_LABEL = { TODO: 'To do', IN_PROGRESS: 'In progress', DONE: 'Done' };

const IssueDetails = ({ issue, contract, readOnly, onDeleted }) => {
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [commentFiles, setCommentFiles] = useState([]);
    const [deleteIssue, { isLoading: deleting }] = useDeleteIssueMutation();
    const [updateIssue, { isLoading: saving }] = useUpdateIssueMutation();
    const [addComment, { isLoading: commenting }] = useAddCommentMutation();
    const [uploadCommentFiles, { isLoading: uploadingCommentFiles }] = useUploadCommentFilesMutation();

    const form = useForm({
        resolver: zodResolver(issueSchema),
        defaultValues: {
            title: issue.title,
            description: issue.description ?? '',
            priority: issue.priority,
            assigneeId: issue.assigneeId ?? issue.assignee?.id ?? '',
        },
    });
    const commentForm = useForm({ resolver: zodResolver(commentSchema), defaultValues: { body: '' } });

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
            toast.success('Issue updated');
            form.reset(values);
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not update the issue'));
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
                    toast.error(getErrorMessage(uploadErr, 'Comment posted, but file upload failed'));
                }
            }
            setCommentFiles([]);
            commentForm.reset({ body: '' });
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not add the comment'));
        }
    };

    const handleDelete = async () => {
        try {
            await deleteIssue({ id: issue.id, contractId: contract.id }).unwrap();
            toast.success('Issue deleted');
            setConfirmOpen(false);
            onDeleted();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not delete the issue'));
        }
    };

    const comments = issue.comments ?? [];

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-2 text-label-sm text-secondary">
                <StatusBadge status={issue.status} />
                <span>{STATUS_LABEL[issue.status]}</span>
                <span>· Created by {issue.createdBy?.fullName} {timeAgo(issue.createdAt)}</span>
            </div>

            <form onSubmit={form.handleSubmit(onSave)} noValidate className="flex flex-col gap-4">
                <fieldset disabled={readOnly} className="flex flex-col gap-4">
                    <Input label="Title" error={form.formState.errors.title?.message} {...form.register('title')} />
                    <Textarea
                        rows={5}
                        placeholder="No description"
                        error={form.formState.errors.description?.message}
                        {...form.register('description')}
                    />
                    <div className="grid grid-cols-2 gap-3">
                        <Select label="Priority" options={PRIORITY_OPTIONS} {...form.register('priority')} />
                        <Select
                            label="Assignee"
                            placeholder="Unassigned"
                            options={assigneeOptions(contract)}
                            {...form.register('assigneeId')}
                        />
                    </div>
                </fieldset>
                {!readOnly && (
                    <div className="flex justify-end">
                        <Button type="submit" loading={saving} disabled={!form.formState.isDirty}>
                            Save changes
                        </Button>
                    </div>
                )}
            </form>

            {!readOnly && (
                <div className="rounded-xl border border-dashed border-line p-3">
                    <p className="mb-2 text-label-md text-secondary">Attachments</p>
                    <AttachmentList attachments={issue.attachments} />
                    <div className="mt-2">
                        <FilePicker purpose="ISSUE" target={{ issueId: issue.id }} contractId={contract.id} label="Upload issue files" />
                    </div>
                </div>
            )}
            {readOnly && <AttachmentList attachments={issue.attachments} />}

            <div>
                <h3 className="mb-3 text-title-md text-on-surface">Comments ({comments.length})</h3>
                <div className="flex flex-col gap-3">
                    {comments.length === 0 && <p className="text-body-md text-secondary">No comments yet.</p>}
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
                            placeholder="Write a comment..."
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
                            label="Attach to comment"
                            compact
                        />
                        <div className="flex items-center justify-end gap-2">
                            <Button type="submit" size="sm" loading={commenting || uploadingCommentFiles}>
                                Comment
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
                        Delete issue
                    </Button>
                </div>
            )}

            <ConfirmDialog
                open={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                onConfirm={handleDelete}
                loading={deleting}
                variant="danger"
                title="Delete this issue?"
                message="The issue and its comments will be removed for both sides. This cannot be undone."
                confirmText="Delete"
            />
        </div>
    );
};

// issue: siyahıdan canlı götürülür; yenilənəndə key ilə forma sıfırlanır
const IssueDrawer = ({ issue, contract, readOnly, onClose }) => (
    <Drawer open={!!issue} onClose={onClose} title="Issue details">
        {issue && (
            <IssueDetails key={issue.id} issue={issue} contract={contract} readOnly={readOnly} onDeleted={onClose} />
        )}
    </Drawer>
);

export default IssueDrawer;
