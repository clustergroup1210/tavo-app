import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UserCircle, TrendingUp, Video, Link2 } from 'lucide-react';

export default function MyPage() {
  const { user } = useAuth();
  const [playerData, setPlayerData] = useState(null);
  const [evaluationSummary, setEvaluationSummary] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyData();
  }, [user]);

  const fetchMyData = async () => {
    try {
      const playersRes = await fetch('/api/players', { credentials: 'include' });
      const players = await playersRes.json();
      const myPlayer = players.find(p => p.userId === user?.id);

      if (myPlayer) {
        setPlayerData(myPlayer);
        const summaryRes = await fetch(`/api/evaluations/summary/${myPlayer.id}`, {
          credentials: 'include',
        });
        const summary = await summaryRes.json();
        setEvaluationSummary(summary);
      }
    } catch (error) {
      console.error('Failed to fetch player data:', error);
    } finally {
      setLoading(false);
    }
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">マイページ</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-xl bg-gray-100 flex items-center justify-center">
            {playerData?.passportUrl ? (
              <img
                src={playerData.passportUrl}
                alt=""
                className="w-20 h-20 rounded-xl object-cover"
              />
            ) : (
              <UserCircle className="w-12 h-12 text-gray-400" />
            )}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {playerData?.name || user?.name}
            </h2>
            {playerData && (
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                <span>背番号: {playerData.number || '-'}</span>
                <span>ポジション: {playerData.position || '-'}</span>
                <span>チーム: {playerData.team?.name}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-primary-600" />
            <h3 className="text-lg font-semibold text-gray-900">評価サマリー</h3>
          </div>
          {evaluationSummary.length > 0 ? (
            <div className="space-y-3">
              {evaluationSummary.slice(0, 5).map((s) => (
                <div key={s.item.id} className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">{s.item.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold text-gray-900">{s.latestScore}</span>
                    {s.progress !== 0 && (
                      <span className={`text-xs ${s.progress > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {s.progress > 0 ? '+' : ''}{s.progress}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">まだ評価がありません</p>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Link2 className="w-5 h-5 text-primary-600" />
            <h3 className="text-lg font-semibold text-gray-900">アピールURL</h3>
          </div>
          {playerData && (
            <button
              onClick={async () => {
                try {
                  const res = await fetch('/api/appeals', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ playerId: playerData.id, type: 'simple' }),
                  });
                  const data = await res.json();
                  const url = `${window.location.origin}${data.url}`;
                  navigator.clipboard.writeText(url);
                  alert(`URLをコピーしました: ${url}`);
                } catch (error) {
                  console.error('Failed to create appeal:', error);
                }
              }}
              className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              アピールURLを発行
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
