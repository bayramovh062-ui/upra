import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';
import { AppError } from '../utils/AppError.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Plan P3: Cloudinary when configured; local disk fallback for dev/tests (Render disk is ephemeral in prod).
const PROVIDER = (process.env.UPLOAD_PROVIDER || (process.env.CLOUDINARY_CLOUD_NAME ? 'cloudinary' : 'local')).toLowerCase();
const LOCAL_DIR = process.env.UPLOAD_LOCAL_DIR || path.join(__dirname, '../../uploads');

export const UPLOAD_LIMITS = {
  AVATAR: { maxBytes: 2 * 1024 * 1024, maxFiles: 1, kinds: ['image'] },
  MILESTONE_SUBMIT: { maxBytes: 15 * 1024 * 1024, maxFiles: 5, kinds: ['image', 'pdf', 'doc', 'archive', 'text'] },
  DISPUTE_EVIDENCE: { maxBytes: 15 * 1024 * 1024, maxFiles: 5, kinds: ['image', 'pdf', 'doc', 'archive', 'text'] },
  ISSUE: { maxBytes: 10 * 1024 * 1024, maxFiles: 5, kinds: ['image', 'pdf', 'doc', 'archive', 'text'] },
  ISSUE_COMMENT: { maxBytes: 10 * 1024 * 1024, maxFiles: 3, kinds: ['image', 'pdf', 'doc', 'archive', 'text'] },
  REPORT_EVIDENCE: { maxBytes: 10 * 1024 * 1024, maxFiles: 5, kinds: ['image', 'pdf', 'doc', 'archive', 'text'] },
};

const MIME_KINDS = {
  image: new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  pdf: new Set(['application/pdf']),
  doc: new Set([
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
  ]),
  archive: new Set(['application/zip', 'application/x-zip-compressed', 'application/x-7z-compressed', 'application/x-rar-compressed']),
  text: new Set(['text/plain', 'text/markdown', 'text/csv', 'application/json']),
};

export const allowedMime = (purpose, mimeType) => {
  const kinds = UPLOAD_LIMITS[purpose]?.kinds || [];
  return kinds.some((k) => MIME_KINDS[k]?.has(mimeType));
};

const ensureCloudinary = () => {
  if (PROVIDER !== 'cloudinary') return false;
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) return false;
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });
  return true;
};

const ensureLocalDir = () => {
  fs.mkdirSync(LOCAL_DIR, { recursive: true });
};

const safeName = (name = 'file') => name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'file';

export const storeFile = async (file, { purpose }) => {
  if (!file?.buffer) throw new AppError('No file uploaded', 400);
  const limit = UPLOAD_LIMITS[purpose];
  if (!limit) throw new AppError('Invalid upload purpose', 400);
  if (file.size > limit.maxBytes) throw new AppError(`File is too large (max ${Math.round(limit.maxBytes / 1024 / 1024)} MB)`, 400);
  if (!allowedMime(purpose, file.mimetype)) throw new AppError(`File type ${file.mimetype} is not allowed for ${purpose}`, 400);

  if (PROVIDER === 'cloudinary' && ensureCloudinary()) {
    const resourceType = file.mimetype.startsWith('image/') ? 'image' : 'raw';
    const folder = `upra/${purpose.toLowerCase()}`;
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: resourceType, use_filename: true, unique_filename: true },
        (err, res) => (err ? reject(err) : resolve(res))
      );
      stream.end(file.buffer);
    });
    return {
      url: result.secure_url,
      provider: 'cloudinary',
      providerKey: result.public_id,
      resourceType: result.resource_type,
    };
  }

  // local fallback
  ensureLocalDir();
  const key = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}-${safeName(file.originalname)}`;
  fs.writeFileSync(path.join(LOCAL_DIR, key), file.buffer);
  return {
    url: `/api/uploads/local/${encodeURIComponent(key)}`,
    provider: 'local',
    providerKey: key,
    resourceType: file.mimetype.startsWith('image/') ? 'image' : 'raw',
  };
};

export const getLocalPath = (key) => path.join(LOCAL_DIR, path.basename(key));

export const toAttachmentRecord = (file, stored, { purpose, uploadedById, links = {} }) => ({
  purpose,
  url: stored.url,
  filename: safeName(file.originalname || 'file'),
  mimeType: file.mimetype || 'application/octet-stream',
  size: file.size,
  provider: stored.provider,
  uploadedById,
  userId: links.userId ?? null,
  contractId: links.contractId ?? null,
  milestoneId: links.milestoneId ?? null,
  submissionId: links.submissionId ?? null,
  disputeId: links.disputeId ?? null,
  issueId: links.issueId ?? null,
  issueCommentId: links.issueCommentId ?? null,
  reportId: links.reportId ?? null,
});
