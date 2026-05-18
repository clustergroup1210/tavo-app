import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Search, Check, ChevronDown, X, Building2, UserPlus } from 'lucide-react';

export default function Register() {
  const [searchParams] = useSearchParams();
  const invitationToken = searchParams.get('token');
  const navigate = useNavigate();
  const { register } = useAuth();

  // mode: 'entry' | 'user' | 'team' | 'invite'
  const initialMode = invitationToken ? 'invite' : 'entry';
  const [mode, setMode] = useState(initialMode);

  if (mode === 'entry') {
    return (
      <Shell>
        <h2 className="text-center text-2xl font-bold text-gray-900">新規登録</h2>
        <p className="mt-2 text-center text-sm text-gray-600">登録の種類を選択してください</p>
        <div className="mt-8 grid gap-4">
          <button
            type="button"
            onClick={() => setMode('user')}
            className="text-left p-5 border-2 border-gray-200 hover:border-primary-500 hover:bg-primary-50/40 rounded-xl transition-colors"
          >
            <div className="flex items-start gap-3">
              <UserPlus className="w-6 h-6 text-primary-600 mt-0.5" />
              <div>
                <div className="font-semibold text-gray-900">ユーザー登録（既存チームに参加）</div>
                <div className="mt-1 text-sm text-gray-600">選手・保護者・スタッフとして既に登録されているチームへの参加を申請します。</div>
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setMode('team')}
            className="text-left p-5 border-2 border-gray-200 hover:border-primary-500 hover:bg-primary-50/40 rounded-xl transition-colors"
          >
            <div className="flex items-start gap-3">
              <Building2 className="w-6 h-6 text-primary-600 mt-0.5" />
              <div>
                <div className="font-semibold text-gray-900">チーム新規登録</div>
                <div className="mt-1 text-sm text-gray-600">新しいチームを登録します。システム管理者の承認後にご利用いただけます。</div>
              </div>
            </div>
          </button>
        </div>
        <p className="mt-6 text-center text-sm text-gray-600">
          すでにアカウントをお持ちの場合は{' '}
          <Link to="/login" className="font-medium text-primary-600 hover:text-primary-500">ログイン</Link>
        </p>
      </Shell>
    );
  }

  if (mode === 'team') {
    return <TeamRegisterForm onBack={() => setMode('entry')} onSwitchToUser={(team) => {
      setMode('user');
      setTimeout(() => window.__prefillTeam?.(team), 0);
    }} />;
  }

  return <UserRegisterForm
    invitationToken={invitationToken}
    register={register}
    navigate={navigate}
    onBack={mode === 'invite' ? null : () => setMode('entry')}
  />;
}

function Shell({ children }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 py-12 px-4">
      <Link to="/" className="mb-6 inline-flex items-baseline leading-none">
        <span className="text-3xl font-bold tracking-tight text-gray-900">PDS</span>
        <span className="text-3xl font-bold text-primary-600">.</span>
      </Link>
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        {children}
      </div>
      <p className="mt-6 text-xs text-gray-400">©PDS</p>
    </div>
  );
}

function TeamRegisterForm({ onBack, onSwitchToUser }) {
  const [form, setForm] = useState({
    requesterName: '', requesterEmail: '', requesterPhone: '',
    password: '', confirmPassword: '',
    desiredTeamName: '', league: '', region: '', description: '', message: '',
  });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const update = (k, v) => setForm(s => ({ ...s, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setInfo('');
    if (form.password !== form.confirmPassword) return setError('パスワードが一致しません');
    if (form.password.length < 6) return setError('パスワードは6文字以上で入力してください');

    setLoading(true);
    try {
      const res = await fetch('/api/team-registration-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterName: form.requesterName,
          requesterEmail: form.requesterEmail,
          requesterPhone: form.requesterPhone,
          password: form.password,
          desiredTeamName: form.desiredTeamName,
          league: form.league || undefined,
          region: form.region || undefined,
          description: form.description || undefined,
          message: form.message || undefined,
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data.existingTeam) {
        setError(`既にあります、申請してください。 「${data.existingTeam.name}」は既に登録されています。既存チームへの参加申請に切り替えました。`);
        onSwitchToUser?.(data.existingTeam);
        return;
      }
      if (!res.ok) {
        setError(data.error || 'チーム登録申請の送信に失敗しました');
        return;
      }
      setSubmitted(true);
      setInfo('チーム新規登録の申請を受け付けました。システム管理者の承認後、ご登録のメールアドレス宛にご連絡いたします。');
    } catch (err) {
      setError('通信エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <Shell>
        <h2 className="text-center text-2xl font-bold text-gray-900">申請を受け付けました</h2>
        <p className="mt-4 text-sm text-gray-700 leading-relaxed">{info}</p>
        <div className="mt-6 flex flex-col gap-2">
          <Link to="/login" className="block text-center py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700">ログイン画面へ</Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">チーム新規登録</h2>
        {onBack && <button type="button" onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700">戻る</button>}
      </div>
      <p className="mt-1 text-xs text-gray-500">システム管理者の承認後に作成されます。</p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

        <Field label="代表者氏名" required value={form.requesterName} onChange={v => update('requesterName', v)} />
        <Field label="メールアドレス" type="email" required value={form.requesterEmail} onChange={v => update('requesterEmail', v)} />
        <Field label="電話番号" type="tel" required value={form.requesterPhone} onChange={v => update('requesterPhone', v)} />
        <Field label="パスワード" type="password" required value={form.password} onChange={v => update('password', v)} />
        <Field label="パスワード（確認）" type="password" required value={form.confirmPassword} onChange={v => update('confirmPassword', v)} />

        <div className="pt-2 border-t border-gray-200" />
        <Field label="チーム名" required value={form.desiredTeamName} onChange={v => update('desiredTeamName', v)} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="リーグ" value={form.league} onChange={v => update('league', v)} />
          <Field label="地域" value={form.region} onChange={v => update('region', v)} />
        </div>
        <Field label="チーム紹介（任意）" textarea value={form.description} onChange={v => update('description', v)} />
        <Field label="管理者へのメッセージ（任意）" textarea value={form.message} onChange={v => update('message', v)} />

        <button type="submit" disabled={loading} className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50">
          {loading ? '送信中...' : '登録申請を送信'}
        </button>
      </form>
    </Shell>
  );
}

function UserRegisterForm({ invitationToken, register, navigate, onBack }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [requestType, setRequestType] = useState('PLAYER');
  const [playerName, setPlayerName] = useState('');
  const [message, setMessage] = useState('');
  const [teams, setTeams] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTeamSelection, setShowTeamSelection] = useState(!invitationToken);

  const [teamSearch, setTeamSearch] = useState('');
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false);
  const teamSelectorRef = useRef(null);

  useEffect(() => {
    if (!invitationToken) {
      fetch('/api/teams/public').then(r => r.ok ? r.json() : []).then(setTeams).catch(() => {});
    }
    window.__prefillTeam = (t) => {
      if (!t) return;
      setTeams(prev => prev.some(p => p.id === t.id) ? prev : [t, ...prev]);
      setSelectedTeamId(t.id);
      setShowTeamSelection(true);
    };
    return () => { delete window.__prefillTeam; };
  }, [invitationToken]);

  useEffect(() => { if (name && !playerName) setPlayerName(name); }, [name]);

  useEffect(() => {
    const h = (e) => { if (teamSelectorRef.current && !teamSelectorRef.current.contains(e.target)) setTeamDropdownOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const filteredTeams = useMemo(() => {
    const q = teamSearch.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter(t => {
      const n = (t.name || '').toLowerCase();
      const r = (t.region || '').toLowerCase();
      const l = (t.league || '').toLowerCase();
      return n.includes(q) || r.includes(q) || l.includes(q);
    });
  }, [teams, teamSearch]);

  const selectedTeam = useMemo(() => teams.find(t => t.id === selectedTeamId) || null, [teams, selectedTeamId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) return setError('パスワードが一致しません');
    if (password.length < 6) return setError('パスワードは6文字以上で入力してください');
    if (showTeamSelection && selectedTeamId && requestType === 'PLAYER' && !playerName) return setError('選手名を入力してください');
    if (showTeamSelection && !selectedTeamId && !invitationToken) return setError('参加するチームを選択してください');

    setLoading(true);
    try {
      await register(email, password, name, invitationToken);
      let warning = null;
      if (!invitationToken && showTeamSelection && selectedTeamId) {
        const res = await fetch('/api/join-requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            teamId: selectedTeamId,
            playerName: requestType === 'STAFF' ? name : playerName,
            phone: phone || undefined,
            message,
            requestType,
          })
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          warning = data.error || 'チーム参加申請の作成に失敗しました';
        }
      }
      if (warning) alert(`アカウントは作成されましたが、チーム参加申請に失敗しました：\n${warning}\nダッシュボードから再度申請できます。`);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Shell>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">ユーザー登録</h2>
        {onBack && <button type="button" onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700">戻る</button>}
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

        <Field label="お名前" required value={name} onChange={setName} />
        <Field label="メールアドレス" type="email" required value={email} onChange={setEmail} />
        <Field label="電話番号" type="tel" value={phone} onChange={setPhone} hint="チーム管理者・運営者への連絡先として申請時に共有されます" />
        <Field label="パスワード" type="password" required value={password} onChange={setPassword} />
        <Field label="パスワード（確認）" type="password" required value={confirmPassword} onChange={setConfirmPassword} />

        {!invitationToken && (
          <div className="pt-2 border-t border-gray-200 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">登録区分</label>
              <div className="grid grid-cols-2 gap-2">
                {['PLAYER', 'STAFF'].map(t => (
                  <button key={t} type="button" onClick={() => setRequestType(t)}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-sm font-medium ${
                      requestType === t ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}>
                    {requestType === t && <Check className="w-4 h-4" />}
                    {t === 'PLAYER' ? '選手として参加' : 'スタッフとして参加'}
                  </button>
                ))}
              </div>
            </div>

            <div ref={teamSelectorRef} className="relative">
              <label className="block text-sm font-medium text-gray-700">参加したいチーム</label>
              {selectedTeam ? (
                <div className="mt-1 flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg bg-white">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-900 truncate">{selectedTeam.name}</p>
                    {(selectedTeam.region || selectedTeam.league) && (
                      <p className="text-xs text-gray-500 truncate">{[selectedTeam.region, selectedTeam.league].filter(Boolean).join(' / ')}</p>
                    )}
                  </div>
                  <button type="button" onClick={() => { setSelectedTeamId(''); setTeamSearch(''); }} className="ml-2 p-1 text-gray-400 hover:text-gray-600 rounded">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="mt-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <input type="text" value={teamSearch}
                      onChange={(e) => { setTeamSearch(e.target.value); setTeamDropdownOpen(true); }}
                      onFocus={() => setTeamDropdownOpen(true)}
                      placeholder="チーム名・地域・リーグで検索"
                      className="block w-full pl-9 pr-9 py-2 border border-gray-300 rounded-lg shadow-sm text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" />
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                  {teamDropdownOpen && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredTeams.length > 0 ? filteredTeams.map(team => (
                        <button type="button" key={team.id}
                          onClick={() => { setSelectedTeamId(team.id); setTeamDropdownOpen(false); setTeamSearch(''); }}
                          className="w-full text-left px-3 py-2 hover:bg-primary-50 border-b last:border-b-0 border-gray-100">
                          <p className="text-sm text-gray-900">{team.name}</p>
                          {(team.region || team.league) && (
                            <p className="text-xs text-gray-500 truncate">{[team.region, team.league].filter(Boolean).join(' / ')}</p>
                          )}
                        </button>
                      )) : (
                        <div className="px-3 py-4 text-sm text-gray-500 text-center">
                          該当するチームが見つかりません。<br />
                          <Link to="/register" className="text-primary-600 hover:underline">チームを新規登録する</Link>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {selectedTeamId && requestType === 'PLAYER' && (
              <Field label="選手名" required value={playerName} onChange={setPlayerName} placeholder="チームに登録される名前" />
            )}
            {selectedTeamId && (
              <Field label="メッセージ（任意）" textarea value={message} onChange={setMessage} placeholder="チーム管理者へのメッセージ" />
            )}
            {selectedTeamId && (
              <p className="text-xs text-gray-500">
                チーム管理者が申請を承認すると、{requestType === 'STAFF' ? 'スタッフとして' : '選手として'}チームに参加できます
              </p>
            )}
          </div>
        )}

        <button type="submit" disabled={loading} className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50">
          {loading ? '登録中...' : '登録'}
        </button>

        <p className="text-center text-sm text-gray-600">
          すでにアカウントをお持ちの場合は{' '}
          <Link to="/login" className="font-medium text-primary-600 hover:text-primary-500">ログイン</Link>
        </p>
      </form>
    </Shell>
  );
}

function Field({ label, value, onChange, type = 'text', required, textarea, placeholder, hint }) {
  const cls = "mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500";
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}{required && <span className="text-red-500 ml-1">*</span>}</label>
      {textarea ? (
        <textarea rows={2} value={value} onChange={(e) => onChange(e.target.value)} required={required} placeholder={placeholder} className={cls} />
      ) : (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} placeholder={placeholder} className={cls} />
      )}
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}
