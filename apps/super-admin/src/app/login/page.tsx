'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { Shield } from 'lucide-react';

export default function SuperAdminLogin() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await authApi.login(form.email, form.password);
      if (data.user?.role !== 'SUPER_ADMIN') {
        setError('Access denied — super admin only');
        return;
      }
      localStorage.setItem('super_admin_token', data.token);
      router.push('/dashboard');
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-violet-600 rounded-2xl mb-4">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Super Admin</h1>
          <p className="text-gray-500 mt-1">Platform administration access</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
              <input type="email" className="input-dark" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required autoComplete="email" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
              <input type="password" className="input-dark" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            </div>
            {error && <div className="bg-red-900/20 border border-red-700 text-red-300 text-sm px-4 py-3 rounded-lg">{error}</div>}
            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
