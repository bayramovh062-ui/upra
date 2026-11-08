import prisma from '../config/db.js';
import { AppError } from '../utils/AppError.js';

export const ATTACHMENT_SELECT = {
  id: true,
  purpose: true,
  url: true,
  filename: true,
  mimeType: true,
  size: true,
  provider: true,
  uploadedById: true,
  contractId: true,
  milestoneId: true,
  submissionId: true,
  disputeId: true,
  issueId: true,
  issueCommentId: true,
  reportId: true,
  userId: true,
  createdAt: true,
};

export const findAttachment = async (id) => {
  const attachment = await prisma.attachment.findUnique({ where: { id }, select: { ...ATTACHMENT_SELECT } });
  if (!attachment) throw new AppError('Attachment not found', 404);
  return attachment;
};

const isContractParty = async (contractId, userId) => {
  const c = await prisma.contract.findUnique({ where: { id: contractId }, select: { clientId: true, freelancerId: true } });
  return !!c && (c.clientId === userId || c.freelancerId === userId);
};

export const assertAttachmentAccess = async (attachment, user) => {
  if (!user) throw new AppError('Unauthorized', 401);
  if (user.role === 'ADMIN') return true;
  if (attachment.uploadedById === user.id) return true;

  switch (attachment.purpose) {
    case 'AVATAR':
      return true; // public profile image metadata/URL; file served by URL
    case 'MILESTONE_SUBMIT':
    case 'ISSUE':
    case 'ISSUE_COMMENT':
      if (attachment.contractId && (await isContractParty(attachment.contractId, user.id))) return true;
      break;
    case 'DISPUTE_EVIDENCE':
      if (attachment.contractId && (await isContractParty(attachment.contractId, user.id))) return true;
      break;
    case 'REPORT_EVIDENCE': {
      if (!attachment.reportId) break;
      const r = await prisma.report.findUnique({ where: { id: attachment.reportId }, select: { reporterId: true } });
      if (r?.reporterId === user.id) return true;
      break;
    }
    default:
      break;
  }
  throw new AppError('You do not have access to this attachment', 403);
};

export const assertCanAttachToMilestoneSubmission = async (milestoneId, user) => {
  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    include: { contract: { select: { id: true, clientId: true, freelancerId: true, status: true } } },
  });
  if (!milestone) throw new AppError('Milestone not found', 404);
  if (milestone.contract.freelancerId !== user.id) throw new AppError('Only the freelancer can upload submission files', 403);
  if (!['ACTIVE', 'DELIVERED'].includes(milestone.contract.status)) throw new AppError('Contract is not active', 400);
  if (!['FUNDED', 'IN_REVIEW'].includes(milestone.status)) throw new AppError('Only a funded or in-review milestone can receive delivery files', 409);
  return milestone;
};

export const assertCanAttachToDispute = async (disputeId, user) => {
  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: { contract: { select: { id: true, clientId: true, freelancerId: true } } },
  });
  if (!dispute) throw new AppError('Dispute not found', 404);
  if (dispute.contract.clientId !== user.id && dispute.contract.freelancerId !== user.id) throw new AppError('Only contract parties can upload dispute evidence', 403);
  if (dispute.status !== 'OPEN') throw new AppError('Only an open dispute accepts evidence', 409);
  return dispute;
};

export const assertCanAttachToIssue = async (issueId, user) => {
  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    include: { board: { include: { contract: { select: { id: true, clientId: true, freelancerId: true, status: true } } } } },
  });
  if (!issue) throw new AppError('Issue not found', 404);
  const c = issue.board?.contract;
  if (!c || (c.clientId !== user.id && c.freelancerId !== user.id)) throw new AppError('Only contract parties can upload issue files', 403);
  if (c.status !== 'ACTIVE') throw new AppError('Contract is not active', 400);
  return { issue, contract: c };
};

export const assertCanAttachToComment = async (commentId, user) => {
  const comment = await prisma.issueComment.findUnique({
    where: { id: commentId },
    include: { issue: { include: { board: { include: { contract: { select: { id: true, clientId: true, freelancerId: true, status: true } } } } } } },
  });
  if (!comment) throw new AppError('Comment not found', 404);
  const c = comment.issue?.board?.contract;
  if (!c || (c.clientId !== user.id && c.freelancerId !== user.id)) throw new AppError('Only contract parties can upload comment files', 403);
  if (c.status !== 'ACTIVE') throw new AppError('Contract is not active', 400);
  return { comment, contract: c };
};

export const assertCanAttachToReport = async (reportId, user) => {
  const report = await prisma.report.findUnique({ where: { id: reportId }, select: { id: true, reporterId: true, status: true } });
  if (!report) throw new AppError('Report not found', 404);
  if (report.reporterId !== user.id) throw new AppError('Only the reporter can upload report evidence', 403);
  if (report.status === 'CLOSED') throw new AppError('Closed reports cannot receive new evidence', 409);
  return report;
};


