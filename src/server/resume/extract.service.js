import mammoth from 'mammoth';
import { ApiError } from '../utils/ApiError.js';

const PDF_MAGIC = Buffer.from('%PDF');
const DOCX_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // ZIP/DOCX signature

// Re-checks the actual file bytes rather than trusting the client-supplied
// mimetype/extension (Section 9: "Do not trust the file extension alone").
function detectFileType(buffer) {
  if (buffer.subarray(0, 4).equals(PDF_MAGIC)) return 'pdf';
  if (buffer.subarray(0, 4).equals(DOCX_MAGIC)) return 'docx';
  return null;
}

async function extractPdfText(buffer) {
  // Lazy import: pdf-parse's module-load side effect tries to read a local
  // test fixture, which breaks cleanly under Vercel/serverless if imported
  // eagerly at module scope in some bundling setups.
  const { default: pdfParse } = await import('pdf-parse');
  const result = await pdfParse(buffer);
  return result.text;
}

async function extractDocxText(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

export async function extractResumeText(buffer) {
  const detectedType = detectFileType(buffer);

  if (!detectedType) {
    throw ApiError.badRequest('File does not appear to be a valid PDF or DOCX', 'INVALID_FILE_TYPE');
  }

  const rawText = detectedType === 'pdf' ? await extractPdfText(buffer) : await extractDocxText(buffer);
  const trimmed = (rawText || '').trim();

  if (!trimmed) {
    throw ApiError.badRequest('Could not extract any text from the resume', 'EMPTY_RESUME_TEXT');
  }

  return { text: trimmed, detectedType };
}
