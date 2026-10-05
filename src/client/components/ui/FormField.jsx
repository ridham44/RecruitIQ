import { Children, cloneElement, isValidElement, useId } from 'react';

// Shows the field's error under it and marks a single input child as invalid
// (red border via inputClass, announced by screen readers).
export default function FormField({ label, error, hint, children }) {
  const id = useId();
  const errorId = `${id}-error`;
  const only = Children.count(children) === 1 && isValidElement(children) ? children : null;
  const control = only
    ? cloneElement(only, {
        id: only.props.id || id,
        'aria-invalid': error ? true : only.props['aria-invalid'],
        'aria-describedby': error ? errorId : only.props['aria-describedby'],
      })
    : children;

  return (
    <div className="mb-4">
      <label htmlFor={only ? only.props.id || id : undefined} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {control}
      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClass =
  'block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus:ring-red-500';
