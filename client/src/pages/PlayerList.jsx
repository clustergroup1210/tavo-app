import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { UserCircle, Plus, ChevronUp, ChevronDown, Filter, X, Trash2, RotateCcw, GraduationCap } from 'lucide-react';
import Pagination, { usePagination } from '../components/Pagination';

export default function PlayerList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentTeam, isCoach, isOperator } = useAuth();
  const [players, setPlayers] = useState([]);
  const [teamCategories, setTeamCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlayer, setNewPlayer] = useState({ name: '', number: '', position: '', teamCategoryId: '', email: '', password: '', createAccount: true });
  const [createError, setCreateError] = useState('');

  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [filterCategory, setFilterCategory] = useState(searchParams.get('categoryId') || '');
  const [filterPosition, setFilterPosition] = useState('');
  const [includeGraduated, setIncludeGraduated] = useState(false);
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    if (currentTeam) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [currentTeam, includeGraduated, includeDeleted]);

  const handleAuthError = () => {
    setCreateError('セッションの有効期限が切れました。再度ログインしてください。');
    setTimeout(() => {
      navigate('/login');
    }, 1500);
  };

  const fetchData = async () => {
    try {
      const params = new URLSearchParams({
        teamId: currentTeam.id,
        includeChildren: 'true',
      });
      if (includeGraduated) params.set('includeGraduated', 'true');
      if (includeDeleted) params.set('includeDeleted', 'true');
      const [playersRes, categoriesRes] = await Promise.all([
        fetch(`/api/players?${params.toString()}`, { credentials: 'include' }),
        fetch(`/api/team-categories?teamId=${currentTeam.id}`, { credentials: 'include' })
      ]);

      if (playersRes.status === 401 || categoriesRes.status === 401) {
        handleAuthError();
        return;
      }

      if (playersRes.ok) {
        const data = await playersRes.json();
        setPlayers(Array.isArray(data) ? data : []);
      }
      if (categoriesRes.ok) {
        const data = await categoriesRes.json();
        setTeamCategories(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlayer = async (e) => {
    e.preventDefault();
    if (!currentTeam) return;
    setCreateError('');

    if (newPlayer.createAccount && (!newPlayer.email || !newPlayer.password)) {
      setCreateError('アカウントを作成する場合、メールアドレスとパスワードは必須です');
      return;
    }
    if (newPlayer.createAccount && newPlayer.password && newPlayer.password.length < 6) {
      setCreateError('パスワードは6文字以上で入力してください');
      return;
    }
    
    try {
      const body = { 
        name: newPlayer.name,
        number: newPlayer.number,
        position: newPlayer.position,
        teamId: currentTeam.id,
        teamCategoryId: newPlayer.teamCategoryId || null
      };
      if (newPlayer.createAccount && newPlayer.email) {
        body.email = newPlayer.email;
        body.password = newPlayer.password;
      }

      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (res.status === 401) {
        handleAuthError();
        return;
      }
      if (res.ok) {
        setNewPlayer({ name: '', number: '', position: '', teamCategoryId: '', email: '', password: '', createAccount: true });
        setShowCreateModal(false);
        fetchData();
      } else {
        const data = await res.json();
        setCreateError(data.error || '選手の登録に失敗しました');
      }
    } catch (error) {
      console.error('Failed to create player:', error);
      setCreateError('選手の登録に失敗しました');
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? 
      <ChevronUp className="w-4 h-4 inline ml-1" /> : 
      <ChevronDown className="w-4 h-4 inline ml-1" />;
  };

  const isPlayerGraduated = (player) => {
    if (!player.graduationDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(player.graduationDate) <= today;
  };

  const canManagePlayer = (player) => {
    if (isOperator()) return true;
    if (player?.teamId && isCoach(player.teamId)) return true;
    return false;
  };

  const handleDeletePlayer = async (player) => {
    if (!confirm(`「${player.name}」を削除します。一覧から非表示になりますが、データは保持され、後から復元できます。よろしいですか？`)) return;
    setActionError('');
    try {
      const res = await fetch(`/api/players/${player.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.status === 401) {
        handleAuthError();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '削除に失敗しました');
      fetchData();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleRestorePlayer = async (player) => {
    setActionError('');
    try {
      const res = await fetch(`/api/players/${player.id}/restore`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.status === 401) {
        handleAuthError();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '復元に失敗しました');
      fetchData();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const sortedAndFilteredPlayers = () => {
    let result = [...players];

    if (filterCategory) {
      result = result.filter(p => p.teamCategoryId === filterCategory);
    }

    if (filterPosition) {
      result = result.filter(p => p.position === filterPosition);
    }

    result.sort((a, b) => {
      let aVal = a[sortField] || '';
      let bVal = b[sortField] || '';
      
      if (sortField === 'number') {
        aVal = parseInt(aVal) || 999;
        bVal = parseInt(bVal) || 999;
      }
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  };

  const handleCategoryChange = (value) => {
    setFilterCategory(value);
    if (value) {
      setSearchParams({ categoryId: value });
    } else {
      setSearchParams({});
    }
  };

  const clearFilters = () => {
    setFilterCategory('');
    setFilterPosition('');
    setSearchParams({});
  };

  const hasActiveFilters = filterCategory || filterPosition || includeGraduated || includeDeleted;

  const { page, pageSize, setPage, setPageSize, paginate, reset: resetPagination } = usePagination(25);

  const displayPlayers = sortedAndFilteredPlayers();
  const pagedPlayers = paginate(displayPlayers);

  useEffect(() => {
    resetPagination();
  }, [filterCategory, filterPosition, includeGraduated, includeDeleted, sortField, sortDirection, resetPagination]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">選手一覧</h1>
          <p className="mt-1 text-sm text-gray-500">{players.length}名の選手</p>
        </div>
        {currentTeam && (isOperator() || isCoach(currentTeam.id)) && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus className="w-4 h-4" />
            選手登録
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">フィルター:</span>
          </div>

          <div>
            <select
              value={filterCategory}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg"
            >
              <option value="">全カテゴリー</option>
              {teamCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={filterPosition}
              onChange={(e) => setFilterPosition(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg"
            >
              <option value="">全ポジション</option>
              <option value="GK">GK</option>
              <option value="DF">DF</option>
              <option value="MF">MF</option>
              <option value="FW">FW</option>
            </select>
          </div>

          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              checked={includeGraduated}
              onChange={(e) => setIncludeGraduated(e.target.checked)}
              className="rounded"
            />
            卒業済みも表示
          </label>

          {(isOperator() || (currentTeam && isCoach(currentTeam.id))) && (
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                checked={includeDeleted}
                onChange={(e) => setIncludeDeleted(e.target.checked)}
                className="rounded"
              />
              削除済みも表示
            </label>
          )}

          {hasActiveFilters && (
            <button
              onClick={() => { clearFilters(); setIncludeGraduated(false); setIncludeDeleted(false); }}
              className="inline-flex items-center gap-1 px-2 py-1 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
            >
              <X className="w-4 h-4" />
              クリア
            </button>
          )}

          <div className="ml-auto text-sm text-gray-500">
            {displayPlayers.length}件該当
          </div>
        </div>
      </div>

      {actionError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {actionError}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th 
                className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('name')}
              >
                選手 {getSortIcon('name')}
              </th>
              <th 
                className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('number')}
              >
                No. {getSortIcon('number')}
              </th>
              <th 
                className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('position')}
              >
                Pos {getSortIcon('position')}
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                カテゴリー
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                状態
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {displayPlayers.map((player) => {
              const graduated = isPlayerGraduated(player);
              const deleted = !!player.deletedAt;
              return (
                <tr key={player.id} className={`hover:bg-gray-50 ${deleted ? 'bg-red-50/40 opacity-70' : ''}`}>
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    <Link to={`/players/${player.id}`} className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        {player.photoUrl ? (
                          <img src={player.photoUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                        ) : (
                          <UserCircle className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                      <span className={`text-sm font-medium hover:text-primary-600 ${deleted ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                        {player.name}
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-sm text-gray-500">
                    {player.number || '-'}
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-sm text-gray-500">
                    {player.position || '-'}
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-sm text-gray-500">
                    {player.teamCategory?.name || '-'}
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    <div className="flex flex-wrap gap-1">
                      {deleted && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">
                          <Trash2 className="w-3 h-3" />削除済み
                        </span>
                      )}
                      {graduated && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-200 text-gray-700 rounded text-xs font-medium">
                          <GraduationCap className="w-3 h-3" />卒業済み
                        </span>
                      )}
                      {!deleted && !graduated && (
                        <span className="inline-flex items-center px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs font-medium">在籍中</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-right">
                    {canManagePlayer(player) && (
                      deleted ? (
                        <button
                          onClick={() => handleRestorePlayer(player)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-indigo-700 hover:bg-indigo-50 rounded"
                          title="復元"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />復元
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDeletePlayer(player)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                          title="削除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />削除
                        </button>
                      )
                    )}
                  </td>
                </tr>
              );
            })}
            {displayPlayers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                  {hasActiveFilters ? '条件に一致する選手がいません' : '選手が登録されていません'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">選手登録</h2>
              <button onClick={() => { setShowCreateModal(false); setCreateError(''); }} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            {createError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {createError}
              </div>
            )}
            <form onSubmit={handleCreatePlayer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">名前 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={newPlayer.name}
                  onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">背番号</label>
                  <input
                    type="text"
                    value={newPlayer.number}
                    onChange={(e) => setNewPlayer({ ...newPlayer, number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ポジション</label>
                  <select
                    value={newPlayer.position}
                    onChange={(e) => setNewPlayer({ ...newPlayer, position: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">選択</option>
                    <option value="GK">GK</option>
                    <option value="DF">DF</option>
                    <option value="MF">MF</option>
                    <option value="FW">FW</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">カテゴリー</label>
                <select
                  value={newPlayer.teamCategoryId}
                  onChange={(e) => setNewPlayer({ ...newPlayer, teamCategoryId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">なし</option>
                  {teamCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newPlayer.createAccount}
                    onChange={(e) => setNewPlayer({ ...newPlayer, createAccount: e.target.checked })}
                    className="w-4 h-4 text-primary-600 rounded border-gray-300"
                  />
                  <span className="text-sm font-medium text-gray-700">ログインアカウントも同時に作成する</span>
                </label>
                <p className="text-xs text-gray-500 mt-1 ml-6">
                  {newPlayer.createAccount 
                    ? '選手がシステムにログインできるようになります' 
                    : 'アカウントなしで選手情報のみ登録します（後から招待URLで作成可能）'}
                </p>
              </div>

              {newPlayer.createAccount && (
                <div className="space-y-3 bg-gray-50 rounded-lg p-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス <span className="text-red-500">*</span></label>
                    <input
                      type="email"
                      value={newPlayer.email}
                      onChange={(e) => setNewPlayer({ ...newPlayer, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="player@example.com"
                      required={newPlayer.createAccount}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">パスワード <span className="text-red-500">*</span></label>
                    <input
                      type="password"
                      value={newPlayer.password}
                      onChange={(e) => setNewPlayer({ ...newPlayer, password: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="6文字以上"
                      minLength={6}
                      required={newPlayer.createAccount}
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowCreateModal(false); setCreateError(''); }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  登録
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
