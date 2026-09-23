import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell from './AuthShell.jsx';
import { useAuth } from '../../hooks/useAuth.jsx';
import FormField, { inputClass } from '../../components/ui/FormField.jsx';
import PasswordInput from '../../components/ui/PasswordInput.jsx';
import Button from '../../components/ui/Button.jsx';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [touched, setTouched] = useState({ email: false, password: false });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const trimmedEmail = form.email.trim();
  const isEmailValid = EMAIL_REGEX.test(trimmedEmail);
  const emailError = touched.email && trimmedEmail && !isEmailValid ? 'Please enter a valid email address' : '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    setError('');

    if (!trimmedEmail) {
      setError('Please enter your email');
      return;
    }

    if (!isEmailValid) {
      setError('Please enter a valid email address');
      return;
    }

    if (!form.password) {
      setError('Please enter your password');
      return;
    }

    setLoading(true);
    try {
      const user = await login(trimmedEmail, form.password);
      navigate(user.role === 'COMPANY' ? '/company/dashboard' : '/candidate/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Log in to your RecruitIQ account">
      <form onSubmit={handleSubmit} noValidate>
        <FormField label="Email" error={emailError}>
          <input
            type="email"
            required
            className={inputClass}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
            placeholder="you@example.com"
          />
        </FormField>
        <FormField label="Password">
          <PasswordInput
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
            placeholder="Enter your password"
          />
        </FormField>
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
