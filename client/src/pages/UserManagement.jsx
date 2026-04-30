import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UserCircle, UserPlus, Copy, X } from 'lucide-react';

const STAFF_ROLES = {
  TEAM_MANAGER: 'チーム管理者',
  COACH: 'コーチ',
  GUEST_COACH: '外部コーチ',
};

const STAFF_ROLE_DESCRIPTIONS = {
  TEAM_MANAGER: 'チームの全権限',
  COACH: '担当選手の評価・管理',
  GUEST_COACH: '限定的な評価権限',
};

export default function UserManagement() {
  const { currentTeam, isOperator, isTeamAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteRole, setInviteRole] = useState('COACH');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteExpiryDays, setInviteExpiryDays] = useState(7);
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [issuedInvite, setIssuedInvite] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (currentTeam) {
      fetchUsers();
    }
  }, [currentTeam]);

  const fetchUsers = async () => {
    try {
      const res = await fetch(`/api/users?teamId=${currentTeam.id}`, {
        credentials: 'include',
      });
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await fetch(`/api/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ teamId: currentTeam.id, role: newRole }),
      });
      fetchUsers();
    } catch (error) {
      console.error('Failed to update role:', error);
    }
  };

  const canInviteStaff = currentTeam && (isOperator() || (typeof isTeamAdmin === 'function' && isTeamAdmin(currentTeam.id)));

  const openInviteModal = () => {
    setInviteRole('COACH');
    setInviteEmail('');
    setInviteExpiryDays(7);
    setInviteError('');
    setIssuedInvite(null);
    setCopied(false);
    setShowInviteModal(true);
  };

  const closeInviteModal = () => {
    setShowInviteModal(false);
    setIssuedInvite(null);
    setInviteError('');
    setCopied(false);
  };

  const handleIssueInvite = async (e) => {
    e.preventDefault();
    if (!currentTeam) return;
    setInviting(true);
    setInviteError('');
    try {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          teamId: currentTeam.id,
          role: inviteRole,
          email: inviteEmail || null,
          expiryDays: inviteExpiryDays,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteError(data.error || '招待URLの発行に失敗しました');
        return;
      }
      const url = `${window.location.origin}${data.inviteUrl}`;
      setIssuedInvite({ ...data, url });
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      } catch {
        setCopied(false);
      }
    } catch (err) {
      console.error('Failed to issue invitation:', err);
      setInviteError('招待URLの発行に失敗しました');
    } finally {
      setInviting(false);
    }
  };

  const handleCopyUrl = async () => {
    if (!issuedInvite?.url) return;
    try {
      await navigator.clipboard.writeText(issuedInvite.url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const roleLabels = {
    TEAM_MANAGER: 'チーム管理者',
    COACH: 'コーチ',
    GUEST_COACH: '外部コーチ',
    PLAYER: '選手',
    PARENT: '保護者',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ユーザー管理</h1>
          <p className="mt-1 text-sm text-gray-500">{users.length}名のユーザー</p>
        </div>
        {canInviteStaff && (
          <button
            type="button"
            onClick={openInviteModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <UserPlus className="w-4 h-4" />
            スタッフを招待
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ユーザー
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                メール
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                役割
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                      <UserCircle className="w-6 h-6 text-gray-400" />
                    </div>
                    <span className="font-medium text-gray-900">{user.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <select
                    value={user.teams?.[0]?.role || ''}
                    onChange={(e) => handleRoleChange(user.id, e.target.value)}
                    className="text-sm border border-gray-300 rounded-lg px-2 py-1"
                  >
                    {Object.entries(roleLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">スタッフを招待</h2>
              <button
                type="button"
                onClick={closeInviteModal}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
                aria-label="閉じる"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!issuedInvite ? (
              <form onSubmit={handleIssueInvite} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">役割</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    {Object.entries(STAFF_ROLES).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">{STAFF_ROLE_DESCRIPTIONS[inviteRole]}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    メール（任意）
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="招待先のメールアドレス"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">有効期間</label>
                  <select
                    value={inviteExpiryDays}
                    onChange={(e) => setInviteExpiryDays(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    <option value={1}>1日</option>
                    <option value={7}>7日</option>
                    <option value={14}>14日</option>
                    <option value={30}>30日</option>
                  </select>
                </div>

                {inviteError && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {inviteError}
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeInviteModal}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    disabled={inviting}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60"
                  >
                    {inviting ? '発行中...' : '発行してURLをコピー'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="text-sm text-gray-700">
                  招待URLを発行しました。下記URLを招待したいスタッフに共有してください。
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 break-all text-sm text-gray-800 font-mono">
                  {issuedInvite.url}
                </div>
                <div className="text-xs text-gray-500">
                  役割: <span className="font-medium text-gray-700">{STAFF_ROLES[issuedInvite.role] || issuedInvite.role}</span>
                  {' / '}有効期限: <span className="font-medium text-gray-700">{new Date(issuedInvite.expiresAt).toLocaleString('ja-JP')}</span>
                </div>
                {copied && (
                  <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1 inline-block">
                    URLをクリップボードにコピーしました
                  </div>
                )}
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleCopyUrl}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    <Copy className="w-4 h-4" />
                    URLをコピー
                  </button>
                  <button
                    type="button"
                    onClick={closeInviteModal}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                  >
                    閉じる
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
