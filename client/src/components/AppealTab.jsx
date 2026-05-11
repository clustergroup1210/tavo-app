import React, { useState } from 'react';
import { Link2, ExternalLink, Copy, Check, Edit2, Star, Eye, EyeOff } from 'lucide-react';
import clsx from 'clsx';
import AppealPreviewPanel from './AppealPreviewPanel';

export default function AppealTab({ player, isSelf, isCoachOrAdmin, onCreateAppeal, onRefresh }) {
  const [copiedId, setCopiedId] = useState(null);
  const [editingLink, setEditingLink] = useState(null);
  const [recommendationText, setRecommendationText] = useState('');
  const [saving, setSaving] = useState(false);
  const [previewToken, setPreviewToken] = useState(null);

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

  const handleEditRecommendation = (link) => {
    setEditingLink(link);
    setRecommendationText(link.recommendationText || '');
  };

  const handleSaveRecommendation = async () => {
    if (!editingLink) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/appeals/${editingLink.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ recommendationText })
      });
      if (res.ok) {
        setEditingLink(null);
        onRefresh?.();
      }
    } catch (error) {
      console.error('Failed to save recommendation:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (link) => {
    try {
      const res = await fetch(`/api/appeals/${link.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive: !link.isActive })
      });
      if (res.ok) {
        onRefresh?.();
      }
    } catch (error) {
      console.error('Failed to toggle active:', error);
    }
  };

  const handleCreateRecommended = async () => {
    try {
      const res = await fetch('/api/appeals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          playerId: player.id,
          type: 'recommended'
        })
      });
      if (res.ok) {
        onRefresh?.();
      }
    } catch (error) {
      console.error('Failed to create recommended appeal:', error);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">アピールURL</h2>
        <div className="flex gap-2">
          {isSelf && (
            <button
              onClick={() => onCreateAppeal('simple')}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm"
            >
              シンプル版を発行
            </button>
          )}
          {isCoachOrAdmin && (
            <button
              onClick={handleCreateRecommended}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center gap-2"
            >
              <Star className="w-4 h-4" />
              推薦付きを発行
            </button>
          )}
        </div>
      </div>

      {player.appealLinks?.length > 0 ? (
        <div className="space-y-4">
          {player.appealLinks.map((link) => (
            <div 
              key={link.id} 
              className={clsx(
                'p-4 rounded-lg border',
                link.isActive ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={clsx(
                    'w-2.5 h-2.5 rounded-full',
                    link.isActive ? 'bg-green-500' : 'bg-gray-300'
                  )} />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">
                        {link.type === 'simple' ? 'シンプル版' : '推薦付き'}
                      </p>
                      {link.type === 'recommended' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                          <Star className="w-3 h-3" />
                          クラブ推薦
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      作成: {new Date(link.createdAt).toLocaleDateString('ja-JP')}
                      {link.expiresAt && ` | 期限: ${new Date(link.expiresAt).toLocaleDateString('ja-JP')}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isCoachOrAdmin && (
                    <button
                      onClick={() => handleToggleActive(link)}
                      className={clsx(
                        'p-1.5 rounded transition',
                        link.isActive 
                          ? 'text-yellow-600 hover:bg-yellow-100' 
                          : 'text-green-600 hover:bg-green-100'
                      )}
                      title={link.isActive ? '非公開にする' : '公開する'}
                    >
                      {link.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  )}
                  <button
                    onClick={() => copyToClipboard(`/appeal/${link.token}`, link.id)}
                    className={clsx(
                      'p-1.5 rounded transition',
                      copiedId === link.id ? 'bg-green-100 text-green-600' : 'text-gray-400 hover:bg-gray-100'
                    )}
                    title="URLをコピー"
                  >
                    {copiedId === link.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => setPreviewToken(link.token)}
                    className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition"
                    title="プレビュー"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <a
                    href={`/appeal/${link.token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition"
                    title="新しいタブで開く"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {link.selfPrText && (
                <div className="mb-3 p-3 bg-white rounded-lg border border-green-100">
                  <p className="text-xs font-medium text-green-700 mb-1">自己PR</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-3">{link.selfPrText}</p>
                </div>
              )}

              {(link.recommendationText || isCoachOrAdmin) && (
                <div className="p-3 bg-white rounded-lg border border-blue-100">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium text-blue-700">コーチからの推薦</p>
                    {isCoachOrAdmin && (
                      <button
                        onClick={() => handleEditRecommendation(link)}
                        className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                      >
                        <Edit2 className="w-3 h-3" />
                        編集
                      </button>
                    )}
                  </div>
                  {link.recommendationText ? (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-3">
                      {link.recommendationText}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-400 italic">未設定</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Link2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-2">アピールURLがありません</p>
          <p className="text-sm text-gray-400">
            {isSelf 
              ? '「シンプル版を発行」ボタンからアピールページを作成できます' 
              : isCoachOrAdmin 
                ? '「推薦付きを発行」ボタンから推薦付きアピールページを作成できます'
                : ''
            }
          </p>
        </div>
      )}

      {previewToken && (
        <AppealPreviewPanel token={previewToken} onClose={() => setPreviewToken(null)} />
      )}

      {editingLink && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">推薦コメントを編集</h3>
              <p className="text-sm text-gray-500 mt-1">
                {player.name}さんへの推薦コメントを入力してください
              </p>
            </div>
            <div className="p-6">
              <textarea
                value={recommendationText}
                onChange={(e) => setRecommendationText(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                rows={6}
                placeholder="この選手の強みや将来性についてコメントしてください"
              />
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setEditingLink(null)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
                disabled={saving}
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveRecommendation}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
                disabled={saving}
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
