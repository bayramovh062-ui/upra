import multer from 'multer';
import { AppError } from '../utils/AppError.js';
import { UPLOAD_LIMITS } from '../services/uploadService.js';

// Memory storage: buffer -> Cloudinary/local. Hard per-request cap by purpose maxBytes * maxFiles (guardrail).
const storage = multer.memoryStorage();

export const uploadFor = (purpose) => {
  const limit = UPLOAD_LIMITS[purpose];
  if (!limit) throw new Error(`Unknown upload purpose: ${purpose}`);
  const fileSize = Math.max(limit.maxBytes, 1);
  return multer({
    storage,
    limits: { fileSize, files: limit.maxFiles, parts: 30, fieldSize: 10_000 },
    fileFilter: (_req, _file, cb) => cb(null, true), // mime/size validated in service with purpose rules
  });
};

export const singleFile = (purpose, field = 'file') => uploadFor(purpose).single(field);
export const multiFiles = (purpose, field = 'files') => uploadFor(purpose).array(field, UPLOAD_LIMITS[purpose]?.maxFiles || 5);

export const requireFile = (req, _res, next) => {
  if (!req.file && !(req.files && req.files.length)) return next(new AppError('File is required', 400));
  next();
};
