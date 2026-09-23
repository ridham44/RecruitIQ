import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import AuthShell from './AuthShell.jsx';
import { useAuth } from '../../hooks/useAuth.jsx';
import FormField, { inputClass } from '../../components/ui/FormField.jsx';
import PasswordInput from '../../components/ui/PasswordInput.jsx';
import Button from '../../components/ui/Button.jsx';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterPage() {
  const { registerCompany, registerCandidate } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [role, setRole] = useState(searchParams.get('role') === 'company' ? 'COMPANY' : 'CANDIDATE');
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [touched, setTouched] = useState({ email: false, password: false, name: false });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const trimmedEmail = form.email.trim();
  const hasMinLength = form.password.length >= 8;
  const hasLetter = /[A-Za-z]/.test(form.password);
  const hasNumber = /[0-9]/.test(form.password);
  const isPasswordValid = hasMinLength && hasLetter && hasNumber;
  const isEmailValid = EMAIL_REGEX.test(trimmedEmail);

  const emailError = touched.email && trimmedEmail && !isEmailValid ? 'Please enter a valid email address' : '';
  const passwordError =
    touched.password && form.password.length > 0 && !isPasswordValid
      ? !hasMinLength
        ? 'Password must be at least 8 characters'
        : 'Password must contain at least one letter and one number'
      : '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ email: true, password: true, name: true });
    setError('');

    if (!isEmailValid) {
      setError('Please enter a valid email address');
      return;
    }

    if (!isPasswordValid) {
      if (!hasMinLength) {
        setError('Password must be at least 8 characters');
      } else {
        setError('Password must contain at least one letter and one number');
      }
      return;
    }

    setLoading(true);
    try {
      const user =
        role === 'COMPANY'
          ? await registerCompany({ email: trimmedEmail, password: form.password, companyName: form.name.trim() })
          : await registerCandidate({ email: trimmedEmail, password: form.password, fullName: form.name.trim() });
      navigate(user.role === 'COMPANY' ? '/company/dashboard' : '/candidate/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Create your account" subtitle="Start hiring or start applying in minutes">
      <div className="mb-6 flex rounded-lg border border-slate-200 p-1">
        {[
          { key: 'CANDIDATE', label: "I'm a Candidate" },
          { key: 'COMPANY', label: "I'm a Company" },
        ].map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setRole(option.key)}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              role === option.key ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <FormField label={role === 'COMPANY' ? 'Company name' : 'Full name'}>
          <input
            required
            className={inputClass}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
            placeholder={role === 'COMPANY' ? 'e.g. Acme Corp' : 'e.g. John Doe'}
          />
        </FormField>

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

        <FormField label="Password" error={passwordError}>
          <PasswordInput
            required
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
            placeholder="At least 8 characters"
          />
        </FormField>

        {/* Password Requirements Checklist */}
        <div className="-mt-2 mb-4 space-y-1.5 rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs">
          <p className="font-medium text-slate-700">Password requirements:</p>
          <div className="flex items-center gap-1.5">
            {hasMinLength ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-slate-300 ml-1 mr-1" />
            )}
            <span className={hasMinLength ? 'text-emerald-700 font-medium' : 'text-slate-500'}>
              At least 8 characters
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {hasLetter ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-slate-300 ml-1 mr-1" />
            )}
            <span className={hasLetter ? 'text-emerald-700 font-medium' : 'text-slate-500'}>
              Contains at least one letter
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {hasNumber ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-slate-300 ml-1 mr-1" />
            )}
            <span className={hasNumber ? 'text-emerald-700 font-medium' : 'text-slate-500'}>
              Contains at least one number
            </span>
          </div>
        </div>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <Button type="submit" className="w-full" loading={loading}>
          Create account
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link to="/auth/login" className="font-medium text-brand-600 hover:text-brand-700">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
