import { useRef, useState } from 'react';
import { FileText, UploadCloud } from 'lucide-react';
import Button from '../../components/ui/Button.jsx';

const MAX_MB = 4;
const ACCEPT = '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// Build plan P9 (§15) — dead-simple, mobile-friendly resume upload. Calls
// onSubmit(file). `loading` shows the "analyzing" state; `ctaLabel` is the
// submit button text.
export default function ResumeDropzone({ onSubmit, loading = false, ctaLabel = 'Find matching jobs' }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');

  function pick(f) {
    if (!f) return;
    if (f.size > MAX_MB * 1024 * 1024) {
      setError(`That file is larger than ${MAX_MB} MB. Please choose a smaller file.`);
      setFile(null);
      return;
    }
    setError('');
    setFile(f);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files?.[0]);
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => !loading && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        disabled={loading}
        className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors
          ${dragging ? 'border-brand-400 bg-brand-50' : 'border-slate-300 bg-white hover:border-brand-300 hover:bg-slate-50'}
          ${loading ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
      >
        {file ? (
          <>
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <FileText className="h-6 w-6" />
            </span>
            <span className="max-w-full truncate text-sm font-medium text-slate-800">{file.name}</span>
            <span className="text-xs text-slate-400">Tap to choose a different file</span>
          </>
        ) : (
          <>
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <UploadCloud className="h-6 w-6" />
            </span>
            <span className="text-sm font-medium text-slate-700">Upload your resume</span>
            <span className="text-xs text-slate-400">PDF, DOC or DOCX · Max {MAX_MB} MB</span>
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
      />

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <Button onClick={() => file && onSubmit(file)} disabled={!file} loading={loading} className="mt-4 w-full">
        {loading ? 'Analyzing your profile…' : ctaLabel}
      </Button>
    </div>
  );
}
