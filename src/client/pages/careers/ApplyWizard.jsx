import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileUp, FileCheck2, ShieldCheck, ArrowLeft, Check } from 'lucide-react';
import { publicApi } from '../../services/public.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import FormField, { inputClass } from '../../components/ui/FormField.jsx';
import { checkForm } from '../../../shared/schemas/common.js';
import { guestApplySchema, otpSendSchema, otpVerifySchema } from '../../../shared/schemas/public.schema.js';

// Same rules as the server's guest-apply body, for the fields on the details step.
const detailsSchema = guestApplySchema.pick({ fullName: true, email: true, phone: true, consent: true });
const DETAIL_FIELDS = ['fullName', 'email', 'phone', 'consent'];
const MAX_MB = 4;
const STEPS = ['Upload CV', 'Your details', 'Verify phone'];

function StepDots({ step }) {
  return (
    <ol className="mb-6 flex items-center gap-2" aria-label="Progress">
      {STEPS.map((label, i) => (
        <li key={label} className="flex min-w-0 flex-1 items-center gap-2">
          <span
            className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
              i < step ? 'bg-emerald-600 text-white' : i === step ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-500'
            }`}
            aria-current={i === step ? 'step' : undefined}
          >
            {i < step ? <Check className="h-4 w-4" /> : i + 1}
          </span>
          <span className={`hidden truncate text-xs sm:block ${i === step ? 'font-medium text-slate-900' : 'text-slate-500'}`}>{label}</span>
          {i < STEPS.length - 1 && <span className="h-px flex-1 bg-slate-200" />}
        </li>
      ))}
    </ol>
  );
}

// Build plan P4 (§6, §7) — upload CV → confirm details (read from the CV) →
// phone OTP → submit. `job` is null for a CV-only submission (§6B).
export default function ApplyWizard({ slug, company, job }) {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  // The email already belongs to an account (server code EMAIL_HAS_ACCOUNT).
  const [emailHasAccount, setEmailHasAccount] = useState(false);

  const [upload, setUpload] = useState(null);
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', consent: false });

  const [otp, setOtp] = useState({ sentTo: '', code: '', devCode: '', resendIn: 0 });

  // Edit a details field and clear its error.
  const setField = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
    if (key === 'email') setEmailHasAccount(false);
  };

  // Server errors: per-field messages go next to the field when it is on the
  // current step; anything else (or a field not shown here) goes in the banner.
  const showApiError = (err, visible) => {
    const fields = err.fields || {};
    const shown = Object.fromEntries(Object.entries(fields).filter(([k]) => visible.includes(k)));
    setFieldErrors(shown);
    if (Object.keys(shown).length < Object.keys(fields).length || Object.keys(fields).length === 0) setError(err.message);
  };

  // Resend countdown.
  useEffect(() => {
    if (otp.resendIn <= 0) return undefined;
    const t = setTimeout(() => setOtp((o) => ({ ...o, resendIn: o.resendIn - 1 })), 1000);
    return () => clearTimeout(t);
  }, [otp.resendIn]);

  // ── Step 1: upload ──
  const onFile = async (file) => {
    setError('');
    if (!file) return;
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!['pdf', 'docx'].includes(ext)) return setError('Please upload a PDF or DOCX file.');
    if (file.size > MAX_MB * 1024 * 1024) return setError(`The file is larger than ${MAX_MB} MB.`);
    setBusy(true);
    try {
      const parsed = await publicApi.parseCv(file);
      setUpload(parsed);
      setForm((f) => ({
        ...f,
        fullName: f.fullName || parsed.detected.fullName || '',
        email: f.email || parsed.detected.email || '',
        phone: f.phone || parsed.detected.phone || '',
      }));
      setStep(1);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // ── Step 2 → 3: send the code ──
  const sendCode = async () => {
    setError('');
    const { data, errors } = checkForm(otpSendSchema, { phone: form.phone });
    if (!data) {
      // Only reachable on resend if the number was changed; show it on the details step.
      setFieldErrors(errors);
      if (step !== 1) setStep(1);
      return;
    }
    setBusy(true);
    try {
      const res = await publicApi.sendOtp(data.phone);
      setOtp({ sentTo: res.phone, code: '', devCode: res.devCode || '', resendIn: res.resendAfterSeconds || 30 });
      setForm((f) => ({ ...f, phone: res.phone }));
      setFieldErrors({});
      setStep(2);
    } catch (err) {
      showApiError(err, step === 1 ? DETAIL_FIELDS : []);
    } finally {
      setBusy(false);
    }
  };

  const toVerify = () => {
    setError('');
    setEmailHasAccount(false);
    const { data, errors } = checkForm(detailsSchema, form);
    setFieldErrors(errors);
    if (!data) return undefined;
    setForm((f) => ({ ...f, fullName: data.fullName, email: data.email, phone: data.phone }));
    return sendCode();
  };

  // ── Step 3: verify + submit ──
  const submit = async () => {
    setError('');
    const verify = checkForm(otpVerifySchema, { phone: otp.sentTo, code: otp.code });
    if (!verify.data) {
      setFieldErrors(verify.errors);
      if (!verify.errors.code) setError(Object.values(verify.errors)[0]);
      return;
    }
    setFieldErrors({});
    setBusy(true);
    try {
      const { otpToken } = await publicApi.verifyOtp(verify.data.phone, verify.data.code);
      const result = await publicApi.apply({
        slug,
        uploadId: upload.uploadId,
        ...(job ? { jobId: job.id } : {}),
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: otp.sentTo,
        otpToken,
        consent: true,
      });
      navigate(`/careers/track?token=${encodeURIComponent(result.trackingToken)}&slug=${encodeURIComponent(slug)}&account=${result.account}`, {
        replace: true,
      });
    } catch (err) {
      if (err.code === 'UPLOAD_EXPIRED') {
        setUpload(null);
        setFieldErrors({});
        setStep(0);
        setError(err.message);
      } else if (err.code === 'EMAIL_HAS_ACCOUNT') {
        // Show it next to the email, with a way to log in instead.
        setStep(1);
        setError('');
        setEmailHasAccount(true);
        setFieldErrors({ email: err.message });
      } else if (Object.keys(err.fields || {}).some((k) => DETAIL_FIELDS.includes(k))) {
        setStep(1);
        showApiError(err, DETAIL_FIELDS);
      } else {
        showApiError(err, ['code']);
      }
    } finally {
      setBusy(false);
    }
  };

  const emailError = emailHasAccount ? (
    <>
      {fieldErrors.email}{' '}
      <Link to="/auth/login" className="font-medium text-brand-600 underline">
        Log in
      </Link>
    </>
  ) : (
    fieldErrors.email
  );

  const cls = `${inputClass} min-h-[44px]`;

  return (
    <Card className="p-4 sm:p-6">
      <h2 className="mb-1 text-lg font-semibold text-slate-900">{job ? `Apply for ${job.title}` : 'Submit your CV'}</h2>
      <p className="mb-5 text-sm text-slate-500">
        {job ? 'No account needed — it takes about a minute.' : 'We\'ll match your CV to the best open role. No account needed.'}
      </p>
      <StepDots step={step} />

      {step === 0 && (
        <div>
          <label
            className={`flex min-h-[160px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center ${
              busy ? 'border-brand-300 bg-brand-50' : 'border-slate-300 hover:border-brand-400 hover:bg-slate-50'
            }`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (!busy) onFile(e.dataTransfer.files?.[0]);
            }}
          >
            <FileUp className="h-8 w-8 text-brand-600" />
            <span className="text-sm font-medium text-slate-800">{busy ? 'Reading your CV…' : 'Tap to choose your CV'}</span>
            <span className="text-xs text-slate-500">PDF or DOCX, up to {MAX_MB} MB{busy ? '' : ' — or drag it here'}</span>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="sr-only"
              disabled={busy}
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </label>
        </div>
      )}

      {step === 1 && (
        <div>
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <FileCheck2 className="h-4 w-4 shrink-0" />
            <span className="min-w-0 truncate">{upload?.fileName}</span>
            <button type="button" className="ml-auto shrink-0 text-xs font-medium underline" onClick={() => setStep(0)}>
              Change
            </button>
          </div>
          <p className="mb-3 text-xs text-slate-500">We filled these in from your CV — please check them.</p>
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormField label="Full name" error={fieldErrors.fullName}>
                <input
                  className={cls}
                  autoComplete="name"
                  maxLength={120}
                  value={form.fullName}
                  onChange={(e) => setField('fullName', e.target.value)}
                />
              </FormField>
            </div>
            <FormField label="Email" error={emailError}>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                maxLength={254}
                className={cls}
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
              />
            </FormField>
            <FormField label="Mobile number" error={fieldErrors.phone} hint="Include the country code, e.g. +91 98765 43210">
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                maxLength={24}
                className={cls}
                value={form.phone}
                onChange={(e) => setField('phone', e.target.value)}
                placeholder="+91 98765 43210"
              />
            </FormField>
          </div>
          <label
            className={`flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm text-slate-600 ${
              fieldErrors.consent ? 'mb-1 border-red-500' : 'mb-4 border-slate-200'
            }`}
          >
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300 text-brand-600"
              checked={form.consent}
              onChange={(e) => setField('consent', e.target.checked)}
              aria-invalid={fieldErrors.consent ? true : undefined}
              aria-describedby={fieldErrors.consent ? 'apply-consent-error' : undefined}
            />
            <span>
              {job
                ? `I agree that ${company?.name || 'this company'} and RecruitIQ may process my CV and contact details, and use AI to assess my fit for this job.`
                : `I agree that RecruitIQ may process my CV and contact details and use AI to match me to open jobs — including jobs at other companies hiring on RecruitIQ — and share my application with the company I'm matched to.`}
            </span>
          </label>
          {fieldErrors.consent && (
            <p id="apply-consent-error" role="alert" className="mb-4 text-xs text-red-600">
              {fieldErrors.consent}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button variant="ghost" onClick={() => setStep(0)} className="w-full sm:w-auto">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button onClick={toVerify} loading={busy} className="w-full sm:w-auto">
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <div className="mb-4 flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
            <p className="text-sm text-slate-600">
              We sent a 6-digit code to <strong className="text-slate-900">{otp.sentTo}</strong>.
            </p>
          </div>
          {otp.devCode && (
            <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Development mode — no SMS is sent. Your code is <strong className="font-mono text-sm">{otp.devCode}</strong>
            </p>
          )}
          <FormField label="Verification code" error={fieldErrors.code}>
            <input
              type="text"
              className={`${inputClass} min-h-[52px] text-center font-mono text-2xl tracking-[0.5em]`}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              autoFocus
              value={otp.code}
              onChange={(e) => {
                setOtp({ ...otp, code: e.target.value.replace(/\D/g, '').slice(0, 6) });
                setFieldErrors((fe) => (fe.code ? { ...fe, code: undefined } : fe));
              }}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              aria-label="6-digit verification code"
            />
          </FormField>
          <div className="mb-4 text-sm">
            {otp.resendIn > 0 ? (
              <span className="text-slate-500">Resend code in {otp.resendIn}s</span>
            ) : (
              <button type="button" onClick={sendCode} disabled={busy} className="min-h-[44px] font-medium text-brand-600 hover:underline">
                Resend code
              </button>
            )}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button variant="ghost" onClick={() => setStep(1)} className="w-full sm:w-auto">
              <ArrowLeft className="h-4 w-4" /> Change number
            </Button>
            <Button onClick={submit} loading={busy} className="w-full sm:w-auto">
              {job ? 'Verify & submit application' : 'Verify & submit CV'}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </Card>
  );
}
