import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Users, ClipboardList, TrendingUp, Video } from 'lucide-react';

export default function Dashboard() {
  const { user, currentTeam, isOperator, isPlayer } = useAuth();
  const [stats, setStats] = useState({ players: 0, evaluations: 0, videos: 0 });
  const [recentEvaluations, setRecentEvaluations] = useState([]);

  useEffect(() => {
    if (currentTeam) {
      fetchStats();
    }
  }, [currentTeam]);

  const fetchStats = async () => {
    try {
      const playersRes = await fetch(`/api/players?teamId=${currentTeam.id}`, { credentials: 'include' });
      const players = await playersRes.json();
      setStats(prev => ({ ...prev, players: players.length }));
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>
        <p className="mt-1 text-sm text-gray-500">
          {currentTeam ? `${currentTeam.name}の概要` : 'ようこそ'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">選手数</p>
              <p className="text-2xl font-bold text-gray-900">{stats.players}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-50 rounded-lg">
              <ClipboardList className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">評価件数</p>
              <p className="text-2xl font-bold text-gray-900">{stats.evaluations}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-50 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">上達傾向</p>
              <p className="text-2xl font-bold text-gray-900">-</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-50 rounded-lg">
              <Video className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">動画数</p>
              <p className="text-2xl font-bold text-gray-900">{stats.videos}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">最近の評価</h2>
          {recentEvaluations.length > 0 ? (
            <div className="space-y-3">
              {recentEvaluations.map((eval_) => (
                <div key={eval_.id} className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">{eval_.playerName}</span>
                  <span className="text-sm text-gray-900">{eval_.score}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">まだ評価がありません</p>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">お知らせ</h2>
          <p className="text-sm text-gray-500">新しいお知らせはありません</p>
        </div>
      </div>
    </div>
  );
}
