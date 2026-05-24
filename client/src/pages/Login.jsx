import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    fetch('/api/auth/google/status', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : { enabled: false })
      .then((d) => setGoogleEnabled(Boolean(d.enabled)))
      .catch(() => setGoogleEnabled(false));

    const err = searchParams.get('error');
    if (err === 'google_auth_failed') setError('Googleログインに失敗しました。もう一度お試しください。');
    else if (err === 'google_not_configured') setError('Googleログインは現在利用できません。');
  }, [searchParams]);

  const handleGoogleLogin = () => {
    window.location.href = '/api/auth/google';
  };

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
      <main className="flex-1 flex items-center justify-center px-6 py-8 lg:py-16">
        <div className="w-full max-w-md mx-auto lg:max-w-5xl lg:grid lg:grid-cols-2 lg:gap-16 lg:items-center">
          <div className="hidden lg:flex lg:flex-col lg:items-center lg:text-center">
            <img
              src="/tavo-logo.png"
              alt="TAVO 才能を、加速させる。"
              className="w-full max-w-[200px] h-auto"
            />
            <p className="mt-5 text-base text-gray-600 leading-relaxed">
              評価・目標・コミュニケーションを集約し、<br />
              チーム運営と選手育成をシンプルにします。
            </p>

            <ul className="mt-8 space-y-3 text-sm text-gray-700 text-left">
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

          <div>
            <img
              src="/tavo-logo.png"
              alt="TAVO 才能を、加速させる。"
              className="lg:hidden mx-auto mb-6 w-full max-w-[180px] h-auto"
            />
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

              {googleEnabled && (
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  className="w-full py-3 px-4 rounded font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-3"
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                    <path fill="#4285F4" d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.874 2.6836-6.615z"/>
                    <path fill="#34A853" d="M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9087-2.2581c-.8059.54-1.8368.8595-3.0477.8595-2.344 0-4.3282-1.5831-5.0359-3.7104H.9573v2.3318C2.4382 15.9831 5.4818 18 9 18z"/>
                    <path fill="#FBBC05" d="M3.9641 10.71c-.18-.54-.2823-1.1168-.2823-1.71s.1023-1.17.2823-1.71V4.9582H.9573C.3477 6.1731 0 7.5477 0 9c0 1.4523.3477 2.8268.9573 4.0418L3.9641 10.71z"/>
                    <path fill="#EA4335" d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.4259 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.9641 7.29C4.6718 5.1627 6.656 3.5795 9 3.5795z"/>
                  </svg>
                  Googleでログイン
                </button>
              )}

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
        </div>
      </main>
    </div>
  );
}
