import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { register } from '../api/auth';
import { ApiError } from '../api/client';
import { Button, FieldRow, Input } from '../components/ui';

interface FieldError {
  field?: string | undefined;
  message: string;
}

export function Register() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<FieldError | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(email, password, name);
      navigate('/app');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? { field: err.field, message: err.message }
          : { message: 'Something went wrong. Try again.' },
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-sm flex-col justify-center px-4 py-16 sm:px-6">
      <h1 className="text-xl font-semibold">Create an account</h1>
      <p className="mt-1 text-sm text-ink-muted">Save and compare your shelter designs.</p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5" noValidate>
        <FieldRow label="Name" htmlFor="name" error={error?.field === 'name' ? error.message : undefined}>
          <Input
            id="name"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </FieldRow>
        <FieldRow label="Email" htmlFor="email" error={error?.field === 'email' ? error.message : undefined}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </FieldRow>
        <FieldRow
          label="Password"
          htmlFor="password"
          hint="At least 8 characters."
          error={error?.field === 'password' ? error.message : undefined}
        >
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </FieldRow>
        {error && !error.field ? <p className="text-xs text-thermal-hottest">{error.message}</p> : null}
        <Button type="submit" disabled={loading}>
          {loading ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <p className="mt-6 text-sm text-ink-muted">
        Already have an account?{' '}
        <Link to="/login" className="text-accent hover:text-accent-hover">
          Log in
        </Link>
      </p>
    </div>
  );
}
