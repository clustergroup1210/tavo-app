import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import CumulativeProgressCharts from '../components/CumulativeProgressCharts';

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
        setProgressData(data || { progressData: [], categories: [] });
      } else {
        console.error('Progress data fetch failed:', res.status);
        setProgressData({ progressData: [], categories: [] });
      }
    } catch (error) {
      console.error('Failed to fetch progress data:', error);
      setProgressData({ progressData: [], categories: [] });
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

      <CumulativeProgressCharts progressData={progressData} categoryColors={categoryColors} />
    </div>
  );
}
