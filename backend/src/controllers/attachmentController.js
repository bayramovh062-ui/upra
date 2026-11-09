import fs from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import prisma from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import {
  getLocalPath,
  localKeyFromUrl,
  storeFile,
  toAttachmentRecord,
  UPLOAD_LIMITS,
} from '../services/uploadService.js';
import {
  ATTACHMENT_SELECT,
  assertAttachmentAccess,
  assertCanAttachToComment,
  assertCanAttachToDispute,
  assertCanAttachToIssue,
  assertCanAttachToMilestoneSubmission,
  assertCanAttachToReport,
  findAttachment,
  findAttachmentWithFile,
} from '../services/attachmentService.js';

const saveMany = async (files, purpose, uploadedById, links) => {
  const limit = UPLOAD_LIMITS[purpose];
  if (!files?.length) throw new AppError('At least one file is required', 400);
  if (files.length > limit.maxFiles) throw new AppError(`Too many files (max ${limit.maxFiles})`, 400);
  const rows = [];
  for (const file of files) {
    const stored = await storeFile(file, { purpose });
    rows.push(toAttachmentRecord(file, stored, { purpose, uploadedById, links }));
  }
  return prisma.$transaction(rows.map((data) => prisma.attachment.create({ data, select: ATTACHMENT_SELECT })));
};

export const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('Avatar file is required', 400);
  const stored = await storeFile(req.file, { purpose: 'AVATAR' });
  // Return an absolute URL so the frontend can render it reliably in dev (Vite origin) and prod.
  const origin = `${req.protocol}://${req.get('host')}`;
  const avatarUrl = stored.url.startsWith('http') ? stored.url : `${origin}${stored.url}`;
  const [attachment] = await prisma.$transaction([
    prisma.attachment.create({
      data: toAttachmentRecord(req.file, stored, { purpose: 'AVATAR', uploadedById: req.user.id, links: { userId: req.user.id } }),
      select: ATTACHMENT_SELECT,
    }),
    prisma.user.update({ where: { id: req.user.id }, data: { avatarUrl }, select: { id: true } }),
  ]);
  res.status(201).json({ success: true, attachment, avatarUrl });
});

export const uploadMilestoneFiles = asyncHandler(async (req, res) => {
  const milestone = await assertCanAttachToMilestoneSubmission(req.params.id, req.user);
  const attachments = await saveMany(req.files || (req.file ? [req.file] : []), 'MILESTONE_SUBMIT', req.user.id, {
    contractId: milestone.contractId,
    milestoneId: milestone.id,
  });
  res.status(201).json({ success: true, attachments });
});

export const uploadDisputeFiles = asyncHandler(async (req, res) => {
  const dispute = await assertCanAttachToDispute(req.params.id, req.user);
  const attachments = await saveMany(req.files || (req.file ? [req.file] : []), 'DISPUTE_EVIDENCE', req.user.id, {
    contractId: dispute.contractId,
    milestoneId: dispute.milestoneId,
    disputeId: dispute.id,
  });
  res.status(201).json({ success: true, attachments });
});

export const uploadIssueFiles = asyncHandler(async (req, res) => {
  const { issue, contract } = await assertCanAttachToIssue(req.params.id, req.user);
  const attachments = await saveMany(req.files || (req.file ? [req.file] : []), 'ISSUE', req.user.id, {
    contractId: contract.id,
    issueId: issue.id,
  });
  res.status(201).json({ success: true, attachments });
});

export const uploadCommentFiles = asyncHandler(async (req, res) => {
  const { comment, contract } = await assertCanAttachToComment(req.params.id, req.user);
  const attachments = await saveMany(req.files || (req.file ? [req.file] : []), 'ISSUE_COMMENT', req.user.id, {
    contractId: contract.id,
    issueId: comment.issueId,
    issueCommentId: comment.id,
  });
  res.status(201).json({ success: true, attachments });
});

export const uploadReportFiles = asyncHandler(async (req, res) => {
  const report = await assertCanAttachToReport(req.params.id, req.user);
  const attachments = await saveMany(req.files || (req.file ? [req.file] : []), 'REPORT_EVIDENCE', req.user.id, {
    reportId: report.id,
  });
  res.status(201).json({ success: true, attachments });
});

export const getAttachment = asyncHandler(async (req, res) => {
  const attachment = await findAttachment(req.params.id);
  await assertAttachmentAccess(attachment, req.user);
  res.status(200).json({ success: true, attachment });
});

const headerFilename = (name) => String(name || 'attachment').replace(/[^\w.\- ]+/g, '_').slice(0, 120) || 'attachment';

const contentDisposition = (attachment) => {
  const fallback = headerFilename(attachment.filename);
  const encoded = encodeURIComponent(attachment.filename || 'attachment').replace(/'/g, '%27');
  return `inline; filename="${fallback}"; filename*=UTF-8''${encoded}`;
};

const sendStream = async (res, stream) => {
  try {
    await pipeline(stream, res);
  } catch (err) {
    // The response may already be partially streamed (client disconnected, upstream error).
    if (!res.headersSent) throw err;
    res.destroy(err);
  }
};

// Protected file content. Authorization is checked before any bytes are read/forwarded, and the raw
// storage URL (local path or Cloudinary CDN URL) is never returned to the client.
export const getAttachmentContent = asyncHandler(async (req, res) => {
  const attachment = await findAttachmentWithFile(req.params.id);
  await assertAttachmentAccess(attachment, req.user);

  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', contentDisposition(attachment));

  if (attachment.provider === 'local') {
    const key = localKeyFromUrl(attachment.url);
    if (!key) throw new AppError('Attachment file is unavailable', 404);
    const filePath = getLocalPath(key);
    if (!fs.existsSync(filePath)) throw new AppError('Attachment file is unavailable', 404);
    res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
    return sendStream(res, fs.createReadStream(filePath));
  }

  if (!/^https?:\/\//i.test(attachment.url || '')) {
    throw new AppError('Attachment storage is not configured correctly', 502);
  }

  let upstream;
  try {
    upstream = await fetch(attachment.url, { redirect: 'follow' });
  } catch {
    throw new AppError('Attachment storage is unreachable', 502);
  }
  if (!upstream.ok || !upstream.body) {
    throw new AppError('Attachment file is unavailable', 502);
  }

  res.setHeader('Content-Type', attachment.mimeType || upstream.headers.get('content-type') || 'application/octet-stream');
  return sendStream(res, Readable.fromWeb(upstream.body));
});
