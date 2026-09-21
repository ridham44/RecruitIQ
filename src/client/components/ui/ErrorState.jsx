import { AlertTriangle } from 'lucide-react';

export default function ErrorState({ message = 'Something went wrong.', onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50 py-12 text-center">
      <AlertTriangle className="h-8 w-8 text-red-400" />
      <p className="text-sm text-red-700">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="text-sm font-medium text-red-700 underline underline-offset-2">
          Try again
        </button>
      )}
    </div>
  );
}
