import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { TrendingUp } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell
} from 'recharts';

const categoryColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function PlayerProgress() {
  const { user, playerData } = useAuth();
  const [localPlayerData, setLocalPlayerData] = useState(null);
  const [progressData, setProgressData] = useState({ progressData: [], categories: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlayerData();
  }, [user, playerData]);

  const fetchPlayerData = async () => {
    try {
      if (playerData?.id) {
        setLocalPlayerData(playerData);
        await fetchProgressData(playerData.id);
      } else {
        const res = await fetch('/api/players', { credentials: 'include' });
        if (res.ok) {
          const players = await res.json();
          const myPlayer = players.find(p => p.userId === user?.id);
          if (myPlayer) {
            setLocalPlayerData(myPlayer);
            await fetchProgressData(myPlayer.id);
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch player data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProgressData = async (playerId) => {
    try {
      const res = await fetch(`/api/evaluations/progress/${playerId}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setProgressData(data);
      }
    } catch (error) {
      console.error('Failed to fetch progress data:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!localPlayerData) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">上達状況</h1>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-gray-500">選手データが見つかりません</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">上達状況</h1>
        <p className="mt-1 text-sm text-gray-500">評価データの推移を確認できます</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">総合スコア推移（合計点）</h2>
        {progressData.progressData.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={progressData.progressData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="roundName" tick={{ fontSize: 12 }} stroke="#6B7280" />
                <YAxis tick={{ fontSize: 12 }} stroke="#6B7280" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="coachTotal" 
                  name="指導者評価（合計）" 
                  stroke="#3B82F6" 
                  strokeWidth={2}
                  dot={{ fill: '#3B82F6', strokeWidth: 2 }}
                  connectNulls
                />
                <Line 
                  type="monotone" 
                  dataKey="selfTotal" 
                  name="自己評価（合計）" 
                  stroke="#10B981" 
                  strokeWidth={2}
                  dot={{ fill: '#10B981', strokeWidth: 2 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-center py-8">
            <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">評価データが蓄積されるとグラフが表示されます</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">評価ギャップ推移</h2>
        {progressData.progressData.length > 0 && progressData.progressData.some(d => d.gap !== null) ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={progressData.progressData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="roundName" tick={{ fontSize: 12 }} stroke="#6B7280" />
                <YAxis domain={[-2, 2]} tick={{ fontSize: 12 }} stroke="#6B7280" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                  formatter={(value) => [value?.toFixed(2), 'ギャップ (指導者 - 自己)']}
                />
                <ReferenceLine y={0} stroke="#9CA3AF" strokeDasharray="3 3" />
                <Bar 
                  dataKey="gap" 
                  name="ギャップ"
                  radius={[4, 4, 0, 0]}
                >
                  {progressData.progressData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.gap >= 0 ? '#3B82F6' : '#EF4444'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-center py-8">
            <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">ギャップデータがありません</p>
          </div>
        )}
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-600">
            <span className="font-medium text-blue-600">プラス (青)</span>: 指導者の方が高く評価 → 謙虚な自己評価<br />
            <span className="font-medium text-red-600">マイナス (赤)</span>: 自己評価の方が高い → 自己認識を見直そう
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">カテゴリ別推移（指導者評価）</h2>
        {progressData.progressData.length > 0 && progressData.categories.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={progressData.progressData.map(d => {
                const categoryData = { roundName: d.roundName };
                progressData.categories.forEach((cat) => {
                  categoryData[cat] = d.categories[cat]?.coach ? parseFloat(d.categories[cat].coach) : null;
                });
                return categoryData;
              })}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="roundName" tick={{ fontSize: 12 }} stroke="#6B7280" />
                <YAxis domain={[0, 5]} tick={{ fontSize: 12 }} stroke="#6B7280" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Legend />
                {progressData.categories.map((cat, idx) => (
                  <Line 
                    key={cat}
                    type="monotone" 
                    dataKey={cat} 
                    name={cat} 
                    stroke={categoryColors[idx % categoryColors.length]} 
                    strokeWidth={2}
                    dot={{ fill: categoryColors[idx % categoryColors.length], strokeWidth: 2 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-center py-8">
            <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">カテゴリ別データがありません</p>
          </div>
        )}
      </div>
    </div>
  );
}
