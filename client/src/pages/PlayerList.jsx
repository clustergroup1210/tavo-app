import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { UserCircle, Plus, ChevronUp, ChevronDown, Filter, X } from 'lucide-react';

export default function PlayerList() {
  const { currentTeam, isCoach, isOperator } = useAuth();
  const [players, setPlayers] = useState([]);
  const [parentTeams, setParentTeams] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlayer, setNewPlayer] = useState({ name: '', number: '', position: '', teamId: '' });

  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [filterParentTeam, setFilterParentTeam] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterPosition, setFilterPosition] = useState('');

  useEffect(() => {
    fetchAllTeams();
  }, [currentTeam]);

  useEffect(() => {
    if (currentTeam || isOperator()) {
      fetchPlayers();
    }
  }, [currentTeam, filterParentTeam]);
  
  const getDefaultTeamId = () => {
    return filterCategory || filterParentTeam || currentTeam?.id || (categories.length > 0 ? categories[0].id : '');
  };

  useEffect(() => {
    if (categories.length > 0 && !newPlayer.teamId) {
      setNewPlayer(prev => ({ ...prev, teamId: getDefaultTeamId() }));
    }
  }, [categories]);

  useEffect(() => {
    const newTeamId = getDefaultTeamId();
    if (newTeamId) {
      setNewPlayer(prev => ({ ...prev, teamId: newTeamId }));
    }
  }, [filterCategory, filterParentTeam, currentTeam]);
  
  const openCreateModal = () => {
    setNewPlayer({ name: '', number: '', position: '', teamId: getDefaultTeamId() });
    setShowCreateModal(true);
  };

  const fetchPlayers = async () => {
    try {
      let url = '/api/players';
      const params = new URLSearchParams();
      
      if (filterParentTeam) {
        params.append('teamId', filterParentTeam);
        params.append('includeChildren', 'true');
      } else if (currentTeam) {
        params.append('teamId', currentTeam.id);
        params.append('includeChildren', 'true');
      } else if (isOperator()) {
      }
      
      if (params.toString()) {
        url += '?' + params.toString();
      }
      
      const res = await fetch(url, { credentials: 'include' });
      const data = await res.json();
      setPlayers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch players:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllTeams = async () => {
    try {
      const cats = [];
      
      if (isOperator()) {
        const res = await fetch('/api/teams', { credentials: 'include' });
        const teams = await res.json();
        setParentTeams(Array.isArray(teams) ? teams : []);
        
        if (Array.isArray(teams)) {
          teams.forEach(team => {
            cats.push({ id: team.id, name: team.name, parentId: null });
            if (team.children) {
              team.children.forEach(child => {
                cats.push({ id: child.id, name: child.name, parentId: team.id, parentName: team.name });
              });
            }
          });
        }
      } else if (currentTeam) {
        const teamRes = await fetch(`/api/teams/${currentTeam.id}`, { credentials: 'include' });
        const teamData = await teamRes.json();
        if (teamData) {
          if (teamData.parent) {
            const parentRes = await fetch(`/api/teams/${teamData.parent.id}`, { credentials: 'include' });
            const parentData = await parentRes.json();
            if (parentData) {
              cats.push({ id: parentData.id, name: parentData.name, parentId: null });
              if (parentData.children) {
                parentData.children.forEach(child => {
                  cats.push({ id: child.id, name: child.name, parentId: parentData.id, parentName: parentData.name });
                });
              }
            }
          } else {
            cats.push({ id: teamData.id, name: teamData.name, parentId: null });
            if (teamData.children) {
              teamData.children.forEach(child => {
                cats.push({ id: child.id, name: child.name, parentId: teamData.id, parentName: teamData.name });
              });
            }
          }
        }
      }
      
      setCategories(cats);
    } catch (error) {
      console.error('Failed to fetch teams:', error);
      setLoading(false);
    }
  };

  const handleCreatePlayer = async (e) => {
    e.preventDefault();
    const targetTeamId = newPlayer.teamId || filterCategory || currentTeam?.id || (categories.length > 0 ? categories[0].id : '');
    if (!targetTeamId) {
      console.error('No team selected');
      return;
    }
    try {
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          name: newPlayer.name,
          number: newPlayer.number,
          position: newPlayer.position,
          teamId: targetTeamId
        }),
      });
      if (res.ok) {
        const defaultTeamId = filterCategory || currentTeam?.id || (categories.length > 0 ? categories[0].id : '');
        setNewPlayer({ name: '', number: '', position: '', teamId: defaultTeamId });
        setShowCreateModal(false);
        fetchPlayers();
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
      result = result.filter(p => p.teamId === filterCategory);
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

  const clearFilters = () => {
    setFilterParentTeam('');
    setFilterCategory('');
    setFilterPosition('');
  };

  const hasActiveFilters = filterParentTeam || filterCategory || filterPosition;
  
  const filteredCategories = filterParentTeam 
    ? categories.filter(c => c.parentId === filterParentTeam || c.id === filterParentTeam)
    : categories;

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
        {(isOperator() || (currentTeam && isCoach(currentTeam.id))) && (
          <button
            onClick={openCreateModal}
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
          
          {isOperator() && !currentTeam && (
            <div>
              <select
                value={filterParentTeam}
                onChange={(e) => {
                  setFilterParentTeam(e.target.value);
                  setFilterCategory('');
                }}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg"
              >
                <option value="">全チーム</option>
                {parentTeams.map((team) => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg"
            >
              <option value="">全カテゴリー</option>
              {(() => {
                const childCategories = filteredCategories.filter(c => c.parentId !== null);
                if (childCategories.length > 0) {
                  return childCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ));
                }
                return filteredCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ));
              })()}
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
                  {player.team?.name || '-'}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">所属カテゴリー</label>
                <select
                  value={newPlayer.teamId}
                  onChange={(e) => setNewPlayer({ ...newPlayer, teamId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                >
                  {(() => {
                    if (isOperator()) {
                      return categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.parentName ? `${cat.parentName} / ${cat.name}` : cat.name}
                        </option>
                      ));
                    }
                    const childCategories = categories.filter(c => c.parentId !== null);
                    if (childCategories.length > 0) {
                      return childCategories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ));
                    }
                    return categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ));
                  })()}
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
