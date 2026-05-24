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
    <div className="min-h-screen flex flex-col bg-slate-50">
      <main className="flex-1 px-6 py-8 lg:py-16">
        <div className="max-w-md mx-auto lg:max-w-5xl lg:grid lg:grid-cols-2 lg:gap-16 lg:items-center">
          <div className="hidden lg:block lg:pl-12">
            <img
              src="/tavo-logo.png"
              alt="TAVO 才能を、加速させる。"
              className="w-full max-w-[200px] h-auto"
            />
            <p className="mt-5 text-base text-gray-600 leading-relaxed">
              評価・目標・コミュニケーションを集約し、<br />
              チーム運営と選手育成をシンプルにします。
            </p>

            <ul className="mt-8 space-y-3 text-sm text-gray-700">
              <li className="flex items-start gap-3">
                <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-primary-600 flex-shrink-0" />
                チーム単位で選手データを一元管理
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-primary-600 flex-shrink-0" />
                評価項目をカスタマイズして継続的に記録
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-primary-600 flex-shrink-0" />
                選手・保護者・指導者をひとつの場所に
              </li>
            </ul>
          </div>

          <div className="bg-white rounded-sm lg:rounded-lg p-6 sm:p-8 lg:p-10 lg:shadow-sm lg:border lg:border-gray-200/80">
            <h2 className="hidden lg:block text-xl font-semibold text-gray-900 mb-6">
              ログイン
            </h2>

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
                  className="block w-full px-3 py-3 bg-white border border-gray-300 rounded focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
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
                  className="block w-full px-3 py-3 bg-white border border-gray-300 rounded focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
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
                className="w-full py-3 px-4 rounded text-white font-medium bg-primary-600 hover:bg-primary-700 transition-colors disabled:opacity-60"
              >
                {loading ? 'ログイン中...' : 'ログイン'}
              </button>

              <div className="border-t border-gray-200 pt-5">
                <Link
                  to="/register"
                  className="block w-full py-3 px-4 rounded font-medium border border-primary-600 text-primary-600 bg-white hover:bg-primary-50 transition-colors text-center"
                >
                  新規登録（無料）
                </Link>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
