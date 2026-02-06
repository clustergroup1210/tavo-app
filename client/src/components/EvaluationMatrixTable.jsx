import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { BarChart3 } from 'lucide-react';

function getHeatmapColor(score, maxScore) {
  if (score === null || score === undefined) return '';
  const rate = maxScore > 0 ? score / maxScore : 0;
  if (rate >= 0.8) return 'bg-blue-100 text-blue-800';
  if (rate >= 0.6) return 'bg-green-100 text-green-800';
  if (rate >= 0.4) return 'bg-yellow-100 text-yellow-800';
  if (rate >= 0.2) return 'bg-orange-100 text-orange-800';
  return 'bg-red-100 text-red-800';
}

export default function EvaluationMatrixTable() {
  const { currentTeam } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentTeam) return;
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/evaluation-matrix/${currentTeam.id}`, { credentials: 'include' });
        if (res.ok) {
          setData(await res.json());
        }
      } catch (err) {
        console.error('Failed to fetch matrix:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentTeam]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!data || !data.players?.length) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-700">評価データがありません</h3>
        <p className="text-gray-500 mt-1">選手の評価データが蓄積されると、マトリクス表が表示されます。</p>
      </div>
    );
  }

  const { months, players } = data;

  const COL_NUM_W = 50;
  const COL_NAME_W = 100;
  const COL_CAT_W = 100;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">選手別評価マトリクス</h3>
        <div className="flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-200"></span>~20%</span>
          <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-100 border border-orange-200"></span>~40%</span>
          <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-200"></span>~60%</span>
          <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 border border-green-200"></span>~80%</span>
          <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-100 border border-blue-200"></span>80%~</span>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <table className="border-collapse min-w-full">
          <thead>
            <tr className="bg-gray-50">
              <th
                className="sticky left-0 z-20 bg-gray-50 border-b border-r border-gray-200 px-2 py-3 text-xs font-medium text-gray-500 text-center whitespace-nowrap"
                style={{ width: COL_NUM_W, minWidth: COL_NUM_W }}
              >
                No.
              </th>
              <th
                className="sticky z-20 bg-gray-50 border-b border-r border-gray-200 px-2 py-3 text-xs font-medium text-gray-500 text-left whitespace-nowrap"
                style={{ left: COL_NUM_W, width: COL_NAME_W, minWidth: COL_NAME_W }}
              >
                氏名
              </th>
              <th
                className="sticky z-20 bg-gray-50 border-b border-r border-gray-200 px-2 py-3 text-xs font-medium text-gray-500 text-left whitespace-nowrap"
                style={{ left: COL_NUM_W + COL_NAME_W, width: COL_CAT_W, minWidth: COL_CAT_W }}
              >
                項目
              </th>
              {months.map((m, i) => (
                <th
                  key={i}
                  className="border-b border-r border-gray-200 px-3 py-3 text-xs font-medium text-gray-500 text-center whitespace-nowrap"
                  style={{ minWidth: 70 }}
                >
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map((player) => {
              const rowCount = player.rows.length;
              return player.rows.map((row, rowIdx) => (
                <tr key={`${player.id}_${rowIdx}`} className={rowIdx === rowCount - 1 ? 'border-b-2 border-gray-300' : ''}>
                  {rowIdx === 0 && (
                    <>
                      <td
                        rowSpan={rowCount}
                        className="sticky left-0 z-10 bg-white border-b border-r border-gray-200 px-2 py-2 text-sm font-bold text-gray-700 text-center align-top whitespace-nowrap"
                        style={{ width: COL_NUM_W, minWidth: COL_NUM_W }}
                      >
                        {player.number ?? '-'}
                      </td>
                      <td
                        rowSpan={rowCount}
                        className="sticky z-10 bg-white border-b border-r border-gray-200 px-2 py-2 text-sm font-medium text-gray-900 align-top whitespace-nowrap"
                        style={{ left: COL_NUM_W, width: COL_NAME_W, minWidth: COL_NAME_W }}
                      >
                        {player.name}
                      </td>
                    </>
                  )}
                  <td
                    className="sticky z-10 bg-white border-b border-r border-gray-200 px-2 py-2 text-xs text-gray-600 whitespace-nowrap"
                    style={{ left: COL_NUM_W + COL_NAME_W, width: COL_CAT_W, minWidth: COL_CAT_W }}
                  >
                    {row.category}
                  </td>
                  {row.scores.map((score, sIdx) => (
                    <td
                      key={sIdx}
                      className={`border-b border-r border-gray-200 px-2 py-2 text-center text-sm font-medium whitespace-nowrap ${
                        score !== null ? getHeatmapColor(score, row.maxScore) : 'text-gray-300'
                      }`}
                      style={{ minWidth: 70 }}
                    >
                      {score !== null ? `${score}/${row.maxScore}` : '-'}
                    </td>
                  ))}
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
