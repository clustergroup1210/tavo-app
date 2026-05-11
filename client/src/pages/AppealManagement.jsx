import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Link2, Copy, Check, ExternalLink, Trash2, Plus, 
  Eye, EyeOff, Clock, MessageSquare, Star, X, ChevronRight,
  UserCircle, Building2, Calendar, Ruler, Scale, Footprints, User, AlertCircle, FileText
} from 'lucide-react';
import clsx from 'clsx';
import AppealPreviewPanel from '../components/AppealPreviewPanel';

function _LegacyAppealPreviewPanel({ token, onClose }) {
  const [appeal, setAppeal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`/api/appeals/public/${token}`);
        if (res.status === 410) {
          const data = await res.json();
          setError(data.error || 'このアピールページは有効期限が切れています');
          return;
        }
        if (!res.ok) throw new Error('アピールページが見つかりません');
        setAppeal(await res.json());
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  };

  const calculateAge = (birthDate) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className={clsx(
          'absolute inset-0 bg-black/40 transition-opacity duration-300',
          isVisible ? 'opacity-100' : 'opacity-0'
        )}
        onClick={handleClose}
      />

      <div
        ref={panelRef}
        className={clsx(
          'relative w-full max-w-lg bg-gray-100 shadow-2xl flex flex-col transition-transform duration-300 ease-out',
          isVisible ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary-600" />
            <span className="text-sm font-semibold text-gray-900">プレビュー</span>
            <span className="text-xs text-gray-400">外部から見た表示</span>
          </div>
          <button onClick={handleClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center py-20">
              <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
              <p className="text-sm text-gray-600">{error}</p>
            </div>
          )}

          {appeal && (() => {
            const { player, issuer, evaluationCategories, type, selfPrText, recommendationText, expiresAt } = appeal;
            const age = calculateAge(player.birthDate);
            return (
              <div className="p-4 sm:p-6">
                <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
                  <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-5 py-4 text-white">
                    <div className="flex items-start gap-4">
                      {player.photoUrl ? (
                        <img src={player.photoUrl} alt={player.name} className="w-16 h-16 rounded-lg object-cover border-2 border-white/30" />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-white/20 flex items-center justify-center">
                          <UserCircle className="w-10 h-10 text-white/70" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {player.number && <span className="text-2xl font-bold text-white/80">#{player.number}</span>}
                          <h2 className="text-lg font-bold truncate">{player.name}</h2>
                        </div>
                        {player.nameRomaji && <p className="text-xs text-white/70 mt-0.5">{player.nameRomaji}</p>}
                        <div className="flex flex-wrap gap-2 mt-2">
                          {player.position && <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs font-medium">{player.position}</span>}
                          {age && <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs">{age}歳</span>}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 space-y-5">
                    {player.team && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        {player.team.logoUrl ? (
                          <img src={player.team.logoUrl} alt="" className="w-8 h-8 rounded object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-gray-200 flex items-center justify-center">
                            <Building2 className="w-4 h-4 text-gray-400" />
                          </div>
                        )}
                        <div>
                          <span className="text-sm font-medium text-gray-900">{player.team.name}</span>
                          <p className="text-[10px] text-gray-500">所属チーム</p>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      {player.height && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <Ruler className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-gray-600">{player.height}cm</span>
                        </div>
                      )}
                      {player.weight && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <Scale className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-gray-600">{player.weight}kg</span>
                        </div>
                      )}
                      {player.dominantFoot && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <Footprints className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-gray-600">{player.dominantFoot}</span>
                        </div>
                      )}
                      {player.birthDate && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-gray-600">{formatDate(player.birthDate)}</span>
                        </div>
                      )}
                    </div>

                    {type === 'recommended' && (player.roleModel || player.playStyle) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {player.roleModel && (
                          <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                            <p className="text-[10px] font-medium text-amber-700 mb-0.5">憧れの選手</p>
                            <p className="text-xs text-amber-900">{player.roleModel}</p>
                          </div>
                        )}
                        {player.playStyle && (
                          <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                            <p className="text-[10px] font-medium text-purple-700 mb-0.5">プレースタイル</p>
                            <p className="text-xs text-purple-900">{player.playStyle}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {selfPrText && (
                      <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg">
                        <div className="flex items-center gap-1.5 mb-1">
                          <User className="w-3.5 h-3.5 text-green-600" />
                          <p className="text-xs font-semibold text-green-800">自己PR</p>
                        </div>
                        <p className="text-xs text-green-700 leading-relaxed whitespace-pre-wrap">{selfPrText}</p>
                      </div>
                    )}

                    {recommendationText && (
                      <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Star className="w-3.5 h-3.5 text-blue-600" />
                          <p className="text-xs font-semibold text-blue-800">推薦コメント</p>
                        </div>
                        <p className="text-xs text-blue-700 leading-relaxed whitespace-pre-wrap">{recommendationText}</p>
                      </div>
                    )}

                    {evaluationCategories && evaluationCategories.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
                          <span className="w-0.5 h-4 bg-primary-600 rounded-full"></span>
                          評価サマリー
                        </h3>
                        <div className="space-y-3">
                          {evaluationCategories.map((category) => (
                            <div key={category.name} className="border border-gray-200 rounded-lg overflow-hidden">
                              <div className="bg-gray-50 px-3 py-2 flex items-center justify-between">
                                <span className="text-xs font-medium text-gray-900">{category.name}</span>
                                <div className="flex items-center gap-3 text-[11px]">
                                  {category.avgCoachScore && <span className="text-primary-600 font-medium">指導者: {category.avgCoachScore}</span>}
                                  {category.avgSelfScore && <span className="text-gray-500">自己: {category.avgSelfScore}</span>}
                                </div>
                              </div>
                              <div className="divide-y divide-gray-100">
                                {category.items.map((item, idx) => (
                                  <div key={idx} className="flex items-center justify-between px-3 py-2">
                                    <span className="text-[11px] text-gray-600">{item.name}</span>
                                    <div className="flex items-center gap-2">
                                      <div className="w-16 bg-gray-200 rounded-full h-1.5">
                                        <div className="bg-primary-600 rounded-full h-1.5 transition-all" style={{ width: `${((item.coachScore || 0) / 5) * 100}%` }} />
                                      </div>
                                      <span className="text-[11px] font-medium text-gray-900 w-4 text-right">{item.coachScore || '-'}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 text-center space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full shadow-sm text-xs text-gray-600">
                    <User className="w-3 h-3" />
                    <span>
                      発行者:
                      <span className="font-medium text-gray-900 ml-1">
                        {issuer.type === 'club' ? issuer.name : '選手本人'}
                      </span>
                    </span>
                  </div>
                  {expiresAt && (
                    <div className="flex items-center justify-center gap-1 text-[10px] text-gray-400">
                      <Clock className="w-3 h-3" />
                      <span>有効期限: {formatDate(expiresAt)}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

export default function AppealManagement() {
  const { playerData, currentTeam } = useAuth();
  const [appeals, setAppeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [editingAppeal, setEditingAppeal] = useState(null);
  const [previewToken, setPreviewToken] = useState(null);
  
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
                  <button
                    onClick={() => setPreviewToken(appeal.token)}
                    className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition"
                    title="プレビュー"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <a
                    href={appeal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition"
                    title="新しいタブで開く"
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

              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                <button
                  onClick={() => setPreviewToken(appeal.token)}
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-600 transition"
                >
                  <FileText className="w-4 h-4" />
                  プレビューを表示
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
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

      {previewToken && (
        <AppealPreviewPanel
          token={previewToken}
          onClose={() => setPreviewToken(null)}
        />
      )}
    </div>
  );
}
