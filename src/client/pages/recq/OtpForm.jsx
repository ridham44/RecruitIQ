import { useEffect, useRef, useState, useCallback } from 'react';
import { MailCheck } from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import { recqApi } from '../../services/recq.js';

// Build plan P9 (§5/§17) — email OTP. The code was sent to the address on the
// candidate's resume (shown masked); they can't change it here. Auto-sends on
// mount, supports resend cooldown, verifies, then calls onVerified(recqToken).
export default function OtpForm({ agencySlug, uploadId, jobSlug, emailMasked, onVerified }) {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [masked, setMasked] = useState(emailMasked || '');
  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [devCode, setDevCode] = useState('');
  const boxes = useRef([]);

  const send = useCallback(async () => {
    setSending(true);
    setError('');
    try {
      const res = await recqApi.sendOtp(agencySlug, { uploadId, jobSlug });
      if (res.resumeEmail) setMasked(res.resumeEmail);
      if (res.emailMasked) setMasked(res.emailMasked);
      setCooldown(res.resendAfterSeconds || 30);
      if (res.devCode) setDevCode(res.devCode);
    } catch (err) {
      setError(err.message || "We couldn't send the code. Please try again.");
    } finally {
      setSending(false);
    }
  }, [agencySlug, uploadId, jobSlug]);

  // Auto-send once when the step opens.
  useEffect(() => {
    send();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  function setAt(i, v) {
    const clean = v.replace(/\D/g, '');
    setError('');
    if (clean.length > 1) {
      // Paste of the whole code.
      const next = clean.slice(0, 6).split('');
      const filled = ['', '', '', '', '', ''].map((_, idx) => next[idx] || '');
      setDigits(filled);
      boxes.current[Math.min(next.length, 5)]?.focus();
      return;
    }
    setDigits((prev) => {
      const copy = [...prev];
      copy[i] = clean;
      return copy;
    });
    if (clean && i < 5) boxes.current[i + 1]?.focus();
  }

  function onKeyDown(i, e) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) boxes.current[i - 1]?.focus();
  }

  const code = digits.join('');

  async function verify() {
    if (code.length !== 6) return;
    setVerifying(true);
    setError('');
    try {
      const res = await recqApi.verifyOtp(agencySlug, { uploadId, code });
      onVerified(res.recqToken);
    } catch (err) {
      setError(err.message || 'That code isn’t right.');
      setVerifying(false);
    }
  }

  return (
    <div className="flex flex-col items-center text-center">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <MailCheck className="h-6 w-6" />
      </span>
      <h2 className="mt-3 text-lg font-semibold text-slate-900">Verify your email</h2>
      <p className="mt-1 text-sm text-slate-500">
        We sent a 6-digit code to
        <br />
        <span className="font-medium text-slate-700">{masked || 'your email'}</span>
      </p>

      {devCode && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-700">Dev code: <strong>{devCode}</strong></p>
      )}

      <div className="mt-5 flex justify-center gap-2" onPaste={(e) => setAt(0, e.clipboardData.getData('text'))}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => (boxes.current[i] = el)}
            value={d}
            onChange={(e) => setAt(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(i, e)}
            inputMode="numeric"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            maxLength={1}
            aria-label={`Digit ${i + 1}`}
            className="h-12 w-11 rounded-lg border border-slate-300 bg-white text-center text-lg font-semibold text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 sm:h-14 sm:w-12"
          />
        ))}
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <Button onClick={verify} loading={verifying} disabled={code.length !== 6} className="mt-5 w-full">
        Verify
      </Button>

      <p className="mt-3 text-xs text-slate-500">
        Didn&apos;t receive it?{' '}
        {cooldown > 0 ? (
          <span className="text-slate-400">Resend code in {cooldown}s</span>
        ) : (
          <button type="button" onClick={send} disabled={sending} className="font-medium text-brand-600 hover:underline disabled:opacity-60">
            {sending ? 'Sending…' : 'Resend code'}
          </button>
        )}
      </p>
    </div>
  );
}
