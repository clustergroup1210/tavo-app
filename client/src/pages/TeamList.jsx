import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Building2, Users, Plus } from 'lucide-react';

export default function TeamList() {
  const { isOperator } = useAuth();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      const res = await fetch('/api/teams', { credentials: 'include' });
      if (!res.ok) {
        setTeams([]);
        return;
      }
      const data = await res.json();
      if (!Array.isArray(data)) {
        setTeams([]);
        return;
      }
      setTeams(data);
    } catch (error) {
      console.error('Failed to fetch teams:', error);
      setTeams([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newTeamName }),
      });
      if (res.ok) {
        setNewTeamName('');
        setShowCreateModal(false);
        fetchTeams();
      }
    } catch (error) {
      console.error('Failed to create team:', error);
    }
  };

  const getTotalPlayers = (team) => {
    let count = team._count?.players || 0;
    if (team.children) {
      team.children.forEach(child => {
        count += child._count?.players || 0;
      });
    }
    return count;
  };

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
          <h1 className="text-2xl font-bold text-gray-900">チーム一覧</h1>
          <p className="mt-1 text-sm text-gray-500">{teams.length}件のチーム</p>
        </div>
        {isOperator() && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus className="w-4 h-4" />
            新規チーム
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.map((team) => (
          <Link
            key={team.id}
            to={`/teams/${team.id}`}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-4">
              {team.logoUrl ? (
                <img
                  src={team.logoUrl}
                  alt=""
                  className="w-14 h-14 rounded-lg object-cover"
                />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center">
                  <Building2 className="w-7 h-7 text-gray-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 truncate">{team.name}</h3>
                <p className="text-sm text-gray-500">{team.organization?.name || ''}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                {getTotalPlayers(team)}名
              </span>
              {team.children?.length > 0 && (
                <span className="text-gray-400">
                  {team.children.length}カテゴリー
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>

      {teams.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">チームがまだありません</p>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">新規チーム作成</h2>
            <form onSubmit={handleCreateTeam}>
              <input
                type="text"
                placeholder="チーム名"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4"
                required
              />
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewTeamName('');
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  作成
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
