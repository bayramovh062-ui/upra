import { useMemo, useState } from 'react';
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

const apiOrigin = () => {
  const base = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  try { return new URL(base, window.location.origin).origin; } catch { return window.location.origin; }
};
export const resolveFileUrl = (u) => (u?.startsWith('/') ? `${apiOrigin()}${u}` : u);

export function AttachmentList({ attachments, compact = false, label }) {
  if (!attachments?.length) return null;
  return (
    <div className={compact ? 'mt-1' : 'mt-2'}>
      {label && <p className="mb-1 text-caption font-semibold text-secondary">{label}</p>}
      <ul className={compact ? 'flex flex-col gap-1' : 'flex flex-wrap gap-2'}>
        {attachments.map((a) => (
          <li key={a.id}>
            <a
              href={resolveFileUrl(a.url)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex max-w-full items-center gap-1 rounded-lg border border-line bg-surface-container-lowest px-2 py-1 text-caption text-primary hover:underline"
              title={a.filename}
            >
              <Icon name={a.mimeType?.startsWith('image/') ? 'image' : 'attach_file'} className="text-[14px] shrink-0" />
              <span className="truncate max-w-[180px]">{a.filename}</span>
            </a>
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
  const id = useMemo(() => `fp-${Math.random().toString(36).slice(2)}`, []);

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
