import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  UserCircle, UserPlus, Copy, X, Trash2, Link2, Plus,
  User, Users, UserMinus, Undo2, Clock,
} from 'lucide-react';

const ROLE_LABELS = {
  TEAM_MANAGER: 'チーム管理者',
  COACH: 'コーチ',
  GUEST_COACH: '外部コーチ',
  PLAYER: '選手',
  PARENT: '保護者',
};

const STAFF_ROLES = ['TEAM_MANAGER', 'COACH', 'GUEST_COACH'];
const INVITE_ROLE_DESCRIPTIONS = {
  TEAM_MANAGER: 'チームの全権限',
  COACH: '担当選手の評価・管理',
  GUEST_COACH: '限定的な評価権限',
  PLAYER: '自己評価・閲覧',
  PARENT: '子供の評価閲覧のみ',
};

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('ja-JP');
}

function formatDateTime(d) {
  if (!d) return '未ログイン';
  const date = new Date(d);
  const now = new Date();
  const diffMs = now - date;
  const day = 24 * 60 * 60 * 1000;
  if (diffMs < day) {
    const hrs = Math.floor(diffMs / (60 * 60 * 1000));
    if (hrs < 1) return '1時間以内';
    return `${hrs}時間前`;
  }
  if (diffMs < 30 * day) return `${Math.floor(diffMs / day)}日前`;
  return date.toLocaleDateString('ja-JP');
}

export default function UserManagement() {
  const { currentTeam, isOperator, isTeamAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'invitations' ? 'invitations' : 'users';

  const setTab = (t) => {
    const next = new URLSearchParams(searchParams);
    if (t === 'users') next.delete('tab');
    else next.set('tab', t);
    setSearchParams(next, { replace: true });
  };

  const [users, setUsers] = useState([]);
  const [players, setPlayers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);

  const canManage = currentTeam && (isOperator() || (typeof isTeamAdmin === 'function' && isTeamAdmin(currentTeam.id)));

  const fetchAll = async () => {
    if (!currentTeam) return;
    setLoading(true);
    try {
      const [uRes, iRes, pRes] = await Promise.all([
        fetch(`/api/users?teamId=${currentTeam.id}`, { credentials: 'include' }),
        fetch(`/api/invitations?teamId=${currentTeam.id}`, { credentials: 'include' }),
        fetch(`/api/players?teamId=${currentTeam.id}`, { credentials: 'include' }),
      ]);
      const [uData, iData, pData] = await Promise.all([uRes.json(), iRes.json(), pRes.json()]);
      setUsers(Array.isArray(uData) ? uData : []);
      setInvitations(Array.isArray(iData) ? iData : []);
      setPlayers(Array.isArray(pData) ? pData : []);
    } catch (err) {
      console.error('Failed to fetch:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); /* eslint-disable-next-line */ }, [currentTeam?.id]);

  const handleRoleChange = async (userId, newRole) => {
    if (!currentTeam) return;
    try {
      const res = await fetch(`/api/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ teamId: currentTeam.id, role: newRole }),
      });
      if (res.ok) fetchAll();
    } catch (err) {
      console.error('Failed to update role:', err);
    }
  };

  const handleRestore = async (userId) => {
    if (!confirm('このユーザーをチームに復帰させますか？')) return;
    try {
      const res = await fetch(`/api/users/${userId}/restore-team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ teamId: currentTeam.id }),
      });
      if (res.ok) fetchAll();
      else {
        const d = await res.json().catch(() => ({}));
        alert(d.error || '復帰処理に失敗しました');
      }
    } catch (err) {
      console.error('Restore failed:', err);
    }
  };

  const [leaveTarget, setLeaveTarget] = useState(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const activeCount = users.filter(u => u.teams?.[0]?.isActive !== false).length;
  const leftCount = users.length - activeCount;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ユーザー管理</h1>
          <p className="mt-1 text-sm text-gray-500">
            在籍 {activeCount}名{leftCount > 0 ? ` / 退団済み ${leftCount}名` : ''}
          </p>
        </div>
        {canManage && tab === 'users' && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowAddUser(true)}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              <Plus className="w-4 h-4" />
              既存ユーザーを追加
            </button>
            <button
              type="button"
              onClick={() => setShowInvite(true)}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              <UserPlus className="w-4 h-4" />
              招待URL発行
            </button>
          </div>
        )}
        {canManage && tab === 'invitations' && (
          <button
            type="button"
            onClick={() => setShowInvite(true)}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <UserPlus className="w-4 h-4" />
            招待URL発行
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-6">
          <button
            type="button"
            onClick={() => setTab('users')}
            className={`py-3 px-1 border-b-2 font-medium text-sm ${
              tab === 'users'
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            ユーザー一覧
            <span className={`ml-2 py-0.5 px-2 rounded-full text-xs ${
              tab === 'users' ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {users.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab('invitations')}
            className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-1.5 ${
              tab === 'invitations'
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Link2 className="w-4 h-4" />
            招待URL管理
            <span className={`py-0.5 px-2 rounded-full text-xs ${
              tab === 'invitations' ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {invitations.length}
            </span>
          </button>
        </nav>
      </div>

      {tab === 'users' && (
        <UsersTable
          users={users}
          canManage={canManage}
          onRoleChange={handleRoleChange}
          onLeave={setLeaveTarget}
          onRestore={handleRestore}
        />
      )}

      {tab === 'invitations' && (
        <InvitationsTable
          invitations={invitations}
          canManage={canManage}
          onChange={fetchAll}
        />
      )}

      {leaveTarget && (
        <LeaveTeamModal
          user={leaveTarget}
          teamId={currentTeam.id}
          teamName={currentTeam.name}
          onClose={() => setLeaveTarget(null)}
          onDone={() => { setLeaveTarget(null); fetchAll(); }}
        />
      )}

      {showAddUser && (
        <AddExistingUserModal
          teamId={currentTeam.id}
          onClose={() => setShowAddUser(false)}
          onDone={() => { setShowAddUser(false); fetchAll(); }}
        />
      )}

      {showInvite && (
        <InviteModal
          teamId={currentTeam.id}
          players={players}
          onClose={() => setShowInvite(false)}
          onCreated={() => { setShowInvite(false); fetchAll(); }}
        />
      )}
    </div>
  );
}

function UsersTable({ users, canManage, onRoleChange, onLeave, onRestore }) {
  if (users.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 py-12 text-center">
        <UserCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">ユーザーが登録されていません</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ユーザー</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">メール</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">役割</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">最終ログイン</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状態</th>
            {canManage && (
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
            )}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {users.map((u) => {
            const ut = u.teams?.[0];
            const isLeft = ut && ut.isActive === false;
            return (
              <tr key={u.id} className={`hover:bg-gray-50 ${isLeft ? 'bg-gray-50/50' : ''}`}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
                      {u.avatarUrl ? (
                        <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <UserCircle className="w-6 h-6 text-gray-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className={`font-medium ${isLeft ? 'text-gray-500' : 'text-gray-900'}`}>{u.name}</div>
                      {u.userCode && <div className="text-xs text-gray-500 font-mono">{u.userCode}</div>}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{u.email}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {canManage && !isLeft ? (
                    <select
                      value={ut?.role || ''}
                      onChange={(e) => onRoleChange(u.id, e.target.value)}
                      className="text-sm border border-gray-300 rounded-lg px-2 py-1"
                    >
                      {Object.entries(ROLE_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-sm text-gray-700">{ROLE_LABELS[ut?.role] || ut?.role || '-'}</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="inline-flex items-center gap-1 text-sm text-gray-600">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    <span title={u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('ja-JP') : ''}>
                      {formatDateTime(u.lastLoginAt)}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {isLeft ? (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-700">
                      退団 ({formatDate(ut.leftAt)})
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                      在籍中
                    </span>
                  )}
                </td>
                {canManage && (
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    {isLeft ? (
                      <button
                        type="button"
                        onClick={() => onRestore(u.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100"
                        title="復帰"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                        復帰
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onLeave(u)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                        title="退団させる"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                        退団
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function LeaveTeamModal({ user, teamId, teamName, onClose, onDone }) {
  const today = new Date().toISOString().slice(0, 10);
  const [leftAt, setLeftAt] = useState(today);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/users/${user.id}/leave-team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ teamId, leftAt }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || '退団処理に失敗しました');
        return;
      }
      onDone();
    } catch (err) {
      console.error(err);
      setError('退団処理に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">退団処理</h2>
          <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900 mb-4">
          <p className="font-medium">{user.name} さんを <span className="font-bold">{teamName}</span> から退団させます。</p>
          <ul className="mt-2 text-xs space-y-0.5 text-amber-800 list-disc pl-4">
            <li>このユーザーはこのチームを編集・閲覧できなくなります。</li>
            <li>過去の評価・動画・タスクなどのデータはそのまま保持されます。</li>
            <li>選手として登録されている場合、ロスターからも非表示になります。</li>
            <li>後から「復帰」で元に戻せます。</li>
          </ul>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">退団日</label>
            <input
              type="date"
              value={leftAt}
              onChange={(e) => setLeftAt(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
              キャンセル
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60"
            >
              {submitting ? '処理中...' : '退団させる'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddExistingUserModal({ teamId, onClose, onDone }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('COACH');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/teams/${teamId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || '追加に失敗しました');
        return;
      }
      onDone();
    } catch (err) {
      console.error(err);
      setError('追加に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">既存ユーザーを追加</h2>
          <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          まだアカウントを持っていない方は「招待URL発行」をご利用ください。
        </p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">役割</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              {STAFF_ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>
          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
              キャンセル
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60"
            >
              {submitting ? '追加中...' : '追加する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InvitationsTable({ invitations, canManage, onChange }) {
  const handleDelete = async (id) => {
    if (!confirm('この招待URLを削除しますか？')) return;
    try {
      await fetch(`/api/invitations/${id}`, { method: 'DELETE', credentials: 'include' });
      onChange();
    } catch (err) {
      console.error(err);
    }
  };

  const copy = (token) => {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url).then(() => alert('URLをコピーしました'));
  };

  if (invitations.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 py-12 text-center">
        <Link2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">招待URLがありません</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">役割</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">対象</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">有効期限</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状態</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {invitations.map((inv) => (
            <tr key={inv.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {ROLE_LABELS[inv.role] || inv.role}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {inv.playerName || inv.player?.name || inv.email || '-'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {formatDate(inv.expiresAt)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                  inv.isUsed ? 'bg-green-100 text-green-700'
                    : inv.isExpired ? 'bg-red-100 text-red-700'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {inv.isUsed ? '使用済み' : inv.isExpired ? '期限切れ' : '有効'}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right">
                <div className="flex items-center justify-end gap-2">
                  {!inv.isUsed && !inv.isExpired && (
                    <button
                      onClick={() => copy(inv.token)}
                      className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                      title="URLをコピー"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  )}
                  {canManage && (
                    <button
                      onClick={() => handleDelete(inv.id)}
                      className="p-2 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                      title="削除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InviteModal({ teamId, players, onClose, onCreated }) {
  const [role, setRole] = useState('COACH');
  const [email, setEmail] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [expiryDays, setExpiryDays] = useState(7);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [issued, setIssued] = useState(null);
  const [copied, setCopied] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (role === 'PARENT' && !playerId) {
      setError('保護者招待の場合は対象選手を選択してください');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          teamId,
          role,
          email: email || null,
          playerName: role === 'PLAYER' ? playerName : null,
          playerId: role === 'PARENT' ? playerId : null,
          expiryDays,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '招待URLの発行に失敗しました');
        return;
      }
      const url = `${window.location.origin}${data.inviteUrl}`;
      setIssued({ ...data, url });
      try { await navigator.clipboard.writeText(url); setCopied(true); } catch { setCopied(false); }
    } catch (err) {
      console.error(err);
      setError('招待URLの発行に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const copy = async () => {
    if (!issued?.url) return;
    try { await navigator.clipboard.writeText(issued.url); setCopied(true); } catch { /* */ }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">招待URL発行</h2>
          <button
            type="button"
            onClick={() => { onCreated(); }}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!issued ? (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">役割</label>
              <select
                value={role}
                onChange={(e) => { setRole(e.target.value); setPlayerId(''); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                {Object.entries(ROLE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">{INVITE_ROLE_DESCRIPTIONS[role]}</p>
            </div>

            {role === 'PLAYER' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">選手名（任意）</label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="登録後に表示される選手名"
                />
              </div>
            )}

            {role === 'PARENT' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  対象選手 <span className="text-red-500">*</span>
                </label>
                <select
                  value={playerId}
                  onChange={(e) => setPlayerId(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">選手を選択...</option>
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.number ? ` (#${p.number})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">メール（任意）</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="招待先のメールアドレス"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">有効期間</label>
              <select
                value={expiryDays}
                onChange={(e) => setExpiryDays(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value={1}>1日</option>
                <option value={7}>7日</option>
                <option value={14}>14日</option>
                <option value={30}>30日</option>
              </select>
            </div>

            {error && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
                キャンセル
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60"
              >
                {submitting ? '発行中...' : '発行してURLをコピー'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-gray-700">招待URLを発行しました。下記URLを共有してください。</div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 break-all text-sm text-gray-800 font-mono">
              {issued.url}
            </div>
            <div className="text-xs text-gray-500">
              役割: <span className="font-medium text-gray-700">{ROLE_LABELS[issued.role] || issued.role}</span>
              {' / '}有効期限: <span className="font-medium text-gray-700">{new Date(issued.expiresAt).toLocaleString('ja-JP')}</span>
            </div>
            {copied && (
              <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1 inline-block">
                URLをクリップボードにコピーしました
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={copy}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                <Copy className="w-4 h-4" /> URLをコピー
              </button>
              <button
                type="button"
                onClick={onCreated}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                閉じる
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
