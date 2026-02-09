import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BarChart3, ArrowUpDown, Filter } from 'lucide-react';

function getHeatmapColor(score, maxScore) {
  if (score === null || score === undefined) return 'bg-gray-50 text-gray-300';
  const rate = maxScore > 0 ? score / maxScore : 0;
  if (rate >= 0.8) return 'bg-blue-100 text-blue-800';
  if (rate >= 0.6) return 'bg-green-100 text-green-800';
  if (rate >= 0.4) return 'bg-yellow-100 text-yellow-800';
  if (rate >= 0.2) return 'bg-orange-100 text-orange-800';
  return 'bg-red-100 text-red-800';
}

export default function EvaluationMatrixTable() {
  const navigate = useNavigate();
  const { currentTeam } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState('number');
  const [sortDir, setSortDir] = useState('asc');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterTeamCategory, setFilterTeamCategory] = useState('all');

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

  const filteredAndSorted = useMemo(() => {
    if (!data || !data.players) return [];

    let players = [...data.players];

    if (filterTeamCategory !== 'all') {
      players = players.filter(p => p.teamCategoryId === filterTeamCategory);
    }

    if (filterCategory !== 'all') {
      players = players.map(p => ({
        ...p,
        rows: p.rows.filter(r => r.category === filterCategory)
      })).filter(p => p.rows.length > 0);
    }

    players.sort((a, b) => {
      let valA, valB;
      switch (sortKey) {
        case 'number': {
          const numA = a.number ? parseInt(a.number, 10) : Infinity;
          const numB = b.number ? parseInt(b.number, 10) : Infinity;
          valA = isNaN(numA) ? Infinity : numA;
          valB = isNaN(numB) ? Infinity : numB;
          break;
        }
        case 'name':
          valA = a.name || '';
          valB = b.name || '';
          break;
        case 'position':
          valA = a.position || '';
          valB = b.position || '';
          break;
        case 'totalScore': {
          const sumA = a.rows.reduce((s, r) => s + r.scores.reduce((ss, sc) => ss + (sc || 0), 0), 0);
          const sumB = b.rows.reduce((s, r) => s + r.scores.reduce((ss, sc) => ss + (sc || 0), 0), 0);
          valA = sumA;
          valB = sumB;
          break;
        }
        case 'latestScore': {
          const lastA = a.rows.reduce((s, r) => {
            const lastVal = [...r.scores].reverse().find(sc => sc !== null);
            return s + (lastVal || 0);
          }, 0);
          const lastB = b.rows.reduce((s, r) => {
            const lastVal = [...r.scores].reverse().find(sc => sc !== null);
            return s + (lastVal || 0);
          }, 0);
          valA = lastA;
          valB = lastB;
          break;
        }
        default:
          valA = a.number ? parseInt(a.number, 10) : Infinity;
          valB = b.number ? parseInt(b.number, 10) : Infinity;
      }

      if (typeof valA === 'string') {
        const cmp = valA.localeCompare(valB, 'ja');
        return sortDir === 'asc' ? cmp : -cmp;
      }
      return sortDir === 'asc' ? valA - valB : valB - valA;
    });

    return players;
  }, [data, sortKey, sortDir, filterCategory, filterTeamCategory]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-700">データを取得できませんでした</h3>
        <p className="text-gray-500 mt-1">ページを再読み込みしてください。</p>
      </div>
    );
  }

  const { months, evalCategories = [], teamCategories = [] } = data;
  const hasPlayers = filteredAndSorted.length > 0;

  const COL_NUM_W = 50;
  const COL_NAME_W = 100;
  const COL_CAT_W = 100;

  const sortLabel = (key) => {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="p-4 border-b border-gray-200 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-lg font-semibold text-gray-900">選手別評価マトリクス</h3>
          <div className="flex items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-200"></span>~20%</span>
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-100 border border-orange-200"></span>~40%</span>
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-200"></span>~60%</span>
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 border border-green-200"></span>~80%</span>
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-100 border border-blue-200"></span>80%~</span>
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-50 border border-gray-200"></span>未入力</span>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {teamCategories.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-gray-400" />
              <select
                value={filterTeamCategory}
                onChange={(e) => setFilterTeamCategory(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="all">全カテゴリー</option>
                {teamCategories.map(tc => (
                  <option key={tc.id} value={tc.id}>{tc.name}</option>
                ))}
              </select>
            </div>
          )}

          {evalCategories.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-gray-400" />
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="all">全評価項目</option>
                {evalCategories.map(ec => (
                  <option key={ec.id} value={ec.name}>{ec.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={sortKey}
              onChange={(e) => { setSortKey(e.target.value); setSortDir('asc'); }}
              className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="number">背番号順</option>
              <option value="name">名前順</option>
              <option value="position">ポジション順</option>
              <option value="totalScore">合計スコア順</option>
              <option value="latestScore">最新スコア順</option>
            </select>
            <button
              onClick={() => setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="px-2 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              title={sortDir === 'asc' ? '昇順' : '降順'}
            >
              {sortDir === 'asc' ? '↑ 昇順' : '↓ 降順'}
            </button>
          </div>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <table className="border-collapse min-w-full">
          <thead>
            <tr className="bg-gray-50">
              <th
                className="sticky left-0 z-20 bg-gray-50 border-b border-r border-gray-200 px-2 py-3 text-xs font-medium text-gray-500 text-center whitespace-nowrap cursor-pointer hover:bg-gray-100 select-none"
                style={{ width: COL_NUM_W, minWidth: COL_NUM_W }}
                onClick={() => handleSort('number')}
              >
                No.{sortLabel('number')}
              </th>
              <th
                className="sticky z-20 bg-gray-50 border-b border-r border-gray-200 px-2 py-3 text-xs font-medium text-gray-500 text-left whitespace-nowrap cursor-pointer hover:bg-gray-100 select-none"
                style={{ left: COL_NUM_W, width: COL_NAME_W, minWidth: COL_NAME_W }}
                onClick={() => handleSort('name')}
              >
                氏名{sortLabel('name')}
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
            {hasPlayers ? (
              filteredAndSorted.map((player) => {
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
                          className="sticky z-10 bg-white border-b border-r border-gray-200 px-2 py-2 text-sm font-medium align-top whitespace-nowrap"
                          style={{ left: COL_NUM_W, width: COL_NAME_W, minWidth: COL_NAME_W }}
                        >
                          <button
                            onClick={() => navigate(`/players/${player.id}`)}
                            className="text-primary-600 hover:text-primary-800 hover:underline text-left font-medium"
                          >
                            {player.name}
                          </button>
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
                        className={`border-b border-r border-gray-200 px-2 py-2 text-center text-sm font-medium whitespace-nowrap ${getHeatmapColor(score, row.maxScore)}`}
                        style={{ minWidth: 70 }}
                      >
                        {score !== null && score !== undefined ? `${score}/${row.maxScore}` : '-'}
                      </td>
                    ))}
                  </tr>
                ));
              })
            ) : (
              <tr>
                <td
                  colSpan={3 + months.length}
                  className="px-4 py-12 text-center"
                >
                  <BarChart3 className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">
                    {data.players?.length > 0
                      ? '条件に一致する選手がいません。フィルターを変更してください。'
                      : '選手が登録されると、ここにマトリクスが表示されます。'}
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
