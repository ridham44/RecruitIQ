import { useEffect, useState } from 'react';
import { Globe, Copy, Check, ExternalLink, Pencil } from 'lucide-react';
import { careersAdminApi } from '../../services/public.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import FormField, { inputClass } from '../../components/ui/FormField.jsx';
import { checkForm } from '../../../shared/schemas/common.js';
import { careersSlugSchema } from '../../../shared/schemas/public.schema.js';

// Build plan P4 — the company's public careers page link (Jobs page).
export default function CareersLinkCard() {
  const { isOwner } = usePermissions();
  const [link, setLink] = useState(null);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [slug, setSlug] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    careersAdminApi
      .getLink()
      .then(setLink)
      .catch(() => setLink(null));
  }, []);

  if (!link) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the link is still selectable */
    }
  };

  const save = async () => {
    setError('');
    const { data, errors } = checkForm(careersSlugSchema, { slug });
    setFieldErrors(errors);
    if (!data) return;
    setSaving(true);
    try {
      setLink(await careersAdminApi.setLink(data.slug));
      setEditing(false);
    } catch (err) {
      const fields = err.fields || {};
      setFieldErrors(fields);
      if (!fields.slug) setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mb-4 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Globe className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900">Your careers page</p>
            <p className="break-all font-mono text-xs text-slate-500">{link.url}</p>
            {!link.enabled && (
              <p className="mt-1 text-xs text-amber-700">
                Not live yet — the careers portal is switched off (FEATURE_GUEST_APPLY). Candidates will see "not enabled" until it's turned on.
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 md:shrink-0">
          <Button variant="secondary" onClick={copy}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy'}
          </Button>
          <a href={link.url} target="_blank" rel="noreferrer">
            <Button variant="secondary">
              <ExternalLink className="h-4 w-4" /> Open
            </Button>
          </a>
          {isOwner && (
            <Button
              variant="ghost"
              onClick={() => {
                setSlug(link.slug);
                setError('');
                setFieldErrors({});
                setEditing(true);
              }}
            >
              <Pencil className="h-4 w-4" /> Rename
            </Button>
          )}
        </div>
      </div>

      <Modal
        open={editing}
        title="Rename careers link"
        onClose={() => setEditing(false)}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setEditing(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={save} loading={saving} className="w-full sm:w-auto">
              Save
            </Button>
          </div>
        }
      >
        <FormField
          label="Link name"
          error={fieldErrors.slug}
          hint="3–50 lowercase letters, numbers and single dashes, e.g. acme-talent."
        >
          <input
            className={`${inputClass} min-h-[44px] font-mono`}
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
              setFieldErrors({});
            }}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            placeholder="e.g. acme-talent"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            minLength={3}
            maxLength={50}
          />
        </FormField>
        <p className="text-xs text-slate-500">The old link stops working, so update anywhere you've shared it.</p>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </Modal>
    </Card>
  );
}
