import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Trophy, Medal, Filter, Users, TrendingUp } from 'lucide-react';

export default function Ranking() {
  const { currentTeam } = useAuth();
  const [rounds, setRounds] = useState([]);
  const [selectedRound, setSelectedRound] = useState('');
  const [ranking, setRanking] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedPosition, setSelectedPosition] = useState('');
  const [activeTab, setActiveTab] = useState('total');
  const [loading, setLoading] = useState(false);

  const positions = ['GK', 'DF', 'MF', 'FW'];

  useEffect(() => {
    if (currentTeam) {
      fetchRounds();
    }
  }, [currentTeam]);

  useEffect(() => {
    if (selectedRound) {
      fetchRanking();
    }
  }, [selectedRound, selectedCategory, selectedPosition, activeTab]);

  const fetchRounds = async () => {
    try {
      const res = await fetch(`/api/evaluations/rounds?teamId=${currentTeam.id}`, {
        credentials: 'include'
      });
      const data = await res.json();
      setRounds(data);
      if (data.length > 0) {
        setSelectedRound(data[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch rounds:', error);
    }
  };

  const fetchRanking = async () => {
    if (!selectedRound) return;
    setLoading(true);
    try {
      let url = `/api/evaluations/ranking?teamId=${currentTeam.id}&roundId=${selectedRound}`;
      if (activeTab === 'category' && selectedCategory) {
        url += `&category=${selectedCategory}`;
      }
      if (activeTab === 'position' && selectedPosition) {
        url += `&position=${selectedPosition}`;
      }

      const res = await fetch(url, { credentials: 'include' });
      const data = await res.json();
      setRanking(data.ranking || []);
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Failed to fetch ranking:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRankBadge = (rank) => {
    if (rank === 1) {
      return (
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-100">
          <Trophy className="w-5 h-5 text-yellow-600" />
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100">
          <Medal className="w-5 h-5 text-gray-500" />
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-100">
          <Medal className="w-5 h-5 text-orange-600" />
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-50 text-gray-600 font-semibold text-sm">
        {rank}
      </div>
    );
  };

  const getScoreBarWidth = (score, maxScore) => {
    if (!maxScore || maxScore === 0) return 0;
    return Math.min((score / maxScore) * 100, 100);
  };

  const maxScore = ranking.length > 0 ? Math.max(...ranking.map(r => r.totalScore)) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ランキング</h1>
        <p className="mt-1 text-sm text-gray-500">チーム内の評価スコアランキング</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">評価期間</label>
            <select
              value={selectedRound}
              onChange={(e) => setSelectedRound(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">選択してください</option>
              {rounds.map((round) => (
                <option key={round.id} value={round.id}>{round.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-2 mb-6 border-b border-gray-200">
          <button
            onClick={() => { setActiveTab('total'); setSelectedCategory(''); setSelectedPosition(''); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'total'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <TrendingUp className="w-4 h-4 inline-block mr-1" />
            総合ランキング
          </button>
          <button
            onClick={() => { setActiveTab('category'); setSelectedPosition(''); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'category'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Filter className="w-4 h-4 inline-block mr-1" />
            カテゴリー別
          </button>
          <button
            onClick={() => { setActiveTab('position'); setSelectedCategory(''); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'position'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users className="w-4 h-4 inline-block mr-1" />
            ポジション別
          </button>
        </div>

        {activeTab === 'category' && (
          <div className="mb-4 flex gap-2 flex-wrap">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {activeTab === 'position' && (
          <div className="mb-4 flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedPosition('')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                selectedPosition === ''
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              全ポジション
            </button>
            {positions.map((pos) => (
              <button
                key={pos}
                onClick={() => setSelectedPosition(pos)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  selectedPosition === pos
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {pos}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-2 text-sm text-gray-500">読み込み中...</p>
          </div>
        ) : ranking.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-2 font-medium text-gray-600 w-16">順位</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-600">選手</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-600 w-20">ポジション</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-600 w-48">スコア</th>
                  {activeTab === 'total' && categories.slice(0, 4).map((cat) => (
                    <th key={cat.id} className="text-center py-3 px-2 font-medium text-gray-600 w-20">
                      {cat.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ranking.map((item) => (
                  <tr key={item.player.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-2">
                      {getRankBadge(item.rank)}
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-3">
                        {item.player.photoUrl ? (
                          <img
                            src={item.player.photoUrl}
                            alt={item.player.name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                            <span className="text-primary-600 font-semibold text-sm">
                              {item.player.number || item.player.name?.charAt(0)}
                            </span>
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-900">{item.player.name}</p>
                          {item.player.number && (
                            <p className="text-xs text-gray-500">#{item.player.number}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      {item.player.position && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                          {item.player.position}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full transition-all duration-500"
                            style={{ width: `${getScoreBarWidth(item.totalScore, maxScore)}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-gray-900 w-12 text-right">
                          {item.totalScore}
                        </span>
                      </div>
                    </td>
                    {activeTab === 'total' && categories.slice(0, 4).map((cat) => (
                      <td key={cat.id} className="py-3 px-2 text-center">
                        <span className="text-sm font-medium text-gray-700">
                          {item.categoryScores[cat.id] || 0}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">
              {!selectedRound ? '評価期間を選択してください' : 'ランキングデータがありません'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
