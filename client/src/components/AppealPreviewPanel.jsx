import React, { useState, useEffect, useRef } from 'react';
import {
  X, FileText, AlertCircle, UserCircle, Building2, Calendar,
  Ruler, Scale, Footprints, User, Star, Clock
} from 'lucide-react';
import clsx from 'clsx';

export default function AppealPreviewPanel({ token, onClose }) {
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
    const onKey = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
          <button onClick={handleClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition" aria-label="閉じる">
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
