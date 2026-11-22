import { useState } from 'react';
import { useAuth } from '../AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button, inputCls, labelCls } from '../components/ui';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch {
      setError('ইমেইল বা পাসওয়ার্ড ভুল হয়েছে।');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0E3B2C] px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
        <div className="mb-6 text-center">
          <img src="/logo.png" alt="Taqwa Gadget Zone" className="mx-auto h-auto w-48 sm:w-56" />
          <p className="mt-3 text-sm text-slate-500">স্টক ম্যানেজমেন্ট ও ব্যবসার হিসাব</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>ইমেইল</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              className={inputCls}
              placeholder="আপনার ইমেইল"
            />
          </div>
          <div>
            <label className={labelCls}>পাসওয়ার্ড</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className={inputCls}
              placeholder="পাসওয়ার্ড"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <Button type="submit" variant="primary" disabled={loading} className="w-full py-3">
            {loading ? 'লগইন হচ্ছে...' : 'লগইন করুন'}
          </Button>
        </form>
      </div>
    </div>
  );
}
