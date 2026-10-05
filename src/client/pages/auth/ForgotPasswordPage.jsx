import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import AuthShell from './AuthShell.jsx';
import { api } from '../../services/api.js';
import FormField, { inputClass } from '../../components/ui/FormField.jsx';
import Button from '../../components/ui/Button.jsx';
import { forgotPasswordSchema } from '../../../shared/schemas/auth.schema.js';
import { checkForm } from '../../../shared/schemas/common.js';

// Forgot password — emails a one-time reset link (1 hour). The answer is the
// same whether or not the account exists.
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const { data, errors } = checkForm(forgotPasswordSchema, { email });
    setFieldErrors(errors);
    if (!data) return setError('Please fix the highlighted fields');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', data);
      setSent(true);
    } catch (err) {
      setFieldErrors(err.fields || {});
      setError(Object.keys(err.fields || {}).length ? 'Please fix the highlighted fields' : err.message);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthShell title="Check your email" subtitle={`If an account exists for ${email.trim()}, we've sent a link to reset the password.`}>
        <div className="mb-6 flex items-start gap-3 rounded-lg bg-brand-50 p-3 text-sm text-slate-700">
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
          <p>The link works once and expires in 1 hour. Don't see it? Check your spam folder, or try again in a few minutes.</p>
        </div>
        <Link to="/auth/login">
          <Button className="w-full">Back to login</Button>
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Forgot your password?" subtitle="Enter your email and we'll send you a link to reset it.">
      <form onSubmit={handleSubmit} noValidate>
        <FormField label="Email" error={fieldErrors.email}>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            maxLength={254}
            autoFocus
            className={`${inputClass} min-h-[44px]`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </FormField>
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        <Button type="submit" className="w-full" loading={loading}>
          Send reset link
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-500">
        Remembered it?{' '}
        <Link to="/auth/login" className="font-medium text-brand-600 hover:text-brand-700">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
