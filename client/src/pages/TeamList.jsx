import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Building2, Users, Plus, ChevronDown, ChevronRight } from 'lucide-react';

export default function TeamList() {
  const { isOperator } = useAuth();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [parentTeamId, setParentTeamId] = useState(null);
  const [expandedTeams, setExpandedTeams] = useState({});

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
      const expanded = {};
      data.forEach(team => {
        if (team.children?.length > 0) {
          expanded[team.id] = true;
        }
      });
      setExpandedTeams(expanded);
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
        body: JSON.stringify({ 
          name: newTeamName,
          parentId: parentTeamId
        }),
      });
      if (res.ok) {
        setNewTeamName('');
        setParentTeamId(null);
        setShowCreateModal(false);
        fetchTeams();
      }
    } catch (error) {
      console.error('Failed to create team:', error);
    }
  };

  const openCreateSubTeamModal = (parentId) => {
    setParentTeamId(parentId);
    setShowCreateModal(true);
  };

  const toggleExpand = (teamId) => {
    setExpandedTeams(prev => ({
      ...prev,
      [teamId]: !prev[teamId]
    }));
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
            onClick={() => {
              setParentTeamId(null);
              setShowCreateModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus className="w-4 h-4" />
            新規チーム
          </button>
        )}
      </div>

      <div className="space-y-4">
        {teams.map((team) => (
          <div key={team.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-4">
                {team.children?.length > 0 && (
                  <button
                    onClick={() => toggleExpand(team.id)}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    {expandedTeams[team.id] ? (
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-500" />
                    )}
                  </button>
                )}
                {!team.children?.length && <div className="w-7" />}
                
                <Link to={`/teams/${team.id}`} className="flex items-center gap-4 flex-1">
                  {team.logoUrl ? (
                    <img
                      src={team.logoUrl}
                      alt=""
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{team.name}</h3>
                    <p className="text-sm text-gray-500">{team.organization?.name || ''}</p>
                  </div>
                </Link>

                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {getTotalPlayers(team)}名
                  </span>
                </div>

                {isOperator() && (
                  <button
                    onClick={() => openCreateSubTeamModal(team.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-primary-600 hover:bg-primary-50 rounded-lg"
                  >
                    <Plus className="w-4 h-4" />
                    サブチーム追加
                  </button>
                )}
              </div>
            </div>

            {expandedTeams[team.id] && team.children?.length > 0 && (
              <div className="border-t border-gray-100 bg-gray-50">
                {team.children.map((subTeam) => (
                  <Link
                    key={subTeam.id}
                    to={`/teams/${subTeam.id}`}
                    className="flex items-center gap-4 px-6 py-4 pl-16 hover:bg-gray-100 border-b border-gray-100 last:border-b-0"
                  >
                    <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{subTeam.name}</h4>
                    </div>
                    <span className="flex items-center gap-1 text-sm text-gray-500">
                      <Users className="w-4 h-4" />
                      {subTeam._count?.players || 0}名
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {parentTeamId ? 'サブチーム作成' : '新規チーム作成'}
            </h2>
            <form onSubmit={handleCreateTeam}>
              <input
                type="text"
                placeholder={parentTeamId ? 'サブチーム名（例: Aチーム）' : 'チーム名'}
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
                    setParentTeamId(null);
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
