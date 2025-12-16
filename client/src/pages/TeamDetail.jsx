import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Building2, Upload, Save, Users, Plus, X, Trash2, Edit2 } from 'lucide-react';

const ROLE_LABELS = {
  TEAM_ADMIN: 'チーム管理者',
  TEAM_HEAD_COACH: '監督',
  TEAM_COACH: 'コーチ',
  TEAM_EXTERNAL_COACH: '外部コーチ',
  PLAYER: '選手',
  PARENT: '保護者'
};

const COACH_ROLES = ['TEAM_HEAD_COACH', 'TEAM_COACH', 'TEAM_EXTERNAL_COACH'];
const MEMBER_ROLES = ['PLAYER', 'PARENT'];

export default function TeamDetail() {
  const { id } = useParams();
  const { isTeamAdmin, isOperator } = useAuth();
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  
  const [showSubTeamModal, setShowSubTeamModal] = useState(false);
  const [newSubTeamName, setNewSubTeamName] = useState('');
  
  const [showCoachModal, setShowCoachModal] = useState(false);
  const [coachEmail, setCoachEmail] = useState('');
  const [coachRole, setCoachRole] = useState('TEAM_COACH');
  
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState('PLAYER');
  
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTeam();
  }, [id]);

  const fetchTeam = async () => {
    try {
      const res = await fetch(`/api/teams/${id}`, { credentials: 'include' });
      const data = await res.json();
      setTeam(data);
      setName(data.name);
      setDescription(data.description || '');
    } catch (error) {
      console.error('Failed to fetch team:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      await fetch(`/api/teams/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, description }),
      });
      setEditing(false);
      fetchTeam();
    } catch (error) {
      console.error('Failed to update team:', error);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('logo', file);

    try {
      await fetch(`/api/teams/${id}/logo`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      fetchTeam();
    } catch (error) {
      console.error('Failed to upload logo:', error);
    }
  };

  const handleCreateSubTeam = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newSubTeamName, parentId: id }),
      });
      if (res.ok) {
        setNewSubTeamName('');
        setShowSubTeamModal(false);
        fetchTeam();
      } else {
        const data = await res.json();
        setError(data.error || '作成に失敗しました');
      }
    } catch (error) {
      setError('作成に失敗しました');
    }
  };

  const handleAddCoach = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`/api/teams/${id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: coachEmail, role: coachRole }),
      });
      if (res.ok) {
        setCoachEmail('');
        setCoachRole('TEAM_COACH');
        setShowCoachModal(false);
        fetchTeam();
      } else {
        const data = await res.json();
        setError(data.error || '追加に失敗しました');
      }
    } catch (error) {
      setError('追加に失敗しました');
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`/api/teams/${id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: memberEmail, role: memberRole }),
      });
      if (res.ok) {
        setMemberEmail('');
        setMemberRole('PLAYER');
        setShowMemberModal(false);
        fetchTeam();
      } else {
        const data = await res.json();
        setError(data.error || '追加に失敗しました');
      }
    } catch (error) {
      setError('追加に失敗しました');
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!confirm('このメンバーを削除しますか？')) return;
    try {
      await fetch(`/api/teams/${id}/members/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      fetchTeam();
    } catch (error) {
      console.error('Failed to remove member:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!team) {
    return <div className="text-center text-gray-500">チームが見つかりません</div>;
  }

  const canEdit = isTeamAdmin(id) || isOperator();
  const coaches = team.users?.filter(u => COACH_ROLES.includes(u.role)) || [];
  const members = team.users?.filter(u => MEMBER_ROLES.includes(u.role) || u.role === 'TEAM_ADMIN') || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">チーム設定</h1>
        {canEdit && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-primary-600 hover:bg-primary-50 rounded-lg"
          >
            <Edit2 className="w-4 h-4" />
            編集
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-start gap-6">
          <div className="relative">
            {team.logoUrl ? (
              <img
                src={team.logoUrl}
                alt=""
                className="w-24 h-24 rounded-xl object-cover"
              />
            ) : (
              <div className="w-24 h-24 rounded-xl bg-gray-100 flex items-center justify-center">
                <Building2 className="w-10 h-10 text-gray-400" />
              </div>
            )}
            {canEdit && (
              <label className="absolute -bottom-2 -right-2 p-2 bg-white rounded-full shadow-md cursor-pointer hover:bg-gray-50">
                <Upload className="w-4 h-4 text-gray-600" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <div className="flex-1 space-y-4">
            {editing ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    チーム名
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    説明
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleSave}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                  >
                    <Save className="w-4 h-4" />
                    保存
                  </button>
                  <button
                    onClick={() => {
                      setEditing(false);
                      setName(team.name);
                      setDescription(team.description || '');
                    }}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                  >
                    キャンセル
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-xl font-semibold text-gray-900">{team.name}</h2>
                <p className="text-gray-600">{team.description || '説明なし'}</p>
              </>
            )}
          </div>
        </div>
      </div>

      {team.parent && (
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-sm text-blue-700">
            親チーム: <Link to={`/teams/${team.parent.id}`} className="font-medium underline">{team.parent.name}</Link>
          </p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">サブチーム</h3>
          {canEdit && (
            <button
              onClick={() => setShowSubTeamModal(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              <Plus className="w-4 h-4" />
              サブチーム追加
            </button>
          )}
        </div>
        {team.children?.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {team.children.map((subTeam) => (
              <Link
                key={subTeam.id}
                to={`/teams/${subTeam.id}`}
                className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-gray-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{subTeam.name}</p>
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {subTeam._count?.players || 0}名
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">サブチームはありません</p>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">監督・コーチ</h3>
          {canEdit && (
            <button
              onClick={() => setShowCoachModal(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              <Plus className="w-4 h-4" />
              追加
            </button>
          )}
        </div>
        {coaches.length > 0 ? (
          <div className="space-y-3">
            {coaches.map((userTeam) => (
              <div key={userTeam.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <p className="font-medium text-gray-900">{userTeam.user.name}</p>
                  <p className="text-sm text-gray-500">{userTeam.user.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                    {ROLE_LABELS[userTeam.role] || userTeam.role}
                  </span>
                  {canEdit && (
                    <button
                      onClick={() => handleRemoveMember(userTeam.user.id)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">監督・コーチは登録されていません</p>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">チームメンバー</h3>
          {canEdit && (
            <button
              onClick={() => setShowMemberModal(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              <Plus className="w-4 h-4" />
              追加
            </button>
          )}
        </div>
        {members.length > 0 ? (
          <div className="space-y-3">
            {members.map((userTeam) => (
              <div key={userTeam.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <p className="font-medium text-gray-900">{userTeam.user.name}</p>
                  <p className="text-sm text-gray-500">{userTeam.user.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                    {ROLE_LABELS[userTeam.role] || userTeam.role}
                  </span>
                  {canEdit && userTeam.role !== 'TEAM_ADMIN' && (
                    <button
                      onClick={() => handleRemoveMember(userTeam.user.id)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">メンバーは登録されていません</p>
        )}
      </div>

      {showSubTeamModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">サブチーム追加</h2>
              <button onClick={() => { setShowSubTeamModal(false); setError(''); }} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
            <form onSubmit={handleCreateSubTeam}>
              <input
                type="text"
                placeholder="サブチーム名（例: Aチーム）"
                value={newSubTeamName}
                onChange={(e) => setNewSubTeamName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4"
                required
              />
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => { setShowSubTeamModal(false); setError(''); }} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
                  キャンセル
                </button>
                <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                  作成
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCoachModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">監督・コーチ追加</h2>
              <button onClick={() => { setShowCoachModal(false); setError(''); }} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
            <form onSubmit={handleAddCoach}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
                <input
                  type="email"
                  placeholder="coach@example.com"
                  value={coachEmail}
                  onChange={(e) => setCoachEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">役割</label>
                <select
                  value={coachRole}
                  onChange={(e) => setCoachRole(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="TEAM_HEAD_COACH">監督</option>
                  <option value="TEAM_COACH">コーチ</option>
                  <option value="TEAM_EXTERNAL_COACH">外部コーチ</option>
                </select>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => { setShowCoachModal(false); setError(''); }} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
                  キャンセル
                </button>
                <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                  追加
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showMemberModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">チームメンバー追加</h2>
              <button onClick={() => { setShowMemberModal(false); setError(''); }} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
            <form onSubmit={handleAddMember}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
                <input
                  type="email"
                  placeholder="member@example.com"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">役割</label>
                <select
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="PLAYER">選手</option>
                  <option value="PARENT">保護者</option>
                  <option value="TEAM_ADMIN">チーム管理者</option>
                </select>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => { setShowMemberModal(false); setError(''); }} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
                  キャンセル
                </button>
                <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                  追加
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
