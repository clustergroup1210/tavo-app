import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Copy, Trash2, Link2, User, Users } from 'lucide-react';

export default function Invitations() {
  const { currentTeam } = useAuth();
  const [invitations, setInvitations] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newInvite, setNewInvite] = useState({ 
    role: 'PLAYER', 
    email: '', 
    playerName: '',
    playerId: '',
    expiryDays: 7 
  });

  useEffect(() => {
    if (currentTeam) {
      fetchInvitations();
      fetchPlayers();
    }
  }, [currentTeam]);

  const fetchInvitations = async () => {
    try {
      const res = await fetch(`/api/invitations?teamId=${currentTeam.id}`, {
        credentials: 'include',
      });
      const data = await res.json();
      setInvitations(data);
    } catch (error) {
      console.error('Failed to fetch invitations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlayers = async () => {
    try {
      const res = await fetch(`/api/players?teamId=${currentTeam.id}`, {
        credentials: 'include',
      });
      const data = await res.json();
      setPlayers(data);
    } catch (error) {
      console.error('Failed to fetch players:', error);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    
    if (newInvite.role === 'PARENT' && !newInvite.playerId) {
      alert('保護者招待の場合は選手を選択してください');
      return;
    }

    try {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          teamId: currentTeam.id,
          role: newInvite.role,
          email: newInvite.email || null,
          playerName: newInvite.role === 'PLAYER' ? newInvite.playerName : null,
          playerId: newInvite.role === 'PARENT' ? newInvite.playerId : null,
          expiryDays: newInvite.expiryDays
        }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        alert(data.error || '招待URLの発行に失敗しました');
        return;
      }
      
      setShowModal(false);
      setNewInvite({ role: 'PLAYER', email: '', playerName: '', playerId: '', expiryDays: 7 });
      fetchInvitations();

      const url = `${window.location.origin}${data.inviteUrl}`;
      navigator.clipboard.writeText(url);
      alert(`招待URLをコピーしました:\n${url}`);
    } catch (error) {
      console.error('Failed to create invitation:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('この招待を削除しますか？')) return;
    try {
      await fetch(`/api/invitations/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      fetchInvitations();
    } catch (error) {
      console.error('Failed to delete invitation:', error);
    }
  };

  const copyUrl = (token) => {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url);
    alert('URLをコピーしました');
  };

  const roleLabels = {
    TEAM_ADMIN: '管理者',
    TEAM_HEAD_COACH: '代表監督',
    TEAM_COACH: '担当コーチ',
    TEAM_EXTERNAL_COACH: '外部コーチ',
    PLAYER: '選手',
    PARENT: '保護者',
  };

  const roleDescriptions = {
    TEAM_ADMIN: 'チームの全権限',
    TEAM_HEAD_COACH: 'チーム全体の評価・管理',
    TEAM_COACH: '担当選手の評価・管理',
    TEAM_EXTERNAL_COACH: '限定的な評価権限',
    PLAYER: '自己評価・閲覧',
    PARENT: '子供の評価閲覧のみ',
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
          <h1 className="text-2xl font-bold text-gray-900">招待URL管理</h1>
          <p className="mt-1 text-sm text-gray-500">選手・保護者・スタッフを招待できます</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Plus className="w-4 h-4" />
          招待URL発行
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                役割
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                対象
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                有効期限
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                状態
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {invitations.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  招待URLがありません
                </td>
              </tr>
            ) : (
              invitations.map((invite) => (
                <tr key={invite.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-2">
                      {invite.role === 'PLAYER' ? (
                        <User className="w-4 h-4 text-blue-500" />
                      ) : invite.role === 'PARENT' ? (
                        <Users className="w-4 h-4 text-purple-500" />
                      ) : (
                        <Link2 className="w-4 h-4 text-gray-400" />
                      )}
                      <span className="text-sm font-medium text-gray-900">{roleLabels[invite.role]}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {invite.playerName || invite.player?.name || invite.email || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(invite.expiresAt).toLocaleDateString('ja-JP')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs rounded-full ${
                        invite.isUsed
                          ? 'bg-green-100 text-green-700'
                          : invite.isExpired
                          ? 'bg-red-100 text-red-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {invite.isUsed ? '使用済み' : invite.isExpired ? '期限切れ' : '有効'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      {!invite.isUsed && !invite.isExpired && (
                        <button
                          onClick={() => copyUrl(invite.token)}
                          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                          title="URLをコピー"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(invite.id)}
                        className="p-2 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                        title="削除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">招待URL発行</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">役割</label>
                <select
                  value={newInvite.role}
                  onChange={(e) => setNewInvite({ ...newInvite, role: e.target.value, playerId: '' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  {Object.entries(roleLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">{roleDescriptions[newInvite.role]}</p>
              </div>

              {newInvite.role === 'PLAYER' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    選手名（任意）
                  </label>
                  <input
                    type="text"
                    value={newInvite.playerName}
                    onChange={(e) => setNewInvite({ ...newInvite, playerName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="登録後に表示される選手名"
                  />
                </div>
              )}

              {newInvite.role === 'PARENT' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    対象選手 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={newInvite.playerId}
                    onChange={(e) => setNewInvite({ ...newInvite, playerId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    required
                  >
                    <option value="">選手を選択...</option>
                    {players.map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.name} {player.number ? `(#${player.number})` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">この選手の保護者として招待されます</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  メール（任意）
                </label>
                <input
                  type="email"
                  value={newInvite.email}
                  onChange={(e) => setNewInvite({ ...newInvite, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="招待先のメールアドレス"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">有効期間</label>
                <select
                  value={newInvite.expiryDays}
                  onChange={(e) => setNewInvite({ ...newInvite, expiryDays: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value={1}>1日</option>
                  <option value={7}>7日</option>
                  <option value={14}>14日</option>
                  <option value={30}>30日</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  発行してURLをコピー
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
