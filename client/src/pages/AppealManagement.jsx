import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Link2, Copy, Check, ExternalLink, Trash2, Plus, 
  Eye, EyeOff, Clock, MessageSquare, Star
} from 'lucide-react';
import clsx from 'clsx';

export default function AppealManagement() {
  const { playerData, currentTeam } = useAuth();
  const [appeals, setAppeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [editingAppeal, setEditingAppeal] = useState(null);
  
  const [formData, setFormData] = useState({
    selfPrText: '',
    expiresAt: ''
  });

  useEffect(() => {
    if (playerData?.id) {
      fetchAppeals();
    }
  }, [playerData]);

  const fetchAppeals = async () => {
    try {
      const res = await fetch(`/api/appeals/player/${playerData.id}`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setAppeals(data);
      }
    } catch (error) {
      console.error('Failed to fetch appeals:', error);
    } finally {
      setLoading(false);
    }
  };

  const createAppeal = async () => {
    try {
      const res = await fetch('/api/appeals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          playerId: playerData.id,
          type: 'simple',
          selfPrText: formData.selfPrText,
          expiresAt: formData.expiresAt || null
        })
      });

      if (res.ok) {
        const newAppeal = await res.json();
        setAppeals([newAppeal, ...appeals]);
        setShowCreateModal(false);
        setFormData({ selfPrText: '', expiresAt: '' });
      }
    } catch (error) {
      console.error('Failed to create appeal:', error);
    }
  };

  const updateAppeal = async (id, data) => {
    try {
      const res = await fetch(`/api/appeals/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });

      if (res.ok) {
        const updated = await res.json();
        setAppeals(appeals.map(a => a.id === id ? updated : a));
        setEditingAppeal(null);
      }
    } catch (error) {
      console.error('Failed to update appeal:', error);
    }
  };

  const toggleActive = async (id, isActive) => {
    await updateAppeal(id, { isActive: !isActive });
  };

  const copyToClipboard = async (url, id) => {
    try {
      const fullUrl = `${window.location.origin}${url}`;
      await navigator.clipboard.writeText(fullUrl);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '無期限';
    const date = new Date(dateStr);
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!playerData) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">選手として登録されていないため、アピールページを作成できません。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">アピールページ管理</h1>
          <p className="text-sm text-gray-600 mt-1">
            スカウトや関係者に共有できる公開プロフィールを作成・管理します
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
        >
          <Plus className="w-4 h-4" />
          新規作成
        </button>
      </div>

      {appeals.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Link2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            アピールページがありません
          </h3>
          <p className="text-gray-500 mb-6">
            「新規作成」ボタンからアピールページを作成して、<br />
            スカウトや関係者にプロフィールを共有しましょう
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
          >
            <Plus className="w-4 h-4" />
            最初のアピールページを作成
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {appeals.map((appeal) => (
            <div
              key={appeal.id}
              className={clsx(
                'bg-white rounded-xl shadow-sm border p-6',
                appeal.isActive && !appeal.isExpired ? 'border-green-200' : 'border-gray-200'
              )}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={clsx(
                    'w-3 h-3 rounded-full',
                    appeal.isActive && !appeal.isExpired ? 'bg-green-500' : 'bg-gray-300'
                  )} />
                  <span className={clsx(
                    'text-sm font-medium',
                    appeal.isActive && !appeal.isExpired ? 'text-green-700' : 'text-gray-500'
                  )}>
                    {appeal.isExpired ? '期限切れ' : appeal.isActive ? '公開中' : '非公開'}
                  </span>
                  <span className="text-xs text-gray-400">
                    作成: {formatDate(appeal.createdAt)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleActive(appeal.id, appeal.isActive)}
                    className={clsx(
                      'p-2 rounded-lg transition',
                      appeal.isActive 
                        ? 'text-yellow-600 hover:bg-yellow-50' 
                        : 'text-green-600 hover:bg-green-50'
                    )}
                    title={appeal.isActive ? '非公開にする' : '公開する'}
                  >
                    {appeal.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <a
                    href={appeal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition"
                    title="プレビュー"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <div className="flex items-center justify-between">
                  <code className="text-sm text-gray-600 truncate flex-1">
                    {window.location.origin}{appeal.url}
                  </code>
                  <button
                    onClick={() => copyToClipboard(appeal.url, appeal.id)}
                    className={clsx(
                      'ml-3 p-2 rounded-lg transition',
                      copiedId === appeal.id 
                        ? 'bg-green-100 text-green-600' 
                        : 'bg-white text-gray-600 hover:bg-gray-100'
                    )}
                  >
                    {copiedId === appeal.id ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>有効期限: {formatDate(appeal.expiresAt)}</span>
                </div>
                {appeal.type === 'recommended' && (
                  <div className="flex items-center gap-1 text-blue-600">
                    <Star className="w-4 h-4" />
                    <span>クラブ推薦</span>
                  </div>
                )}
              </div>

              {appeal.selfPrText && (
                <div className="bg-green-50 rounded-lg p-3 mb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <MessageSquare className="w-4 h-4 text-green-600" />
                    <span className="text-xs font-medium text-green-700">自己PR</span>
                  </div>
                  <p className="text-sm text-green-800 whitespace-pre-wrap line-clamp-3">
                    {appeal.selfPrText}
                  </p>
                </div>
              )}

              {appeal.recommendationText && (
                <div className="bg-blue-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Star className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-medium text-blue-700">コーチからの推薦</span>
                  </div>
                  <p className="text-sm text-blue-800 whitespace-pre-wrap line-clamp-3">
                    {appeal.recommendationText}
                  </p>
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
                <button
                  onClick={() => setEditingAppeal(appeal)}
                  className="text-sm text-primary-600 hover:text-primary-700"
                >
                  自己PRを編集
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">アピールページを作成</h2>
              <p className="text-sm text-gray-500 mt-1">
                スカウトや関係者に共有できる公開プロフィールを作成します
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  自己PR（任意）
                </label>
                <textarea
                  value={formData.selfPrText}
                  onChange={(e) => setFormData({ ...formData, selfPrText: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  rows={5}
                  placeholder="あなたの強みやアピールポイントを入力してください"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  有効期限（任意）
                </label>
                <input
                  type="date"
                  value={formData.expiresAt}
                  onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  設定しない場合は無期限で公開されます
                </p>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setFormData({ selfPrText: '', expiresAt: '' });
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                キャンセル
              </button>
              <button
                onClick={createAppeal}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
              >
                作成する
              </button>
            </div>
          </div>
        </div>
      )}

      {editingAppeal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">自己PRを編集</h2>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                自己PR
              </label>
              <textarea
                defaultValue={editingAppeal.selfPrText || ''}
                id="editSelfPr"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                rows={6}
                placeholder="あなたの強みやアピールポイントを入力してください"
              />
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setEditingAppeal(null)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                キャンセル
              </button>
              <button
                onClick={() => {
                  const textarea = document.getElementById('editSelfPr');
                  updateAppeal(editingAppeal.id, { selfPrText: textarea.value });
                }}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
