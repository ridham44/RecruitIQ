import multer from 'multer';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
]);

const ALLOWED_EXTENSIONS = new Set(['pdf', 'docx']);

// Memory storage only — never writes to local disk. This keeps the upload
// path serverless-safe (Vercel functions have no persistent filesystem);
// the resulting buffer is handed to the storage driver abstraction, which
// decides where the bytes actually end up (Section 9).
const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  const ext = (file.originalname.split('.').pop() || '').toLowerCase();

  // Validate both the MIME type AND extension — never trust the extension
  // alone (Section 9). The buffer's magic bytes are re-checked in
  // resume/extract.service.js before parsing.
  if (!ALLOWED_MIME_TYPES.has(file.mimetype) || !ALLOWED_EXTENSIONS.has(ext)) {
    return cb(ApiError.badRequest('Only PDF and DOCX resumes are supported', 'INVALID_FILE_TYPE'));
  }
  cb(null, true);
}

export const uploadResume = multer({
  storage,
  fileFilter,
  limits: { fileSize: env.maxResumeSizeMb * 1024 * 1024 },
}).single('resume');
