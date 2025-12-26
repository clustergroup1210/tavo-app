import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { UserCircle, Building2, Calendar, Ruler, Scale, Footprints, Star, Clock, User, AlertCircle } from 'lucide-react';

export default function AppealPublic() {
  const { token } = useParams();
  const [appeal, setAppeal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAppeal();
  }, [token]);

  const fetchAppeal = async () => {
    try {
      const res = await fetch(`/api/appeals/public/${token}`);
      if (res.status === 410) {
        const data = await res.json();
        setError(data.error || 'このアピールページは有効期限が切れています');
        return;
      }
      if (!res.ok) {
        throw new Error('アピールページが見つかりません');
      }
      const data = await res.json();
      setAppeal(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  };

  const calculateAge = (birthDate) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  const { player, issuer, evaluationCategories, type, comment, expiresAt } = appeal;
  const age = calculateAge(player.birthDate);

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-8 py-6 text-white">
            <div className="flex items-start gap-6">
              {player.photoUrl ? (
                <img
                  src={player.photoUrl}
                  alt={player.name}
                  className="w-24 h-24 rounded-xl object-cover border-2 border-white/30"
                />
              ) : (
                <div className="w-24 h-24 rounded-xl bg-white/20 flex items-center justify-center">
                  <UserCircle className="w-14 h-14 text-white/70" />
                </div>
              )}
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  {player.number && (
                    <span className="text-3xl font-bold text-white/80">#{player.number}</span>
                  )}
                  <h1 className="text-2xl font-bold">{player.name}</h1>
                </div>
                {player.nameRomaji && (
                  <p className="text-sm text-white/70 mt-1">{player.nameRomaji}</p>
                )}
                <div className="flex flex-wrap gap-3 mt-3">
                  {player.position && (
                    <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-medium">
                      {player.position}
                    </span>
                  )}
                  {age && (
                    <span className="px-3 py-1 bg-white/20 rounded-full text-sm">
                      {age}歳
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="p-8">
            {player.team && (
              <div className="flex items-center gap-3 mb-6 p-4 bg-gray-50 rounded-xl">
                {player.team.logoUrl ? (
                  <img
                    src={player.team.logoUrl}
                    alt=""
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-gray-400" />
                  </div>
                )}
                <div>
                  <span className="font-medium text-gray-900">{player.team.name}</span>
                  <p className="text-xs text-gray-500">所属チーム</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              {player.height && (
                <div className="flex items-center gap-2 text-sm">
                  <Ruler className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">{player.height}cm</span>
                </div>
              )}
              {player.weight && (
                <div className="flex items-center gap-2 text-sm">
                  <Scale className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">{player.weight}kg</span>
                </div>
              )}
              {player.dominantFoot && (
                <div className="flex items-center gap-2 text-sm">
                  <Footprints className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">{player.dominantFoot}</span>
                </div>
              )}
              {player.birthDate && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">{formatDate(player.birthDate)}</span>
                </div>
              )}
            </div>

            {type === 'recommended' && (player.roleModel || player.playStyle) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                {player.roleModel && (
                  <div className="p-4 bg-amber-50 rounded-lg border border-amber-100">
                    <p className="text-xs font-medium text-amber-700 mb-1">憧れの選手</p>
                    <p className="text-sm text-amber-900">{player.roleModel}</p>
                  </div>
                )}
                {player.playStyle && (
                  <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
                    <p className="text-xs font-medium text-purple-700 mb-1">プレースタイル</p>
                    <p className="text-sm text-purple-900">{player.playStyle}</p>
                  </div>
                )}
              </div>
            )}

            {type === 'recommended' && comment && (
              <div className="mb-8 p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-4 h-4 text-blue-600" />
                  <p className="text-sm font-semibold text-blue-800">推薦コメント</p>
                </div>
                <p className="text-sm text-blue-700 leading-relaxed">{comment}</p>
              </div>
            )}

            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="w-1 h-5 bg-primary-600 rounded-full"></span>
                評価サマリー
              </h2>
              {evaluationCategories && evaluationCategories.length > 0 ? (
                <div className="space-y-6">
                  {evaluationCategories.map((category) => (
                    <div key={category.name} className="border border-gray-200 rounded-xl overflow-hidden">
                      <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                        <span className="font-medium text-gray-900">{category.name}</span>
                        <div className="flex items-center gap-4 text-sm">
                          {category.avgCoachScore && (
                            <span className="text-primary-600 font-medium">
                              指導者: {category.avgCoachScore}
                            </span>
                          )}
                          {category.avgSelfScore && (
                            <span className="text-gray-500">
                              自己: {category.avgSelfScore}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {category.items.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between px-4 py-3">
                            <span className="text-sm text-gray-600">{item.name}</span>
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2">
                                <div className="w-24 bg-gray-200 rounded-full h-2">
                                  <div
                                    className="bg-primary-600 rounded-full h-2 transition-all"
                                    style={{ width: `${((item.coachScore || 0) / 5) * 100}%` }}
                                  />
                                </div>
                                <span className="text-sm font-medium text-gray-900 w-6 text-right">
                                  {item.coachScore || '-'}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-8 bg-gray-50 rounded-xl">
                  評価データがありません
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm text-sm text-gray-600">
            <User className="w-4 h-4" />
            <span>
              このページは
              <span className="font-medium text-gray-900 mx-1">
                {issuer.type === 'club' ? issuer.name : '選手本人'}
              </span>
              が発行しました
            </span>
          </div>
          {expiresAt && (
            <div className="flex items-center justify-center gap-1 text-xs text-gray-400">
              <Clock className="w-3 h-3" />
              <span>有効期限: {formatDate(expiresAt)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
