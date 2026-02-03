import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UserCircle, Plus, X, Shield, User, Trash2, Users, UserCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function StaffManagement() {
  const { currentTeam } = useAuth();
  const [activeTab, setActiveTab] = useState('staff');
  const [staff, setStaff] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMember, setNewMember] = useState({ email: '', role: 'COACH' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const staffRoles = [
    { value: 'TEAM_MANAGER', label: 'チーム管理者', icon: Shield, color: 'bg-purple-100 text-purple-800' },
    { value: 'COACH', label: 'コーチ', icon: User, color: 'bg-green-100 text-green-800' },
    { value: 'GUEST_COACH', label: '外部コーチ', icon: User, color: 'bg-gray-100 text-gray-800' },
  ];

  useEffect(() => {
    if (currentTeam) {
      fetchStaff();
      fetchPlayers();
    }
  }, [currentTeam]);

  const fetchStaff = async () => {
    try {
      const res = await fetch(`/api/teams/${currentTeam.id}/staff`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setStaff(data);
      }
    } catch (error) {
      console.error('Failed to fetch staff:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlayers = async () => {
    try {
      const res = await fetch(`/api/players?teamId=${currentTeam.id}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setPlayers(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Failed to fetch players:', error);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      const res = await fetch(`/api/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ teamId: currentTeam.id, role: newRole }),
      });
      if (res.ok) {
        fetchStaff();
      }
    } catch (error) {
      console.error('Failed to update role:', error);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const res = await fetch(`/api/teams/${currentTeam.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newMember),
      });

      if (res.ok) {
        setShowAddModal(false);
        setNewMember({ email: '', role: 'COACH' });
        fetchStaff();
      } else {
        const data = await res.json();
        setError(data.error || 'メンバーの追加に失敗しました');
      }
    } catch (error) {
      setError('メンバーの追加に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!confirm('このスタッフをチームから削除しますか？')) return;

    try {
      const res = await fetch(`/api/teams/${currentTeam.id}/members/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        fetchStaff();
      }
    } catch (error) {
      console.error('Failed to remove member:', error);
    }
  };

  const getRoleInfo = (role) => {
    return staffRoles.find(r => r.value === role) || staffRoles[2];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ユーザー管理</h1>
          <p className="mt-1 text-sm text-gray-500">
            スタッフと選手を管理します
          </p>
        </div>
        {activeTab === 'staff' && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            スタッフを追加
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('staff')}
            className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'staff'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Shield className="w-4 h-4" />
            スタッフ
            <span className={`ml-1 py-0.5 px-2 rounded-full text-xs ${
              activeTab === 'staff' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
            }`}>
              {staff.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('players')}
            className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'players'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Users className="w-4 h-4" />
            選手
            <span className={`ml-1 py-0.5 px-2 rounded-full text-xs ${
              activeTab === 'players' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
            }`}>
              {players.length}
            </span>
          </button>
        </nav>
      </div>

      {/* Staff Tab */}
      {activeTab === 'staff' && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {staff.map((member) => {
            const roleInfo = getRoleInfo(member.role);
            return (
              <div
                key={`${member.userId}-${member.teamId || currentTeam.id}`}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                    {member.user.avatarUrl ? (
                      <img
                        src={member.user.avatarUrl}
                        alt=""
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <UserCircle className="w-8 h-8 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">
                      {member.user.name}
                    </h3>
                    <p className="text-sm text-gray-500 truncate">
                      {member.user.email}
                    </p>
                    <div className="mt-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleInfo.color}`}>
                        {roleInfo.label}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member.userId, e.target.value)}
                      className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {staffRoles.map((role) => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleRemoveMember(member.userId)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="削除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {staff.length === 0 && (
            <div className="col-span-full text-center py-12 bg-white rounded-xl border border-gray-200">
              <UserCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">スタッフが登録されていません</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-3 text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                スタッフを追加する
              </button>
            </div>
          )}
        </div>
      )}

      {/* Players Tab */}
      {activeTab === 'players' && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {players.map((player) => (
            <Link
              key={player.id}
              to={`/players/${player.id}`}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {player.photoUrl ? (
                    <img
                      src={player.photoUrl}
                      alt=""
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <UserCircle className="w-8 h-8 text-gray-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 truncate">
                    {player.name}
                  </h3>
                  {player.category && (
                    <p className="text-sm text-gray-500 truncate">
                      {player.category.name}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    {player.position && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {player.position}
                      </span>
                    )}
                    {player.jerseyNumber && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        #{player.jerseyNumber}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                <div className="text-xs text-gray-500">
                  {player.user ? (
                    <span className="flex items-center gap-1 text-green-600">
                      <UserCheck className="w-3 h-3" />
                      アカウント連携済み
                    </span>
                  ) : (
                    <span className="text-gray-400">未連携</span>
                  )}
                </div>
                <span className="text-xs text-blue-600">詳細 →</span>
              </div>
            </Link>
          ))}

          {players.length === 0 && (
            <div className="col-span-full text-center py-12 bg-white rounded-xl border border-gray-200">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">選手が登録されていません</p>
              <Link
                to="/players/new"
                className="mt-3 inline-block text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                選手を追加する
              </Link>
            </div>
          )}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">スタッフを追加</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  メールアドレス
                </label>
                <input
                  type="email"
                  value={newMember.email}
                  onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="coach@example.com"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  登録済みユーザーのメールアドレスを入力してください
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  役割
                </label>
                <select
                  value={newMember.role}
                  onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {staffRoles.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>

              {error && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {saving ? '追加中...' : '追加する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
