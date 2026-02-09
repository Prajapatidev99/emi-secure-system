import React, { useState } from 'react';
import { login } from '../services/api';
import Button from './common/Button';
import { UserCircleIcon, KeyIcon } from './icons';
import Spinner from './common/Spinner';

interface LoginViewProps {
  onLoginSuccess: (token: string) => void;
  onSwitchToRegister: () => void;
}

const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess, onSwitchToRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await login(email, password);
      if (data.token) {
        onLoginSuccess(data.token);
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold leading-9 tracking-tight text-white">Shopkeeper Login</h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">
        Access your dashboard to manage customers and devices.
      </p>

      <div className="mt-10">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <p className="bg-rose-900/50 text-rose-300 border border-rose-500/30 p-3 rounded-md text-center text-sm">{error}</p>}

          <div>
            <label htmlFor="email" className="block text-sm font-medium leading-6 text-slate-300">Email Address</label>
            <div className="relative mt-2">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <UserCircleIcon />
              </span>
              <input
                type="email"
                id="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="block w-full rounded-md border-0 bg-white/5 py-2.5 pl-10 pr-3 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-brand-500 sm:text-sm sm:leading-6"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium leading-6 text-slate-300">Password</label>
            <div className="relative mt-2">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <KeyIcon />
              </span>
              <input
                type="password"
                id="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="block w-full rounded-md border-0 bg-white/5 py-2.5 pl-10 pr-3 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-brand-500 sm:text-sm sm:leading-6"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div>
            <Button type="submit" className="w-full group" disabled={loading}>
              {loading ? (
                <Spinner size="sm" />
              ) : (
                'Sign in'
              )}
            </Button>
          </div>
        </form>

        {/* Sign Up Link */}
        <p className="mt-6 text-center text-sm text-slate-400">
          Don't have an account?{' '}
          <button
            onClick={onSwitchToRegister}
            className="font-semibold text-brand-400 hover:text-brand-300 transition-colors duration-200"
          >
            Sign up
          </button>
        </p>
      </div>
    </div>
  );
};

export default LoginView;