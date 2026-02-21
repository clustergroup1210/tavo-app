import React, { useState, useEffect } from 'react';
import { BarChart3 } from 'lucide-react';

function getHeatmapColor(entry) {
  if (!entry || entry.score === null || entry.score === undefined) return 'bg-gray-50 text-gray-300';
  const rate = entry.max > 0 ? entry.score / entry.max : 0;
  if (rate >= 0.8) return 'bg-blue-100 text-blue-800';
  if (rate >= 0.6) return 'bg-green-100 text-green-800';
  if (rate >= 0.4) return 'bg-yellow-100 text-yellow-800';
  if (rate >= 0.2) return 'bg-orange-100 text-orange-800';
  return 'bg-red-100 text-red-800';
}

export default function PlayerMatrix({ playerId }) {
  const [matrix, setMatrix] = useState(null);
  const [matrixLoading, setMatrixLoading] = useState(true);

  useEffect(() => {
    if (!playerId) return;
    const fetchMatrix = async () => {
      try {
        const res = await fetch(`/api/evaluation-matrix/player/${playerId}`, { credentials: 'include' });
        if (res.ok) {
          setMatrix(await res.json());
        }
      } catch (err) {
        console.error('Failed to fetch player matrix:', err);
      } finally {
        setMatrixLoading(false);
      }
    };
    fetchMatrix();
  }, [playerId]);

  if (matrixLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!matrix || !matrix.rows?.length) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <BarChart3 className="w-10 h-10 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500">評価マトリクスデータがありません</p>
      </div>
    );
  }

  const formatMonth = (m) => {
    const parts = m.split('/');
    return parts.length === 2 ? `${parts[1]}月` : m;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="p-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">評価マトリクス（累積）</h3>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="inline-flex items-center gap-0.5"><span className="w-2.5 h-2.5 rounded bg-red-100 border border-red-200"></span>~20%</span>
          <span className="inline-flex items-center gap-0.5"><span className="w-2.5 h-2.5 rounded bg-orange-100 border border-orange-200"></span>~40%</span>
          <span className="inline-flex items-center gap-0.5"><span className="w-2.5 h-2.5 rounded bg-yellow-100 border border-yellow-200"></span>~60%</span>
          <span className="inline-flex items-center gap-0.5"><span className="w-2.5 h-2.5 rounded bg-green-100 border border-green-200"></span>~80%</span>
          <span className="inline-flex items-center gap-0.5"><span className="w-2.5 h-2.5 rounded bg-blue-100 border border-blue-200"></span>80%~</span>
        </div>
      </div>
      <div className="w-full overflow-x-auto">
        <table className="border-collapse min-w-full">
          <thead>
            <tr className="bg-gray-50">
              <th className="sticky left-0 z-10 bg-gray-50 border-b border-r border-gray-200 px-2 py-2 text-[10px] font-medium text-gray-500 text-left whitespace-nowrap" style={{ minWidth: 80 }}>
                項目
              </th>
              {matrix.months.map((m, i) => (
                <th key={i} className="border-b border-r border-gray-200 px-1 py-2 text-[10px] font-medium text-gray-500 text-center whitespace-nowrap" style={{ minWidth: 48 }}>
                  {formatMonth(m)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row, idx) => (
              <tr key={idx} className="border-b border-gray-100">
                <td className="sticky left-0 z-10 bg-white border-r border-gray-200 px-2 py-1.5 text-xs font-medium text-gray-700 whitespace-nowrap" style={{ minWidth: 80 }}>
                  {row.category}
                </td>
                {row.scores.map((entry, sIdx) => (
                  <td key={sIdx} className={`border-r border-gray-100 px-0.5 py-1.5 text-center text-[10px] font-medium whitespace-nowrap ${getHeatmapColor(entry)}`} style={{ minWidth: 48 }}>
                    {entry !== null ? entry.score : '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
