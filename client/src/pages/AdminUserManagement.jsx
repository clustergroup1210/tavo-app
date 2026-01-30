import React, { useState, useEffect } from 'react';
import { Search, UserPlus, MoreVertical, Mail, Shield, X, Link2, Copy, Trash2, Clock, CheckCircle, XCircle, Edit2 } from 'lucide-react';

export default function AdminUserManagement() {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [copiedUrl, setCopiedUrl] = useState(null);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: '',
    teamId: '',
    teamRole: '',
    playerId: '',
  });
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    password: '',
    organizationRole: '',
    teamRoles: [],
  });
  const [editTeamData, setEditTeamData] = useState([]);
  const [teamPlayers, setTeamPlayers] = useState([]);
  const [newInvite, setNewInvite] = useState({
    teamId: '',
    role: 'PLAYER',
    playerName: '',
    playerId: '',
    email: '',
    expiryDays: 7,
  });

  useEffect(() => {
    fetchUsers();
    fetchInvitations();
    fetchTeams();
  }, []);

  useEffect(() => {
    if (newInvite.teamId && newInvite.role === 'PARENT') {
      fetchPlayers(newInvite.teamId);
    }
  }, [newInvite.teamId, newInvite.role]);

  useEffect(() => {
    if (newUser.teamId && newUser.teamRole === 'PARENT') {
      fetchTeamPlayers(newUser.teamId);
    }
  }, [newUser.teamId, newUser.teamRole]);

  const fetchTeamPlayers = async (teamId) => {
    try {
      const res = await fetch(`/api/players?teamId=${teamId}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setTeamPlayers(data);
      }
    } catch (error) {
      console.error('Failed to fetch players:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchInvitations = async () => {
    try {
      const res = await fetch('/api/invitations', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setInvitations(data);
      }
    } catch (error) {
      console.error('Failed to fetch invitations:', error);
    }
  };

  const fetchTeams = async () => {
    try {
      const res = await fetch('/api/admin/teams', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setTeams(data);
      }
    } catch (error) {
      console.error('Failed to fetch teams:', error);
    }
  };

  const fetchPlayers = async (teamId) => {
    try {
      const res = await fetch(`/api/players?teamId=${teamId}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setPlayers(data);
      }
    } catch (error) {
      console.error('Failed to fetch players:', error);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newUser),
      });
      if (res.ok) {
        setShowCreateModal(false);
        setNewUser({ name: '', email: '', password: '', role: '', teamId: '', teamRole: '', playerId: '' });
        fetchUsers();
      } else {
        const data = await res.json();
        setError(data.error || 'ユーザーの作成に失敗しました');
      }
    } catch (error) {
      setError('ユーザーの作成に失敗しました');
    } finally {
      setCreating(false);
    }
  };

  const handleCreateInvitation = async (e) => {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newInvite),
      });
      if (res.ok) {
        setShowInviteModal(false);
        setNewInvite({ teamId: '', role: 'PLAYER', playerName: '', playerId: '', email: '', expiryDays: 7 });
        fetchInvitations();
      } else {
        const data = await res.json();
        setError(data.error || '招待URLの作成に失敗しました');
      }
    } catch (error) {
      setError('招待URLの作成に失敗しました');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteInvitation = async (id) => {
    if (!confirm('この招待URLを無効化しますか？')) return;
    try {
      const res = await fetch(`/api/invitations/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        fetchInvitations();
      }
    } catch (error) {
      console.error('Failed to delete invitation:', error);
    }
  };

  const copyToClipboard = async (url, id) => {
    const fullUrl = `${window.location.origin}${url}`;
    await navigator.clipboard.writeText(fullUrl);
    setCopiedUrl(id);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const handleEditUser = async (user) => {
    setEditingUser(user);
    
    const orgRole = user.organizations?.find(o => 
      ['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'EXTERNAL'].includes(o.role)
    )?.role || '';
    
    const teamRolesData = user.teams?.map(t => ({
      teamId: t.teamId,
      teamName: t.team?.name || '',
      role: t.role,
      isHeadCoach: false,
    })) || [];

    for (const tr of teamRolesData) {
      try {
        const res = await fetch(`/api/teams/${tr.teamId}`, { credentials: 'include' });
        if (res.ok) {
          const teamData = await res.json();
          tr.isHeadCoach = teamData.headCoachId === user.id;
        }
      } catch (e) {
        console.error('Failed to fetch team data:', e);
      }
    }

    setEditForm({
      name: user.name || '',
      email: user.email || '',
      password: '',
      organizationRole: orgRole,
      teamRoles: teamRolesData,
    });
    setError('');
    setShowEditModal(true);
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      const payload = {
        name: editForm.name,
        email: editForm.email,
        password: editForm.password || undefined,
        organizationRole: editForm.organizationRole || null,
        teamRoles: editForm.teamRoles.map(tr => ({
          teamId: tr.teamId,
          role: tr.role,
          isHeadCoach: tr.isHeadCoach,
        })),
      };
      
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setShowEditModal(false);
        setEditingUser(null);
        setEditForm({ name: '', email: '', password: '', organizationRole: '', teamRoles: [] });
        fetchUsers();
      } else {
        const data = await res.json();
        setError(data.error || 'ユーザーの更新に失敗しました');
      }
    } catch (error) {
      setError('ユーザーの更新に失敗しました');
    } finally {
      setCreating(false);
    }
  };

  const handleAddTeamRole = () => {
    setEditForm({
      ...editForm,
      teamRoles: [...editForm.teamRoles, { teamId: '', teamName: '', role: 'COACH', isHeadCoach: false }],
    });
  };

  const handleRemoveTeamRole = (index) => {
    const newRoles = [...editForm.teamRoles];
    newRoles.splice(index, 1);
    setEditForm({ ...editForm, teamRoles: newRoles });
  };

  const handleTeamRoleChange = (index, field, value) => {
    const newRoles = [...editForm.teamRoles];
    newRoles[index] = { ...newRoles[index], [field]: value };
    if (field === 'teamId') {
      const team = teams.find(t => t.id === value);
      newRoles[index].teamName = team?.name || '';
    }
    setEditForm({ ...editForm, teamRoles: newRoles });
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesTeam = !teamFilter || user.teams?.some(t => t.teamId === teamFilter);
    
    return matchesSearch && matchesTeam;
  });

  const filteredInvitations = invitations.filter(inv =>
    inv.team?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inv.playerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inv.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleBadge = (user) => {
    if (user.organizations?.some(o => ['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'EXTERNAL'].includes(o.role))) {
      const orgRole = user.organizations.find(o => ['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'EXTERNAL'].includes(o.role))?.role;
      const labels = { SUPER_ADMIN: 'スーパー管理者', ADMIN: '管理者', OPERATOR: 'オペレーター', EXTERNAL: '外部ユーザー' };
      return { label: labels[orgRole] || 'オペレーター', color: 'bg-purple-100 text-purple-700' };
    }
    if (user.teams?.some(t => t.role === 'TEAM_MANAGER')) {
      return { label: 'チーム管理者', color: 'bg-blue-100 text-blue-700' };
    }
    if (user.teams?.some(t => ['COACH', 'GUEST_COACH'].includes(t.role))) {
      return { label: 'コーチ', color: 'bg-green-100 text-green-700' };
    }
    if (user.players?.length > 0) {
      return { label: '選手', color: 'bg-orange-100 text-orange-700' };
    }
    if (user.parentPlayers?.length > 0) {
      return { label: '保護者', color: 'bg-pink-100 text-pink-700' };
    }
    return { label: '未割当', color: 'bg-gray-100 text-gray-600' };
  };

  const getInviteRoleLabel = (role) => {
    const labels = {
      TEAM_MANAGER: 'チーム管理者',
      COACH: 'コーチ',
      GUEST_COACH: 'ゲストコーチ',
      PLAYER: '選手',
      PARENT: '保護者',
    };
    return labels[role] || role;
  };

  const getInviteStatus = (inv) => {
    if (inv.isUsed) {
      return { label: '使用済み', color: 'bg-gray-100 text-gray-600', icon: CheckCircle };
    }
    if (inv.isExpired) {
      return { label: '期限切れ', color: 'bg-red-100 text-red-700', icon: XCircle };
    }
    return { label: '有効', color: 'bg-green-100 text-green-700', icon: Clock };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ユーザー管理</h1>
          <p className="mt-1 text-sm text-gray-500">全システムユーザーと招待URLの管理</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Link2 className="w-4 h-4" />
            招待URL発行
          </button>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            ユーザー追加
          </button>
        </div>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          <button
            onClick={() => setActiveTab('users')}
            className={`py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'users'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            ユーザー一覧 ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('invitations')}
            className={`py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'invitations'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            招待URL ({invitations.length})
          </button>
        </nav>
      </div>

      {activeTab === 'users' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">ユーザー一覧</h2>
              <div className="flex items-center gap-3">
                <select
                  value={teamFilter}
                  onChange={(e) => setTeamFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">すべてのチーム</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="ユーザーを検索..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ユーザー
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    メールアドレス
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    所属チーム
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    役割
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    登録日
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => {
                    const roleBadge = getRoleBadge(user);
                    return (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                              <span className="text-sm font-medium text-primary-700">
                                {user.name?.charAt(0) || 'U'}
                              </span>
                            </div>
                            <p className="font-medium text-gray-900">{user.name}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-gray-400" />
                            {user.email}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {user.teams?.length > 0 || user.players?.length > 0 || user.parentPlayers?.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {user.teams?.map((ut) => (
                                <span key={ut.teamId} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded">
                                  {ut.team?.name || ut.teamId}
                                </span>
                              ))}
                              {user.players?.map((player) => (
                                <span key={player.id} className="px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded">
                                  {player.team?.name || '-'}
                                </span>
                              ))}
                              {user.parentPlayers?.map((pp) => (
                                <span key={pp.id} className="px-2 py-0.5 text-xs bg-pink-100 text-pink-700 rounded">
                                  {pp.player?.team?.name || '-'}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${roleBadge.color}`}>
                            {roleBadge.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(user.createdAt).toLocaleDateString('ja-JP')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button 
                            onClick={() => handleEditUser(user)}
                            className="p-2 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-gray-100"
                            title="編集"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      ユーザーが見つかりません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'invitations' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">招待URL一覧</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="招待を検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    チーム
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    役割
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    対象
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    状態
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    有効期限
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredInvitations.length > 0 ? (
                  filteredInvitations.map((inv) => {
                    const status = getInviteStatus(inv);
                    const StatusIcon = status.icon;
                    return (
                      <tr key={inv.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="font-medium text-gray-900">{inv.team?.name || '-'}</p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                            {getInviteRoleLabel(inv.role)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {inv.role === 'PARENT' && inv.player ? (
                            <span>{inv.player.name}の保護者</span>
                          ) : inv.playerName ? (
                            <span>{inv.playerName}</span>
                          ) : inv.email ? (
                            <span>{inv.email}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${status.color}`}>
                            <StatusIcon className="w-3.5 h-3.5" />
                            {status.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(inv.expiresAt).toLocaleDateString('ja-JP')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1">
                            {!inv.isUsed && !inv.isExpired && (
                              <button
                                onClick={() => copyToClipboard(inv.inviteUrl, inv.id)}
                                className="p-2 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-gray-100"
                                title="URLをコピー"
                              >
                                {copiedUrl === inv.id ? (
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteInvitation(inv.id)}
                              className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100"
                              title="削除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      招待URLがありません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">ユーザー追加</h2>
              <button 
                onClick={() => { setShowCreateModal(false); setError(''); }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
            <form onSubmit={handleCreateUser}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">名前 *</label>
                  <input
                    type="text"
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス *</label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">パスワード *</label>
                  <input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    minLength={6}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">6文字以上</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">運営役割</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value, teamId: '', teamRole: '' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">運営ではない</option>
                    <option value="SUPER_ADMIN">スーパー管理者</option>
                    <option value="ADMIN">管理者</option>
                    <option value="OPERATOR">オペレーター</option>
                    <option value="EXTERNAL">外部ユーザー（読み取り専用）</option>
                  </select>
                </div>
                
                {!['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'EXTERNAL'].includes(newUser.role) && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        所属チーム {newUser.teamRole && ['TEAM_MANAGER', 'COACH', 'GUEST_COACH', 'PLAYER'].includes(newUser.teamRole) ? '*' : ''}
                      </label>
                      <select
                        value={newUser.teamId}
                        onChange={(e) => setNewUser({ ...newUser, teamId: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        required={newUser.teamRole && ['TEAM_MANAGER', 'COACH', 'GUEST_COACH', 'PLAYER'].includes(newUser.teamRole)}
                      >
                        <option value="">チームを選択</option>
                        {teams.map(team => (
                          <option key={team.id} value={team.id}>{team.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">チーム役割</label>
                      <select
                        value={newUser.teamRole}
                        onChange={(e) => setNewUser({ ...newUser, teamRole: e.target.value, playerId: '' })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      >
                        <option value="">役割を選択</option>
                        <option value="TEAM_MANAGER">チーム管理者</option>
                        <option value="COACH">コーチ</option>
                        <option value="GUEST_COACH">ゲストコーチ</option>
                        <option value="PLAYER">選手</option>
                        <option value="PARENT">保護者</option>
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        {newUser.teamRole === 'PARENT' 
                          ? '保護者は子供のデータを閲覧可・編集不可'
                          : '監督・選手の場合はチーム選択が必須です'}
                      </p>
                    </div>
                    {newUser.teamRole === 'PARENT' && newUser.teamId && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">対象選手 *</label>
                        <select
                          value={newUser.playerId}
                          onChange={(e) => setNewUser({ ...newUser, playerId: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          required
                        >
                          <option value="">選手を選択</option>
                          {teamPlayers.map(player => (
                            <option key={player.id} value={player.id}>{player.name}</option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">保護者として紐づける選手を選択</p>
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => { setShowCreateModal(false); setError(''); }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {creating ? '作成中...' : '作成'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">招待URL発行</h2>
              <button 
                onClick={() => { setShowInviteModal(false); setError(''); }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
            <form onSubmit={handleCreateInvitation}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">チーム *</label>
                  <select
                    value={newInvite.teamId}
                    onChange={(e) => setNewInvite({ ...newInvite, teamId: e.target.value, playerId: '' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                  >
                    <option value="">チームを選択</option>
                    {teams.map(team => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">役割 *</label>
                  <select
                    value={newInvite.role}
                    onChange={(e) => setNewInvite({ ...newInvite, role: e.target.value, playerId: '' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                  >
                    <option value="PLAYER">選手</option>
                    <option value="PARENT">保護者</option>
                    <option value="COACH">コーチ</option>
                    <option value="GUEST_COACH">ゲストコーチ</option>
                    <option value="TEAM_MANAGER">チーム管理者</option>
                  </select>
                </div>
                {newInvite.role === 'PLAYER' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">選手名</label>
                    <input
                      type="text"
                      value={newInvite.playerName}
                      onChange={(e) => setNewInvite({ ...newInvite, playerName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="登録予定の選手名"
                    />
                  </div>
                )}
                {newInvite.role === 'PARENT' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">対象選手 *</label>
                    <select
                      value={newInvite.playerId}
                      onChange={(e) => setNewInvite({ ...newInvite, playerId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      required
                    >
                      <option value="">選手を選択</option>
                      {players.map(player => (
                        <option key={player.id} value={player.id}>{player.name}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">保護者として紐づける選手を選択</p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス（任意）</label>
                  <input
                    type="email"
                    value={newInvite.email}
                    onChange={(e) => setNewInvite({ ...newInvite, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="招待先のメールアドレス"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">有効期限</label>
                  <select
                    value={newInvite.expiryDays}
                    onChange={(e) => setNewInvite({ ...newInvite, expiryDays: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value={1}>1日</option>
                    <option value={3}>3日</option>
                    <option value={7}>7日</option>
                    <option value={14}>14日</option>
                    <option value={30}>30日</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => { setShowInviteModal(false); setError(''); }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {creating ? '発行中...' : '発行'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto py-8">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">ユーザー編集</h2>
              <button 
                onClick={() => { setShowEditModal(false); setError(''); setEditingUser(null); }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}
            <form onSubmit={handleUpdateUser} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">名前</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">新しいパスワード（変更する場合のみ）</label>
                <input
                  type="password"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="変更しない場合は空欄"
                  minLength={6}
                />
                <p className="text-xs text-gray-500 mt-1">6文字以上で入力してください</p>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">運営役割</label>
                <select
                  value={editForm.organizationRole}
                  onChange={(e) => setEditForm({ ...editForm, organizationRole: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">運営ではない</option>
                  <option value="SUPER_ADMIN">スーパー管理者</option>
                  <option value="ADMIN">管理者</option>
                  <option value="OPERATOR">オペレーター</option>
                  <option value="EXTERNAL">外部ユーザー（読み取り専用）</option>
                </select>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">チーム役割</label>
                  <button
                    type="button"
                    onClick={handleAddTeamRole}
                    className="text-sm text-primary-600 hover:text-primary-700"
                  >
                    + チームを追加
                  </button>
                </div>
                
                {editForm.teamRoles.length === 0 ? (
                  <p className="text-sm text-gray-500">チームに所属していません</p>
                ) : (
                  <div className="space-y-3">
                    {editForm.teamRoles.map((tr, index) => (
                      <div key={index} className="p-3 bg-gray-50 rounded-lg space-y-2">
                        <div className="flex items-center gap-2">
                          <select
                            value={tr.teamId}
                            onChange={(e) => handleTeamRoleChange(index, 'teamId', e.target.value)}
                            className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                          >
                            <option value="">チームを選択</option>
                            {teams.map(team => (
                              <option key={team.id} value={team.id}>{team.name}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => handleRemoveTeamRole(index)}
                            className="p-1 text-gray-400 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={tr.role}
                            onChange={(e) => handleTeamRoleChange(index, 'role', e.target.value)}
                            className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                          >
                            <option value="TEAM_MANAGER">チーム管理者</option>
                            <option value="COACH">コーチ</option>
                            <option value="GUEST_COACH">ゲストコーチ</option>
                          </select>
                          {['COACH', 'GUEST_COACH', 'TEAM_MANAGER'].includes(tr.role) && (
                            <label className="flex items-center gap-1.5 text-sm whitespace-nowrap">
                              <input
                                type="checkbox"
                                checked={tr.isHeadCoach}
                                onChange={(e) => handleTeamRoleChange(index, 'isHeadCoach', e.target.checked)}
                                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                              />
                              代表監督
                            </label>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  代表監督はチーム内の全選手を評価できます。1チームにつき1名のみ設定可能です。
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setError(''); setEditingUser(null); }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {creating ? '更新中...' : '更新'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
