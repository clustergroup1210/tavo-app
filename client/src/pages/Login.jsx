import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(email, password);
      if (result.roles?.isOperator) {
        navigate('/admin');
      } else if (result.roles?.isPlayer) {
        navigate('/player-dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f3f3f3]">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <span className="text-2xl font-light tracking-tight text-gray-800 lowercase">
            pds
          </span>
        </div>
      </header>

      <main className="flex-1 px-6 py-8">
        <div className="max-w-md mx-auto bg-white p-6 sm:p-8 rounded-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm text-gray-600 mb-2">
                ログインメールアドレス
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full px-3 py-3 bg-white border border-gray-300 rounded focus:outline-none focus:border-gray-400"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm text-gray-600 mb-2">
                パスワード
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full px-3 py-3 bg-white border border-gray-300 rounded focus:outline-none focus:border-gray-400"
              />
            </div>

            <div>
              <Link
                to="/forgot-password"
                className="text-sm text-blue-600 hover:underline"
              >
                ログインでお困りの場合はこちら
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded text-white font-medium bg-[#c4a96a] hover:bg-[#b59a5b] transition-colors disabled:opacity-60"
            >
              {loading ? 'ログイン中...' : 'ログイン'}
            </button>

            <div className="border-t border-gray-200 pt-5">
              <Link
                to="/register"
                className="block w-full py-3 px-4 rounded text-white font-medium bg-[#e88341] hover:bg-[#d97431] transition-colors text-center"
              >
                新規登録（無料）
              </Link>
            </div>
          </form>
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-gray-500">
        ©PDS
      </footer>
    </div>
  );
}
