import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import AuthShell from './AuthShell.jsx';
import { api } from '../../services/api.js';
import { useAuth } from '../../hooks/useAuth.jsx';
import FormField from '../../components/ui/FormField.jsx';
import PasswordInput from '../../components/ui/PasswordInput.jsx';
import Button from '../../components/ui/Button.jsx';
import LoadingState from '../../components/ui/LoadingState.jsx';
import { homePathForRole } from '../../utils/homePath.js';

function Rule({ ok, children }) {
  return (
    <div className="flex items-center gap-1.5">
      {ok ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <span className="mx-1 h-1.5 w-1.5 rounded-full bg-slate-300" />}
      <span className={ok ? 'font-medium text-emerald-700' : 'text-slate-500'}>{children}</span>
    </div>
  );
}

// Build plan P1: landing page for the emailed invite link
// (/auth/set-password?token=…). Choosing a password logs the user in.
export default function SetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const { setPasswordWithToken } = useAuth();
  const navigate = useNavigate();

  const [info, setInfo] = useState(null);
  const [linkError, setLinkError] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) {
      setLinkError('This link is missing its token. Please use the link from your email.');
      return;
    }
    api
      .get(`/auth/password-token/${encodeURIComponent(token)}`)
      .then(setInfo)
      .catch((err) => setLinkError(err.message));
  }, [token]);

  const hasMinLength = password.length >= 8;
  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const matches = password.length > 0 && password === confirm;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!hasMinLength || !hasLetter || !hasNumber) return setError('Please meet all the password requirements');
    if (!matches) return setError("Passwords don't match");

    setSaving(true);
    try {
      const user = await setPasswordWithToken(token, password);
      navigate(homePathForRole(user.role), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (linkError) {
    return (
      <AuthShell title="Link not valid" subtitle={linkError}>
        <Link to="/auth/login">
          <Button className="w-full">Go to login</Button>
        </Link>
      </AuthShell>
    );
  }

  if (!info) {
    return (
      <AuthShell title="Set your password">
        <LoadingState label="Checking your link…" />
      </AuthShell>
    );
  }

  // Forgot-password links reuse this page with purpose RESET.
  const isReset = info.purpose === 'RESET';

  return (
    <AuthShell
      // title="Set your password"
      title={isReset ? 'Reset your password' : 'Set your password'}
      // subtitle={info.companyName ? `Finish setting up ${info.companyName} on RecruitIQ` : 'Finish setting up your account'}
      subtitle={
        isReset
          ? 'Choose a new password for your account.'
          : info.companyName
            ? `Finish setting up ${info.companyName} on RecruitIQ`
            : 'Finish setting up your account'
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        <FormField label="Email">
          <p className="break-all rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{info.email}</p>
        </FormField>
        <FormField label="New password">
          <PasswordInput
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
        </FormField>
        <FormField label="Confirm password" error={confirm && !matches ? "Passwords don't match" : ''}>
          <PasswordInput
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Type it again"
          />
        </FormField>

        <div className="-mt-2 mb-4 space-y-1.5 rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs">
          <p className="font-medium text-slate-700">Password requirements:</p>
          <Rule ok={hasMinLength}>At least 8 characters</Rule>
          <Rule ok={hasLetter}>Contains at least one letter</Rule>
          <Rule ok={hasNumber}>Contains at least one number</Rule>
        </div>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        <Button type="submit" className="w-full" loading={saving}>
          Set password & continue
        </Button>
      </form>
    </AuthShell>
  );
}
