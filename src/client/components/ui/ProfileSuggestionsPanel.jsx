import { useState } from 'react';
import { Sparkles, Check } from 'lucide-react';
import Button from './Button.jsx';
import { inputClass } from './FormField.jsx';

const FIELD_LABELS = {
  university: 'University',
  college: 'College / Institute',
  degree: 'Degree',
  latestSpi: 'Latest / Final SPI',
  phone: 'Phone',
  gender: 'Gender',
};

const GENDER_LABELS = { MALE: 'Male', FEMALE: 'Female', OTHER: 'Other' };

// Shown right after a resume upload when the AI parser found values for
// profile fields the candidate hasn't filled in yet (Section 6/7). Nothing
// is saved here — the candidate reviews/edits, then "Add to profile" merges
// the accepted values into the surrounding form; the existing "Save
// changes" button is what actually persists them. A field the candidate
// already filled in is never offered for overwrite (the backend only ever
// includes empty fields in `suggestions`).
export default function ProfileSuggestionsPanel({ suggestions, onApply, onDismiss }) {
  const fieldKeys = Object.keys(suggestions).filter((k) => k !== 'skills');
  const [checked, setChecked] = useState(() => Object.fromEntries([...fieldKeys, 'skills'].map((k) => [k, true])));
  const [values, setValues] = useState(() => {
    const initial = {};
    fieldKeys.forEach((k) => {
      initial[k] = k === 'gender' ? suggestions[k] : String(suggestions[k]);
    });
    return initial;
  });

  const handleApply = () => {
    const accepted = {};
    fieldKeys.forEach((k) => {
      if (checked[k]) accepted[k] = k === 'latestSpi' ? Number(values[k]) : values[k];
    });
    if (checked.skills && suggestions.skills?.length) accepted.skills = suggestions.skills;
    onApply(accepted);
  };

  return (
    <div className="mb-4 rounded-lg border border-brand-200 bg-brand-50 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-800">
        <Sparkles className="h-4 w-4" />
        We found some information in your resume
      </div>

      <div className="space-y-2">
        {fieldKeys.map((key) => (
          <label key={key} className="flex items-start gap-2 rounded-md bg-white p-2 text-sm">
            <input
              type="checkbox"
              className="mt-2"
              checked={checked[key]}
              onChange={(e) => setChecked({ ...checked, [key]: e.target.checked })}
            />
            <div className="flex-1">
              <div className="text-xs font-medium text-slate-500">{FIELD_LABELS[key] || key}</div>
              {key === 'gender' ? (
                <div className="mt-0.5 text-slate-800">{GENDER_LABELS[values[key]] || values[key]}</div>
              ) : (
                <input
                  className={`${inputClass} mt-1`}
                  value={values[key]}
                  onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                  disabled={!checked[key]}
                />
              )}
            </div>
          </label>
        ))}

        {suggestions.skills?.length > 0 && (
          <label className="flex items-start gap-2 rounded-md bg-white p-2 text-sm">
            <input
              type="checkbox"
              className="mt-2"
              checked={checked.skills}
              onChange={(e) => setChecked({ ...checked, skills: e.target.checked })}
            />
            <div className="flex-1">
              <div className="text-xs font-medium text-slate-500">New skills found</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {suggestions.skills.map((skill) => (
                  <span key={skill} className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-700">
                    <Check className="h-3 w-3" /> {skill}
                  </span>
                ))}
              </div>
            </div>
          </label>
        )}
      </div>

      <div className="mt-3 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDismiss}>
          Dismiss
        </Button>
        <Button type="button" onClick={handleApply}>
          Review Information
        </Button>
      </div>
    </div>
  );
}
