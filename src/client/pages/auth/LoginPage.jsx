import { useState } from 'react';
// import { Link, useNavigate } from 'react-router-dom';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthShell from './AuthShell.jsx';
import { useAuth } from '../../hooks/useAuth.jsx';
import FormField, { inputClass } from '../../components/ui/FormField.jsx';
import PasswordInput from '../../components/ui/PasswordInput.jsx';
import Button from '../../components/ui/Button.jsx';
import { homePathForRole } from '../../utils/homePath.js';
import { loginSchema } from '../../../shared/schemas/auth.schema.js';
import { checkForm } from '../../../shared/schemas/common.js';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  // const [form, setForm] = useState({ email: '', password: '' });
  // "Start here" demo page links to /auth/login?email=… to pre-fill the email.
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({ email: searchParams.get('email') || '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const { data, errors } = checkForm(loginSchema, form);
    setFieldErrors(errors);
    if (!data) return setError('Please fix the highlighted fields');

    setLoading(true);
    try {
      const user = await login(data.email, data.password);
      // navigate(user.role === 'COMPANY' ? '/company/dashboard' : '/candidate/dashboard');
      navigate(homePathForRole(user.role));
    } catch (err) {
      setFieldErrors(err.fields || {});
      setError(Object.keys(err.fields || {}).length ? 'Please fix the highlighted fields' : err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Log in to your RecruitIQ account">
      <form onSubmit={handleSubmit} noValidate>
        <FormField label="Email" error={fieldErrors.email}>
          <input
            type="email"
            inputMode="email"
            required
            className={`${inputClass} min-h-[44px]`}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            autoComplete="email"
            maxLength={254}
            placeholder="you@example.com"
          />
        </FormField>
        <FormField label="Password" error={fieldErrors.password}>
          <PasswordInput
            required
            className="min-h-[44px]"
            autoComplete="current-password"
            maxLength={200}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="Enter your password"
          />
        </FormField>
        {/* Forgot password */}
        <div className="-mt-2 mb-4 text-right">
          <Link
            to="/auth/forgot-password"
            className="inline-flex min-h-[44px] items-center text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            Forgot password?
          </Link>
        </div>
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        <Button type="submit" className="w-full" loading={loading}>
          Log in
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-500">
        Don't have an account?{' '}
        <Link to="/auth/register" className="font-medium text-brand-600 hover:text-brand-700">
          Register
        </Link>
      </p>
    </AuthShell>
  );
}
