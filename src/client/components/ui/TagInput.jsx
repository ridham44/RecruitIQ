import { useState } from 'react';
import { X } from 'lucide-react';
import { inputClass } from './FormField.jsx';

// Simple comma/enter-delimited tag input for skill/education lists.
export default function TagInput({ value = [], onChange, placeholder }) {
  const [draft, setDraft] = useState('');

  const commit = () => {
    const tag = draft.trim();
    if (tag && !value.includes(tag)) onChange([...value, tag]);
    setDraft('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Backspace' && !draft && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className={`${inputClass} flex flex-wrap items-center gap-1.5`}>
      {value.map((tag) => (
        <span key={tag} className="flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700">
          {tag}
          <button type="button" onClick={() => onChange(value.filter((t) => t !== tag))}>
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        className="min-w-[8rem] flex-1 border-none p-0 text-sm outline-none focus:ring-0"
        value={draft}
        placeholder={value.length === 0 ? placeholder : ''}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commit}
      />
    </div>
  );
}
