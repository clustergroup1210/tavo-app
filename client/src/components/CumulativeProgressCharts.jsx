import React, { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const defaultCategoryColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function CumulativeProgressCharts({ progressData, categoryColors = defaultCategoryColors }) {
  const rawData = progressData?.progressData || [];
  const categories = progressData?.categories || [];

  const cumulativeData = useMemo(() => {
    let cumCoach = 0;
    let cumSelf = 0;
    const cumCatCoach = {};

    return rawData.map(d => {
      cumCoach += (d.coachTotal || 0);
      cumSelf += (d.selfTotal || 0);

      const catCumValues = {};
      categories.forEach(cat => {
        const catData = d.categories?.[cat];
        if (catData) {
          const catCoachVal = catData.coachTotal != null ? catData.coachTotal : (catData.coach ? parseFloat(catData.coach) : 0);
          cumCatCoach[cat] = (cumCatCoach[cat] || 0) + catCoachVal;
        }
        catCumValues[`${cat}_coach`] = Math.round((cumCatCoach[cat] || 0) * 10) / 10;
      });

      return {
        roundName: d.roundName,
        coachCum: d.coachTotal != null ? cumCoach : null,
        selfCum: d.selfTotal != null ? cumSelf : null,
        ...catCumValues
      };
    });
  }, [rawData, categories]);

  if (rawData.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-sm text-gray-500">評価データが蓄積されるとグラフが表示されます</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">累積スコア推移</h2>
        <div className="flex flex-wrap gap-4 mb-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-gray-600">指導者評価（累積）</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-gray-600">自己評価（累積）</span>
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cumulativeData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                dataKey="roundName"
                tick={{ fontSize: 11, fill: '#6B7280' }}
                angle={-20}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
                formatter={(value, name) => {
                  const labels = { coachCum: '指導者評価（累積）', selfCum: '自己評価（累積）' };
                  return [value ?? '-', labels[name] || name];
                }}
              />
              <Legend formatter={(value) => {
                const labels = { coachCum: '指導者評価（累積）', selfCum: '自己評価（累積）' };
                return labels[value] || value;
              }} />
              <Line
                type="monotone"
                dataKey="coachCum"
                stroke="#3B82F6"
                strokeWidth={2}
                dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="selfCum"
                stroke="#10B981"
                strokeWidth={2}
                dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          ※ 各ラウンドのスコアを積み上げた累積値を表示しています
        </p>
      </div>

      {categories.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">カテゴリ別累積推移（指導者評価）</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cumulativeData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="roundName"
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  angle={-20}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Legend />
                {categories.map((cat, idx) => (
                  <Line
                    key={cat}
                    type="monotone"
                    dataKey={`${cat}_coach`}
                    name={cat}
                    stroke={categoryColors[idx % categoryColors.length]}
                    strokeWidth={2}
                    dot={{ fill: categoryColors[idx % categoryColors.length], strokeWidth: 2, r: 3 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            ※ 各ラウンドのスコアを積み上げた累積値を表示しています
          </p>
        </div>
      )}
    </>
  );
}
