import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthShell from './AuthShell.jsx';
import { useAuth } from '../../hooks/useAuth.jsx';
import FormField, { inputClass } from '../../components/ui/FormField.jsx';
import PasswordInput from '../../components/ui/PasswordInput.jsx';
import Button from '../../components/ui/Button.jsx';

export default function RegisterPage() {
  const { registerCompany, registerCandidate } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [role, setRole] = useState(searchParams.get('role') === 'company' ? 'COMPANY' : 'CANDIDATE');
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user =
        role === 'COMPANY'
          ? await registerCompany({ email: form.email, password: form.password, companyName: form.name })
          : await registerCandidate({ email: form.email, password: form.password, fullName: form.name });
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

      <form onSubmit={handleSubmit}>
        <FormField label={role === 'COMPANY' ? 'Company name' : 'Full name'}>
          <input
            required
            className={inputClass}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </FormField>
        <FormField label="Email">
          <input
            type="email"
            required
            className={inputClass}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </FormField>
        <FormField label="Password" error="Must be at least 8 characters">
          <PasswordInput
            required
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </FormField>
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
