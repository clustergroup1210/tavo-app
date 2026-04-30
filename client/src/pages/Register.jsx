import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Search, Check, ChevronDown, X } from 'lucide-react';

export default function Register() {
  const [searchParams] = useSearchParams();
  const invitationToken = searchParams.get('token');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [requestType, setRequestType] = useState('PLAYER');
  const [playerName, setPlayerName] = useState('');
  const [message, setMessage] = useState('');
  const [teams, setTeams] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTeamSelection, setShowTeamSelection] = useState(false);

  const [teamSearch, setTeamSearch] = useState('');
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false);
  const teamSelectorRef = useRef(null);

  const { register } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!invitationToken) {
      fetchTeams();
    }
  }, [invitationToken]);

  useEffect(() => {
    if (name && !playerName) {
      setPlayerName(name);
    }
  }, [name]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (teamSelectorRef.current && !teamSelectorRef.current.contains(e.target)) {
        setTeamDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchTeams = async () => {
    try {
      const res = await fetch('/api/teams/public');
      if (res.ok) {
        const data = await res.json();
        setTeams(data);
      }
    } catch (error) {
      console.error('Failed to fetch teams:', error);
    }
  };

  const filteredTeams = useMemo(() => {
    const q = teamSearch.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter(t => {
      const name = (t.name || '').toLowerCase();
      const region = (t.region || '').toLowerCase();
      const league = (t.league || '').toLowerCase();
      return name.includes(q) || region.includes(q) || league.includes(q);
    });
  }, [teams, teamSearch]);

  const selectedTeam = useMemo(
    () => teams.find(t => t.id === selectedTeamId) || null,
    [teams, selectedTeamId]
  );

  const handleSelectTeam = (teamId) => {
    setSelectedTeamId(teamId);
    setTeamDropdownOpen(false);
    setTeamSearch('');
  };

  const handleClearTeam = () => {
    setSelectedTeamId('');
    setTeamSearch('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('パスワードが一致しません');
      return;
    }

    if (password.length < 6) {
      setError('パスワードは6文字以上で入力してください');
      return;
    }

    if (showTeamSelection && selectedTeamId && requestType === 'PLAYER' && !playerName) {
      setError('選手名を入力してください');
      return;
    }

    setLoading(true);

    try {
      await register(email, password, name, invitationToken);

      let joinRequestWarning = null;
      if (!invitationToken && showTeamSelection && selectedTeamId) {
        try {
          const res = await fetch('/api/join-requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              teamId: selectedTeamId,
              playerName: requestType === 'STAFF' ? name : playerName,
              message,
              requestType,
            })
          });

          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            joinRequestWarning = data.error || 'チーム参加申請の作成に失敗しました';
          }
        } catch (err) {
          console.error('Failed to create join request:', err);
          joinRequestWarning = 'チーム参加申請の作成に失敗しました';
        }
      }

      if (joinRequestWarning) {
        alert(`アカウントは作成されましたが、チーム参加申請に失敗しました：\n${joinRequestWarning}\nダッシュボードから再度申請できます。`);
      }

      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
            新規登録
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            アカウントを作成してください
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                お名前
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                メールアドレス
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                パスワード
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                パスワード（確認）
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            {!invitationToken && teams.length > 0 && (
              <div className="pt-4 border-t border-gray-200">
                <div className="flex items-center gap-2 mb-4">
                  <input
                    id="joinTeam"
                    type="checkbox"
                    checked={showTeamSelection}
                    onChange={(e) => setShowTeamSelection(e.target.checked)}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="joinTeam" className="text-sm font-medium text-gray-700">
                    チームへの参加を申請する
                  </label>
                </div>

                {showTeamSelection && (
                  <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        登録区分
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setRequestType('PLAYER')}
                          className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                            requestType === 'PLAYER'
                              ? 'bg-primary-600 text-white border-primary-600'
                              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {requestType === 'PLAYER' && <Check className="w-4 h-4" />}
                          選手として参加
                        </button>
                        <button
                          type="button"
                          onClick={() => setRequestType('STAFF')}
                          className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                            requestType === 'STAFF'
                              ? 'bg-primary-600 text-white border-primary-600'
                              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {requestType === 'STAFF' && <Check className="w-4 h-4" />}
                          スタッフとして参加
                        </button>
                      </div>
                    </div>

                    <div ref={teamSelectorRef} className="relative">
                      <label className="block text-sm font-medium text-gray-700">
                        参加したいチーム
                      </label>

                      {selectedTeam ? (
                        <div className="mt-1 flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg bg-white">
                          <div className="min-w-0">
                            <p className="text-sm text-gray-900 truncate">{selectedTeam.name}</p>
                            {(selectedTeam.region || selectedTeam.league) && (
                              <p className="text-xs text-gray-500 truncate">
                                {[selectedTeam.region, selectedTeam.league].filter(Boolean).join(' / ')}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={handleClearTeam}
                            className="ml-2 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                            aria-label="選択を解除"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="mt-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            <input
                              type="text"
                              value={teamSearch}
                              onChange={(e) => { setTeamSearch(e.target.value); setTeamDropdownOpen(true); }}
                              onFocus={() => setTeamDropdownOpen(true)}
                              placeholder="チーム名・地域・リーグで検索"
                              className="block w-full pl-9 pr-9 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-sm"
                            />
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                          </div>

                          {teamDropdownOpen && (
                            <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                              {filteredTeams.length > 0 ? (
                                filteredTeams.map(team => (
                                  <button
                                    type="button"
                                    key={team.id}
                                    onClick={() => handleSelectTeam(team.id)}
                                    className="w-full text-left px-3 py-2 hover:bg-primary-50 border-b last:border-b-0 border-gray-100"
                                  >
                                    <p className="text-sm text-gray-900">{team.name}</p>
                                    {(team.region || team.league) && (
                                      <p className="text-xs text-gray-500 truncate">
                                        {[team.region, team.league].filter(Boolean).join(' / ')}
                                      </p>
                                    )}
                                  </button>
                                ))
                              ) : (
                                <div className="px-3 py-4 text-sm text-gray-500 text-center">
                                  該当するチームが見つかりません
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {selectedTeamId && (
                      <>
                        {requestType === 'PLAYER' && (
                          <div>
                            <label htmlFor="playerName" className="block text-sm font-medium text-gray-700">
                              選手名
                            </label>
                            <input
                              id="playerName"
                              type="text"
                              value={playerName}
                              onChange={(e) => setPlayerName(e.target.value)}
                              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                              placeholder="チームに登録される名前"
                            />
                          </div>
                        )}

                        <div>
                          <label htmlFor="message" className="block text-sm font-medium text-gray-700">
                            メッセージ（任意）
                          </label>
                          <textarea
                            id="message"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            rows={2}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                            placeholder="チーム管理者へのメッセージ"
                          />
                        </div>

                        <p className="text-xs text-gray-500">
                          チーム管理者が申請を承認すると、{requestType === 'STAFF' ? 'スタッフとして' : '選手として'}チームに参加できます
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
          >
            {loading ? '登録中...' : '登録'}
          </button>

          <p className="text-center text-sm text-gray-600">
            すでにアカウントをお持ちの場合は{' '}
            <Link to="/login" className="font-medium text-primary-600 hover:text-primary-500">
              ログイン
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
