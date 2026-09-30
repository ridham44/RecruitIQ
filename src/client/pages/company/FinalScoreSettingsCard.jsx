import { useState } from 'react';
import { Calculator, Save } from 'lucide-react';
import { jobsApi } from '../../services/jobs.js';
import { submissionsApi } from '../../services/submissions.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import { inputClass } from '../../components/ui/FormField.jsx';

// Build plan P7 (§12) — per-job final score: CV match × weight + interview ×
// weight, and an optional final threshold that marks candidates Qualified /
// Not qualified. Leaving the threshold empty keeps today's behaviour.
export default function FinalScoreSettingsCard({ job, onSaved }) {
  const [form, setForm] = useState({
    enabled: job.finalThreshold != null,
    finalThreshold: job.finalThreshold ?? 70,
    cvPercent: Math.round((job.cvWeight / ((job.cvWeight + job.interviewWeight) || 1)) * 100),
    autoSubmitToClient: Boolean(job.autoSubmitToClient),
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const cv = Number(form.cvPercent) / 100;
      const { job: updated } = await jobsApi.update(job.id, {
        finalThreshold: form.enabled ? Number(form.finalThreshold) : null,
        cvWeight: Math.round(cv * 100) / 100,
        interviewWeight: Math.round((1 - cv) * 100) / 100,
        autoSubmitToClient: form.enabled && form.autoSubmitToClient,
      });
      const { rescored } = await submissionsApi.recomputeJob(job.id);
      setMessage(`Saved. Re-scored ${rescored} interviewed candidate${rescored === 1 ? '' : 's'}.`);
      onSaved?.(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mb-6 p-5">
      <h3 className="mb-1 flex items-center gap-2 font-semibold text-slate-900">
        <Calculator className="h-4 w-4 text-brand-600" /> Final score
      </h3>
      <p className="mb-4 text-sm text-slate-500">After the interview, the CV match and interview score are combined into one final score.</p>

      <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="cvWeight">
        Weight: CV {form.cvPercent}% · Interview {100 - form.cvPercent}%
      </label>
      <input
        id="cvWeight"
        type="range"
        min={0}
        max={100}
        step={5}
        value={form.cvPercent}
        onChange={(e) => setForm({ ...form, cvPercent: Number(e.target.value) })}
        className="h-11 w-full accent-brand-600 sm:max-w-md"
      />

      <label className="mt-3 flex min-h-[44px] items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
        Mark candidates Qualified / Not qualified using a final threshold
      </label>
      {form.enabled && (
        <div className="mt-2 flex flex-col gap-3 pl-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-700">Threshold</span>
            <input
              type="number"
              min={0}
              max={100}
              className={`${inputClass} min-h-[44px] w-24`}
              value={form.finalThreshold}
              onChange={(e) => setForm({ ...form, finalThreshold: e.target.value })}
            />
            <span className="text-sm text-slate-500">/ 100</span>
          </div>
          <label className="flex min-h-[44px] items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.autoSubmitToClient}
              onChange={(e) => setForm({ ...form, autoSubmitToClient: e.target.checked })}
            />
            Automatically send qualified candidates to the job's HR person
          </label>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={save} loading={saving}>
          <Save className="h-4 w-4" /> Save &amp; recalculate
        </Button>
        {message && <span className="text-sm text-emerald-600">{message}</span>}
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <p className="mt-2 text-xs text-slate-400">
        Without a threshold, candidates stay "Interview completed" and you decide. Auto-send only works when the job is linked to
        an HR person (Client → Department → HR).
      </p>
    </Card>
  );
}
