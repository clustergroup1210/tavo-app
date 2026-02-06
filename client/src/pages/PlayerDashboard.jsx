import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart3, TrendingUp, Target, Bell, ChevronRight, User, Award, Zap
} from 'lucide-react';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar, Cell, Area, AreaChart
} from 'recharts';

const COLORS = {
  coach: '#3b82f6',
  self: '#10b981',
  positive: '#22c55e',
  negative: '#ef4444'
};

const categoryColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

export default function PlayerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('summary');
  const [data, setData] = useState(null);
  const [achievementData, setAchievementData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [playerId, setPlayerId] = useState(null);

  useEffect(() => {
    fetchPlayerInfo();
  }, [user]);

  const fetchPlayerInfo = async () => {
    try {
      const res = await fetch('/api/player-dashboard/my-player', { credentials: 'include' });
      if (res.ok && res.status !== 204) {
        const myPlayer = await res.json();
        setPlayerId(myPlayer.id);
        fetchDashboardData(myPlayer.id);
        fetchAchievementData(myPlayer.id);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Failed to fetch player info:', error);
      setLoading(false);
    }
  };

  const fetchDashboardData = async (pid) => {
    try {
      const res = await fetch(`/api/player-dashboard/${pid}`, { credentials: 'include' });
      if (res.ok) {
        const dashboardData = await res.json();
        setData(dashboardData);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAchievementData = async (pid) => {
    try {
      const res = await fetch(`/api/player-dashboard/${pid}/achievement`, { credentials: 'include' });
      if (res.ok) {
        const adata = await res.json();
        setAchievementData(adata);
      } else {
        setAchievementData(null);
      }
    } catch (error) {
      console.error('Failed to fetch achievement data:', error);
      setAchievementData(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!playerId) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800">
          選手情報が見つかりません。管理者にお問い合わせください。
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'summary', label: 'ダッシュボード', icon: BarChart3 },
    { id: 'achievement', label: '累積達成率', icon: Zap },
    { id: 'evaluation', label: '評価分析', icon: Target },
    { id: 'progress', label: '上達状況', icon: TrendingUp }
  ];

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">マイダッシュボード</h1>
        {data?.player && (
          <p className="text-gray-600 mt-1">
            {data.player.teamName} {data.player.categoryName && `/ ${data.player.categoryName}`}
          </p>
        )}
      </div>

      <div className="mb-6 border-b border-gray-200">
        <nav className="flex space-x-1 overflow-x-auto" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'summary' && <SummaryTab data={data} achievementData={achievementData} navigate={navigate} />}
      {activeTab === 'achievement' && <AchievementTab data={achievementData} />}
      {activeTab === 'evaluation' && <EvaluationTab data={data} />}
      {activeTab === 'progress' && (
        <ProgressTab 
          data={data} 
          selectedCategory={selectedCategory} 
          setSelectedCategory={setSelectedCategory} 
        />
      )}
    </div>
  );
}

function SummaryTab({ data, achievementData, navigate }) {
  if (!data) return null;
  
  const { summary, notifications, nextActions } = data;
  const overallRate = achievementData?.overall?.coachRate ?? summary.achievementRate;
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-500">総合スコア</h3>
            <Award className="w-5 h-5 text-primary-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {summary.currentScore}
            <span className="text-lg font-normal text-gray-400"> / {summary.maxScore}</span>
          </div>
          {summary.latestRound && (
            <p className="text-sm text-gray-500 mt-2">
              {summary.latestRound.name}
            </p>
          )}
        </div>

        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-sm p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-indigo-100">累積達成率</h3>
            <Zap className="w-5 h-5 text-yellow-300" />
          </div>
          <div className="flex items-end gap-3">
            <div className="text-3xl font-bold">
              {overallRate}%
            </div>
            <div className="flex-1 mb-2">
              <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-yellow-300 to-yellow-400 rounded-full transition-all duration-500"
                  style={{ width: `${overallRate}%` }}
                />
              </div>
            </div>
          </div>
          <p className="text-xs text-indigo-200 mt-1">入団からの経験値</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-500">最新達成率</h3>
            <Target className="w-5 h-5 text-green-500" />
          </div>
          <div className="flex items-end gap-3">
            <div className="text-3xl font-bold text-gray-900">
              {summary.achievementRate}%
            </div>
            <div className="flex-1 mb-2">
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all duration-500"
                  style={{ width: `${summary.achievementRate}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-500">評価平均</h3>
            <BarChart3 className="w-5 h-5 text-blue-500" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">指導者評価</span>
              <span className="text-lg font-semibold text-blue-600">
                {summary.coachAvg ?? '-'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">自己評価</span>
              <span className="text-lg font-semibold text-green-600">
                {summary.selfAvg ?? '-'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {nextActions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">次のアクション</h3>
          {nextActions.map((action, idx) => (
            <div 
              key={idx}
              onClick={() => action.linkUrl && navigate(action.linkUrl)}
              className="bg-amber-50 border border-amber-200 rounded-lg p-4 cursor-pointer hover:bg-amber-100 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-amber-800">{action.title}</h4>
                  <p className="text-sm text-amber-600">{action.description}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-amber-500" />
              </div>
            </div>
          ))}
        </div>
      )}

      {notifications.unreadCount > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">未読通知</h3>
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
              {notifications.unreadCount}
            </span>
          </div>
          <div className="space-y-3">
            {notifications.recent.map((notif) => (
              <div 
                key={notif.id}
                onClick={() => notif.linkUrl && navigate(notif.linkUrl)}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <Bell className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">{notif.title}</p>
                  <p className="text-sm text-gray-500">{notif.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!data.evaluation.hasData && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <User className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-700">評価データがありません</h3>
          <p className="text-gray-500 mt-1">
            評価が入力されると、ここにデータが表示されます。
          </p>
        </div>
      )}
    </div>
  );
}

function getRateColor(rate) {
  if (rate >= 80) return 'bg-blue-500 text-white';
  if (rate >= 60) return 'bg-blue-400 text-white';
  if (rate >= 40) return 'bg-amber-400 text-white';
  if (rate >= 20) return 'bg-orange-500 text-white';
  return 'bg-red-500 text-white';
}

function getRateBarColor(rate) {
  if (rate >= 80) return 'from-blue-400 to-blue-600';
  if (rate >= 60) return 'from-blue-300 to-blue-500';
  if (rate >= 40) return 'from-amber-300 to-amber-500';
  if (rate >= 20) return 'from-orange-400 to-orange-600';
  return 'from-red-400 to-red-600';
}

function AchievementTab({ data }) {
  if (!data || (!data.categories?.length && !data.roundProgress?.length)) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <Zap className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-700">達成率データがありません</h3>
        <p className="text-gray-500 mt-1">
          評価が蓄積されると、累積達成率が表示されます。
        </p>
      </div>
    );
  }

  const { overall, categories, roundProgress } = data;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-lg p-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-yellow-400/20 rounded-lg flex items-center justify-center">
            <Zap className="w-6 h-6 text-yellow-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold">ACHIEVEMENT STATUS</h3>
            <p className="text-sm text-slate-400">入団からの累積達成率</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white/10 rounded-xl p-4">
            <p className="text-xs text-slate-400 mb-1">指導者評価 達成率</p>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-bold text-yellow-400">{overall.coachRate}</span>
              <span className="text-lg text-slate-400 mb-1">%</span>
            </div>
            <div className="mt-2 h-2 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full transition-all duration-700"
                style={{ width: `${overall.coachRate}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">{overall.coachActual} / {overall.coachMax} pts</p>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <p className="text-xs text-slate-400 mb-1">自己評価 達成率</p>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-bold text-cyan-400">{overall.selfRate}</span>
              <span className="text-lg text-slate-400 mb-1">%</span>
            </div>
            <div className="mt-2 h-2 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-cyan-400 to-teal-500 rounded-full transition-all duration-700"
                style={{ width: `${overall.selfRate}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">{overall.selfActual} / {overall.selfMax} pts</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-2 px-3 text-xs font-medium text-slate-400 uppercase tracking-wider">カテゴリ</th>
                <th className="text-center py-2 px-3 text-xs font-medium text-slate-400 uppercase tracking-wider">MAX</th>
                <th className="text-center py-2 px-3 text-xs font-medium text-slate-400 uppercase tracking-wider">獲得</th>
                <th className="text-center py-2 px-3 text-xs font-medium text-slate-400 uppercase tracking-wider min-w-[120px]">達成率</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat, idx) => (
                <tr key={cat.category} className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: categoryColors[idx % categoryColors.length] }} />
                      <span className="text-sm font-medium">{cat.category}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-center text-sm text-slate-400">{cat.coachMax}</td>
                  <td className="py-3 px-3 text-center text-sm font-medium text-yellow-400">{cat.coachActual}</td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className={`h-full bg-gradient-to-r ${getRateBarColor(cat.coachRate)} rounded-full transition-all duration-500`}
                          style={{ width: `${cat.coachRate}%` }}
                        />
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${getRateColor(cat.coachRate)}`}>
                        {cat.coachRate}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {roundProgress.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">累積達成率の推移</h3>
          <div className="flex flex-wrap gap-4 mb-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-gray-600">指導者評価</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-gray-600">自己評価</span>
            </div>
          </div>
          <div className="w-full" style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={roundProgress} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                <defs>
                  <linearGradient id="colorCoach" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorSelf" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="roundName" 
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  angle={-20}
                  textAnchor="end"
                  height={60}
                />
                <YAxis 
                  domain={[0, 100]} 
                  ticks={[0, 20, 40, 60, 80, 100]}
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  formatter={(value, name) => {
                    const label = name === 'overallCoachRate' ? '指導者達成率' : '自己達成率';
                    return [`${value}%`, label];
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="overallCoachRate"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  fill="url(#colorCoach)"
                  dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6 }}
                  connectNulls
                />
                <Area
                  type="monotone"
                  dataKey="overallSelfRate"
                  stroke="#10B981"
                  strokeWidth={2}
                  fill="url(#colorSelf)"
                  dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6 }}
                  connectNulls
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {roundProgress.length > 0 && categories.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">カテゴリ別達成率の推移</h3>
          <div className="w-full" style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart 
                data={roundProgress.map(r => {
                  const d = { roundName: r.roundName };
                  Object.entries(r.categories).forEach(([cat, rates]) => {
                    d[cat] = rates.coachRate;
                  });
                  return d;
                })} 
                margin={{ top: 10, right: 30, left: 10, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="roundName" 
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  angle={-20}
                  textAnchor="end"
                  height={60}
                />
                <YAxis 
                  domain={[0, 100]} 
                  ticks={[0, 20, 40, 60, 80, 100]}
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  formatter={(value, name) => [`${value}%`, name]}
                />
                <Legend />
                {categories.map((cat, idx) => (
                  <Line
                    key={cat.category}
                    type="monotone"
                    dataKey={cat.category}
                    stroke={categoryColors[idx % categoryColors.length]}
                    strokeWidth={2}
                    dot={{ fill: categoryColors[idx % categoryColors.length], strokeWidth: 2, r: 3 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

function EvaluationTab({ data }) {
  if (!data?.evaluation?.hasData) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <Target className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-700">評価データがありません</h3>
        <p className="text-gray-500 mt-1">
          評価が入力されると、詳細な分析が表示されます。
        </p>
      </div>
    );
  }

  const { radarData, gapAnalysis } = data.evaluation;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">カテゴリ別評価</h3>
        <div className="flex flex-wrap gap-4 mb-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-gray-600">指導者評価</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-gray-600">自己評価</span>
          </div>
        </div>
        <div className="w-full" style={{ height: '350px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis 
                dataKey="category" 
                tick={{ fill: '#6b7280', fontSize: 12 }}
              />
              <PolarRadiusAxis 
                angle={90} 
                domain={[0, 5]} 
                tick={{ fill: '#9ca3af', fontSize: 10 }}
              />
              <Radar
                name="指導者評価"
                dataKey="coach"
                stroke={COLORS.coach}
                fill={COLORS.coach}
                fillOpacity={0.3}
                strokeWidth={2}
              />
              <Radar
                name="自己評価"
                dataKey="self"
                stroke={COLORS.self}
                fill={COLORS.self}
                fillOpacity={0.3}
                strokeWidth={2}
              />
              <Tooltip 
                formatter={(value, name) => [value, name]}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">ギャップ分析</h3>
        <p className="text-sm text-gray-500 mb-4">
          指導者評価と自己評価の差を表示しています。プラスは指導者評価が高い項目、マイナスは自己評価が高い項目です。
        </p>
        
        {gapAnalysis.length > 0 ? (
          <div className="w-full" style={{ height: Math.max(200, gapAnalysis.length * 50) + 'px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={gapAnalysis} 
                layout="vertical"
                margin={{ top: 10, right: 30, left: 80, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis 
                  type="number" 
                  domain={[-3, 3]} 
                  ticks={[-3, -2, -1, 0, 1, 2, 3]}
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                />
                <YAxis 
                  type="category" 
                  dataKey="category" 
                  tick={{ fill: '#374151', fontSize: 12 }}
                  width={70}
                />
                <Tooltip 
                  formatter={(value) => [value, 'ギャップ']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                />
                <Bar dataKey="gap" name="ギャップ">
                  {gapAnalysis.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.gap >= 0 ? COLORS.positive : COLORS.negative} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">
            両方の評価データが揃うとギャップ分析が表示されます。
          </p>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">詳細スコア</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">カテゴリ</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">指導者評価</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">自己評価</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">ギャップ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {radarData.map((item, idx) => {
                const gap = item.coach && item.self ? Math.round((item.coach - item.self) * 10) / 10 : null;
                return (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{item.category}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-medium text-blue-600">{item.coach || '-'}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-medium text-green-600">{item.self || '-'}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {gap !== null ? (
                        <span className={`font-medium ${gap > 0 ? 'text-green-600' : gap < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                          {gap > 0 ? '+' : ''}{gap}
                        </span>
                      ) : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ProgressTab({ data, selectedCategory, setSelectedCategory }) {
  if (!data?.progress?.progressData?.length) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-700">進捗データがありません</h3>
        <p className="text-gray-500 mt-1">
          複数の評価ラウンドのデータが蓄積されると、成長の推移が表示されます。
        </p>
      </div>
    );
  }

  const { progressData, categories } = data.progress;

  const chartData = progressData.map(d => {
    if (selectedCategory === 'all') {
      return {
        name: d.roundName,
        coach: d.coachAvg,
        self: d.selfAvg
      };
    } else {
      return {
        name: d.roundName,
        coach: d.categories[selectedCategory]?.coach || null,
        self: d.categories[selectedCategory]?.self || null
      };
    }
  });

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h3 className="text-lg font-semibold text-gray-900">評価推移</h3>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="all">総合平均</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-4 mb-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-gray-600">指導者評価</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-gray-600">自己評価</span>
          </div>
        </div>

        <div className="w-full" style={{ height: '300px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="name" 
                tick={{ fill: '#6b7280', fontSize: 11 }}
                angle={-20}
                textAnchor="end"
                height={60}
              />
              <YAxis 
                domain={[0, 5]} 
                ticks={[0, 1, 2, 3, 4, 5]}
                tick={{ fill: '#6b7280', fontSize: 12 }}
              />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                formatter={(value, name) => {
                  const label = name === 'coach' ? '指導者評価' : '自己評価';
                  return [value, label];
                }}
              />
              <Line
                type="monotone"
                dataKey="coach"
                stroke={COLORS.coach}
                strokeWidth={2}
                dot={{ fill: COLORS.coach, strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="self"
                stroke={COLORS.self}
                strokeWidth={2}
                dot={{ fill: COLORS.self, strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">ラウンド別スコア</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ラウンド</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">指導者合計</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">自己合計</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">指導者平均</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">自己平均</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {progressData.map((round, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{round.roundName}</td>
                  <td className="px-4 py-3 text-center text-sm text-blue-600 font-medium">
                    {round.coachTotal ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-green-600 font-medium">
                    {round.selfTotal ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-blue-600">
                    {round.coachAvg ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-green-600">
                    {round.selfAvg ?? '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
