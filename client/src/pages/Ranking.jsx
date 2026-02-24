import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Trophy, Medal, Filter, Users, TrendingUp, Zap, ArrowUpDown } from 'lucide-react';

function getRateColor(rate) {
  if (rate >= 60) return 'text-blue-600';
  if (rate >= 40) return 'text-orange-500';
  return 'text-red-500';
}

function getRateBarColor(rate) {
  if (rate >= 60) return 'from-blue-400 to-blue-600';
  if (rate >= 40) return 'from-orange-300 to-orange-500';
  return 'from-red-400 to-red-600';
}

export default function Ranking() {
  const navigate = useNavigate();
  const { currentTeam } = useAuth();
  const [ranking, setRanking] = useState([]);
  const [categories, setCategories] = useState([]);
  const [teamCategories, setTeamCategories] = useState([]);
  const [selectedTeamCategory, setSelectedTeamCategory] = useState('');
  const [selectedPosition, setSelectedPosition] = useState('');
  const [activeTab, setActiveTab] = useState('total');
  const [sortBy, setSortBy] = useState('total');
  const [loading, setLoading] = useState(false);

  const positions = ['GK', 'DF', 'MF', 'FW'];

  useEffect(() => {
    if (currentTeam) {
      fetchRanking();
    }
  }, [currentTeam, selectedTeamCategory, selectedPosition]);

  const fetchRanking = async () => {
    if (!currentTeam) return;
    setLoading(true);
    try {
      let url = `/api/evaluations/ranking?teamId=${currentTeam.id}`;
      if (selectedTeamCategory) url += `&teamCategoryId=${selectedTeamCategory}`;
      if (selectedPosition) url += `&position=${selectedPosition}`;

      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setRanking(data.ranking || []);
        setCategories(data.categories || []);
        setTeamCategories(data.teamCategories || []);
      }
    } catch (error) {
      console.error('Failed to fetch ranking:', error);
    } finally {
      setLoading(false);
    }
  };

  const sortedRanking = useMemo(() => {
    if (!ranking.length) return [];
    const sorted = [...ranking];
    if (sortBy === 'total') {
      sorted.sort((a, b) => {
        const aRate = a.achievementRate !== null ? a.achievementRate : -1;
        const bRate = b.achievementRate !== null ? b.achievementRate : -1;
        return bRate - aRate;
      });
    } else {
      sorted.sort((a, b) => {
        const rateA = a.categoryRates?.[sortBy]?.rate ?? -1;
        const rateB = b.categoryRates?.[sortBy]?.rate ?? -1;
        return rateB - rateA;
      });
    }
    sorted.forEach((item, idx) => { item.rank = idx + 1; });
    return sorted;
  }, [ranking, sortBy]);

  const activeSortLabel = sortBy === 'total'
    ? '総合'
    : categories.find(c => c.id === sortBy)?.name || '総合';

  const getRankBadge = (rank) => {
    if (rank === 1) return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-100">
        <Trophy className="w-5 h-5 text-yellow-600" />
      </div>
    );
    if (rank === 2) return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100">
        <Medal className="w-5 h-5 text-gray-500" />
      </div>
    );
    if (rank === 3) return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-100">
        <Medal className="w-5 h-5 text-orange-600" />
      </div>
    );
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-50 text-gray-600 font-semibold text-sm">
        {rank}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ランキング</h1>
        <p className="mt-1 text-sm text-gray-500">累積達成率によるチーム内ランキング</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          <button
            onClick={() => { setActiveTab('total'); setSelectedTeamCategory(''); setSelectedPosition(''); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'total'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <TrendingUp className="w-4 h-4 inline-block mr-1" />
            総合ランキング
          </button>
          {teamCategories.length > 0 && (
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
          )}
          <button
            onClick={() => { setActiveTab('position'); setSelectedTeamCategory(''); }}
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

        {activeTab === 'category' && teamCategories.length > 0 && (
          <div className="mb-4 flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedTeamCategory('')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                selectedTeamCategory === ''
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              全て
            </button>
            {teamCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedTeamCategory(cat.id)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  selectedTeamCategory === cat.id
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

        {categories.length > 0 && (
          <div className="mb-4 flex items-center gap-2 flex-wrap">
            <ArrowUpDown className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-600">ソート：</span>
            <button
              onClick={() => setSortBy('total')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                sortBy === 'total'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              総合
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSortBy(cat.id)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  sortBy === cat.id
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-2 text-sm text-gray-500">読み込み中...</p>
          </div>
        ) : sortedRanking.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-2 font-medium text-gray-600 w-16">順位</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-600">選手</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-600 w-20">ポジション</th>
                  <th
                    className={`text-left py-3 px-2 font-medium w-56 cursor-pointer hover:bg-gray-50 select-none ${sortBy === 'total' ? 'text-primary-600' : 'text-gray-600'}`}
                    onClick={() => setSortBy('total')}
                  >
                    総合達成率{sortBy === 'total' ? ' ▼' : ''}
                  </th>
                  {categories.map((cat) => (
                    <th
                      key={cat.id}
                      className={`text-center py-3 px-2 font-medium w-20 cursor-pointer hover:bg-gray-50 select-none ${sortBy === cat.id ? 'text-primary-600' : 'text-gray-600'}`}
                      onClick={() => setSortBy(cat.id)}
                    >
                      {cat.name}{sortBy === cat.id ? ' ▼' : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedRanking.map((item) => {
                  const displayRate = sortBy === 'total'
                    ? item.achievementRate
                    : (item.categoryRates?.[sortBy]?.rate ?? null);
                  const hasRate = displayRate !== null;

                  return (
                    <tr key={item.player.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/players/${item.player.id}`)}>
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
                        {hasRate ? (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full bg-gradient-to-r ${getRateBarColor(displayRate)} rounded-full transition-all duration-500`}
                                style={{ width: `${Math.min(displayRate, 100)}%` }}
                              />
                            </div>
                            <span className={`text-sm font-bold w-16 text-right ${getRateColor(displayRate)}`}>
                              {displayRate}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">期間未登録</span>
                        )}
                      </td>
                      {categories.map((cat) => {
                        const catRate = item.categoryRates?.[cat.id];
                        const isActive = sortBy === cat.id;
                        const catHasRate = catRate?.rate !== null && catRate?.rate !== undefined;
                        return (
                          <td key={cat.id} className={`py-3 px-2 text-center ${isActive ? 'bg-primary-50' : ''}`}>
                            <span className={`text-sm font-medium ${catHasRate ? getRateColor(catRate.rate) : 'text-gray-400'}`}>
                              {catHasRate ? `${catRate.rate}%` : '-'}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">ランキングデータがありません</p>
          </div>
        )}

        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500">
            <Zap className="w-3.5 h-3.5 inline-block mr-1 text-gray-400" />
            達成率 = 累積獲得スコア ÷ (入団〜退団予定の総月数 × 月あたり満点) × 100　※入団日・退団予定日の登録が必要です
          </p>
        </div>
      </div>
    </div>
  );
}
