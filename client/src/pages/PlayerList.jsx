import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { UserCircle, Plus, ChevronUp, ChevronDown, Filter, X } from 'lucide-react';

export default function PlayerList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentTeam, isCoach, isOperator } = useAuth();
  const [players, setPlayers] = useState([]);
  const [teamCategories, setTeamCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlayer, setNewPlayer] = useState({ name: '', number: '', position: '', teamCategoryId: '' });

  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [filterCategory, setFilterCategory] = useState(searchParams.get('categoryId') || '');
  const [filterPosition, setFilterPosition] = useState('');

  useEffect(() => {
    if (currentTeam) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [currentTeam]);

  const fetchData = async () => {
    try {
      const [playersRes, categoriesRes] = await Promise.all([
        fetch(`/api/players?teamId=${currentTeam.id}&includeChildren=true`, { credentials: 'include' }),
        fetch(`/api/team-categories?teamId=${currentTeam.id}`, { credentials: 'include' })
      ]);
      
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
    
    try {
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          name: newPlayer.name,
          number: newPlayer.number,
          position: newPlayer.position,
          teamId: currentTeam.id,
          teamCategoryId: newPlayer.teamCategoryId || null
        }),
      });
      if (res.ok) {
        setNewPlayer({ name: '', number: '', position: '', teamCategoryId: '' });
        setShowCreateModal(false);
        fetchData();
      }
    } catch (error) {
      console.error('Failed to create player:', error);
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

  const hasActiveFilters = filterCategory || filterPosition;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const displayPlayers = sortedAndFilteredPlayers();

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

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 px-2 py-1 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
            >
              <X className="w-4 h-4" />
              クリア
            </button>
          )}

          <div className="ml-auto text-sm text-gray-500">
            {displayPlayers.length}件表示
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('name')}
              >
                選手 {getSortIcon('name')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('number')}
              >
                背番号 {getSortIcon('number')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('position')}
              >
                ポジション {getSortIcon('position')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                カテゴリー
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {displayPlayers.map((player) => (
              <tr key={player.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <Link to={`/players/${player.id}`} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                      <UserCircle className="w-6 h-6 text-gray-400" />
                    </div>
                    <span className="font-medium text-gray-900 hover:text-primary-600">
                      {player.name}
                    </span>
                  </Link>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {player.number || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {player.position || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {player.teamCategory?.name || '-'}
                </td>
              </tr>
            ))}
            {displayPlayers.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                  {hasActiveFilters ? '条件に一致する選手がいません' : '選手が登録されていません'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">選手登録</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleCreatePlayer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">名前</label>
                <input
                  type="text"
                  value={newPlayer.name}
                  onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
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
                  <option value="">選択してください</option>
                  <option value="GK">GK</option>
                  <option value="DF">DF</option>
                  <option value="MF">MF</option>
                  <option value="FW">FW</option>
                </select>
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
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
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
