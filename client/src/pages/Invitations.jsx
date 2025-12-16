import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Copy, Trash2, Link2 } from 'lucide-react';

export default function Invitations() {
  const { currentTeam } = useAuth();
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newInvite, setNewInvite] = useState({ role: 'PLAYER', email: '', expiryDays: 7 });

  useEffect(() => {
    if (currentTeam) {
      fetchInvitations();
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

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...newInvite, teamId: currentTeam.id }),
      });
      const data = await res.json();
      setShowModal(false);
      setNewInvite({ role: 'PLAYER', email: '', expiryDays: 7 });
      fetchInvitations();

      const url = `${window.location.origin}${data.inviteUrl}`;
      navigator.clipboard.writeText(url);
      alert(`招待URLをコピーしました: ${url}`);
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
    TEAM_HEAD_COACH: '代表監督・コーチ',
    TEAM_COACH: '監督・コーチ',
    TEAM_EXTERNAL_COACH: '外部コーチ',
    PLAYER: '選手',
    PARENT: '保護者',
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
          <p className="mt-1 text-sm text-gray-500">新しいメンバーを招待できます</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Plus className="w-4 h-4" />
          招待URL発行
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                役割
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                メール
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
            {invitations.map((invite) => {
              const isExpired = new Date(invite.expiresAt) < new Date();
              const isUsed = !!invite.usedAt;

              return (
                <tr key={invite.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      <Link2 className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-900">{roleLabels[invite.role]}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {invite.email || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(invite.expiresAt).toLocaleDateString('ja-JP')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs rounded-full ${
                        isUsed
                          ? 'bg-green-100 text-green-700'
                          : isExpired
                          ? 'bg-red-100 text-red-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {isUsed ? '使用済み' : isExpired ? '期限切れ' : '有効'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      {!isUsed && !isExpired && (
                        <button
                          onClick={() => copyUrl(invite.token)}
                          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(invite.id)}
                        className="p-2 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
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
                  onChange={(e) => setNewInvite({ ...newInvite, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  {Object.entries(roleLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  メール（任意）
                </label>
                <input
                  type="email"
                  value={newInvite.email}
                  onChange={(e) => setNewInvite({ ...newInvite, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="招待先のメールアドレス"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">有効期間</label>
                <select
                  value={newInvite.expiryDays}
                  onChange={(e) => setNewInvite({ ...newInvite, expiryDays: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value={1}>1日</option>
                  <option value={7}>7日</option>
                  <option value={30}>30日</option>
                </select>
              </div>
              <div className="flex justify-end gap-3">
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
                  発行
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
