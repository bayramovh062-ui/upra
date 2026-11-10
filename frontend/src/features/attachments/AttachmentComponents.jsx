import { useId, useState } from 'react';
import toast from 'react-hot-toast';
import {
  useUploadCommentFilesMutation,
  useUploadDisputeFilesMutation,
  useUploadIssueFilesMutation,
  useUploadMilestoneFilesMutation,
  useUploadReportFilesMutation,
} from './attachmentsApi';
import { Icon } from '../../components/ui';

const pickAccept = {
  MILESTONE_SUBMIT: '.pdf,.doc,.docx,.xls,.xlsx,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp,.gif,.zip,.7z,.rar',
  DISPUTE_EVIDENCE: '.pdf,.doc,.docx,.xls,.xlsx,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp,.gif,.zip,.7z,.rar',
  ISSUE: '.pdf,.doc,.docx,.xls,.xlsx,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp,.gif,.zip,.7z,.rar',
  ISSUE_COMMENT: '.pdf,.doc,.docx,.xls,.xlsx,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp,.gif,.zip,.7z,.rar',
  REPORT_EVIDENCE: '.pdf,.doc,.docx,.xls,.xlsx,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp,.gif,.zip,.7z,.rar',
};

const apiBase = () => (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '');

const attachmentContentUrl = (id) => `${apiBase()}/attachments/${encodeURIComponent(id)}/content`;

const openBlob = (blob, attachment) => {
  const objectUrl = URL.createObjectURL(blob);
  const inline =
    attachment.mimeType === 'application/pdf' ||
    attachment.mimeType?.startsWith('image/') ||
    attachment.mimeType?.startsWith('text/');

  const link = document.createElement('a');
  link.href = objectUrl;
  if (inline) {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  } else {
    link.download = attachment.filename || 'attachment';
  }
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Give the browser time to open/save before releasing the temporary blob URL.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
};

export function AttachmentList({ attachments, compact = false, label }) {
  const [busyId, setBusyId] = useState(null);
  if (!attachments?.length) return null;

  // Files are protected: fetch them with the auth token instead of linking to a raw storage URL.
  const openAttachment = async (attachment) => {
    if (busyId) return;
    setBusyId(attachment.id);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(attachmentContentUrl(attachment.id), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        let message = 'Could not open file';
        try {
          const data = await res.json();
          if (data?.message) message = data.message;
        } catch {
          // not JSON
        }
        throw new Error(message);
      }
      openBlob(await res.blob(), attachment);
    } catch (err) {
      toast.error(err?.message || 'Could not open file');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className={compact ? 'mt-1' : 'mt-2'}>
      {label && <p className="mb-1 text-caption font-semibold text-secondary">{label}</p>}
      <ul className={compact ? 'flex flex-col gap-1' : 'flex flex-wrap gap-2'}>
        {attachments.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => openAttachment(a)}
              disabled={busyId === a.id}
              className="inline-flex max-w-full items-center gap-1 rounded-lg border border-line bg-surface-container-lowest px-2 py-1 text-caption text-primary hover:underline disabled:opacity-60"
              title={a.filename}
            >
              <Icon name={a.mimeType?.startsWith('image/') ? 'image' : 'attach_file'} className="text-[14px] shrink-0" />
              <span className="truncate max-w-[180px]">{busyId === a.id ? 'Opening…' : a.filename}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FilePicker({ purpose, target, contractId, disabled, label = 'Attach files', onUploaded, onFilesChange, files: controlledFiles, showUploadButton = true, compact }) {
  const [internalFiles, setInternalFiles] = useState([]);
  const files = controlledFiles ?? internalFiles;
  const setFiles = onFilesChange ?? setInternalFiles;
  const [uploadMilestone, m1] = useUploadMilestoneFilesMutation();
  const [uploadDispute, m2] = useUploadDisputeFilesMutation();
  const [uploadIssue, m3] = useUploadIssueFilesMutation();
  const [uploadComment, m4] = useUploadCommentFilesMutation();
  const [uploadReport, m5] = useUploadReportFilesMutation();
  const busy = m1.isLoading || m2.isLoading || m3.isLoading || m4.isLoading || m5.isLoading;
  // useId: render zamanı təsadüfi ədəd (Math.random) lazım deyil, SSR/yenidən render zamanı sabit qalır
  const id = useId();

  const upload = async () => {
    if (!files.length) return;
    try {
      if (purpose === 'MILESTONE_SUBMIT') await uploadMilestone({ milestoneId: target.milestoneId, files, contractId }).unwrap();
      else if (purpose === 'DISPUTE_EVIDENCE') await uploadDispute({ disputeId: target.disputeId, files, contractId }).unwrap();
      else if (purpose === 'ISSUE') await uploadIssue({ issueId: target.issueId, files, contractId }).unwrap();
      else if (purpose === 'ISSUE_COMMENT') await uploadComment({ commentId: target.commentId, files, contractId }).unwrap();
      else if (purpose === 'REPORT_EVIDENCE') await uploadReport({ reportId: target.reportId, files }).unwrap();
      else throw new Error('Unsupported upload purpose');
      toast.success('Files uploaded');
      setFiles([]);
      onUploaded?.();
    } catch (e) {
      toast.error(e?.data?.message || e?.message || 'Upload failed');
    }
  };

  return (
    <div className={compact ? 'flex flex-wrap items-center gap-2' : 'flex flex-col gap-2'}>
      <label htmlFor={id} className={`inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-label-md text-on-surface hover:bg-surface-container ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
        <Icon name="attach_file" className="text-[16px]" />
        {label}
      </label>
      <input
        id={id}
        type="file"
        multiple
        accept={pickAccept[purpose]}
        className="hidden"
        disabled={disabled}
        onChange={(e) => setFiles(Array.from(e.target.files || []))}
      />
      {!!files.length && (
        <div className="flex flex-wrap items-center gap-2 text-caption text-secondary">
          <span>{files.length} file(s) selected</span>
          {showUploadButton && <button type="button" className="text-primary hover:underline disabled:opacity-50" onClick={upload} disabled={busy}>{busy ? 'Uploading…' : 'Upload'}</button>}
          <button type="button" className="hover:underline" onClick={() => setFiles([])} disabled={busy}>Clear</button>
        </div>
      )}
    </div>
  );
}
