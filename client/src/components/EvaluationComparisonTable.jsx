import React from 'react';

const scoreHeatmapColors = {
  1: 'bg-gray-100 text-gray-700',
  2: 'bg-blue-100 text-blue-700',
  3: 'bg-blue-200 text-blue-800',
  4: 'bg-blue-300 text-blue-900',
  5: 'bg-blue-500 text-white',
};

const getGapBadge = (gap) => {
  if (gap === null || gap === undefined) {
    return <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-400">-</span>;
  }
  if (gap > 0) {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
        +{gap}
      </span>
    );
  }
  if (gap < 0) {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
        {gap}
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
      0
    </span>
  );
};

const ScoreCell = ({ score }) => {
  if (score === null || score === undefined) {
    return (
      <td className="px-2 sm:px-4 py-2 sm:py-3 text-center">
        <span className="text-gray-400">-</span>
      </td>
    );
  }
  const colorClass = scoreHeatmapColors[score] || 'bg-gray-100 text-gray-700';
  return (
    <td className="px-2 sm:px-4 py-2 sm:py-3 text-center">
      <span className={`inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg font-semibold text-sm ${colorClass}`}>
        {score}
      </span>
    </td>
  );
};

export default function EvaluationComparisonTable({ data, loading, hasData = true }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!hasData || !data || data.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <p className="text-gray-500">
          {hasData === false ? '評価データがまだありません' : '表示する評価項目がありません'}
        </p>
        <p className="text-xs text-gray-400 mt-1">指導者評価と自己評価が入力されると比較表示されます</p>
      </div>
    );
  }

  const groupedByCategory = data.reduce((acc, item) => {
    const cat = item.category || '未分類';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <div className="overflow-x-auto -mx-2 sm:mx-0">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              大項目
            </th>
            <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              評価項目
            </th>
            <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              指導者
            </th>
            <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              自己
            </th>
            <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              差
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {Object.entries(groupedByCategory).map(([category, items], catIdx) => (
            <React.Fragment key={category}>
              {items.map((item, idx) => (
                <tr key={item.itemId} className="hover:bg-gray-50">
                  {idx === 0 && (
                    <td
                      rowSpan={items.length}
                      className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium text-gray-900 bg-gray-50 border-r border-gray-100 align-top"
                    >
                      {category}
                    </td>
                  )}
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-700">
                    {item.subCategory ? (
                      <span className="text-gray-400 text-[10px] sm:text-xs mr-1">{item.subCategory} /</span>
                    ) : null}
                    {item.itemName}
                  </td>
                  <ScoreCell score={item.coachScore} />
                  <ScoreCell score={item.selfScore} />
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-center">
                    {getGapBadge(item.gap)}
                  </td>
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>

      <div className="mt-4 px-4 py-3 bg-gray-50 rounded-lg">
        <h4 className="text-xs font-medium text-gray-500 mb-2">ギャップの見方</h4>
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">+N</span>
            <span className="text-gray-600">指導者評価 &gt; 自己評価（伸び代あり）</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">-N</span>
            <span className="text-gray-600">指導者評価 &lt; 自己評価（認識のズレ）</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">0</span>
            <span className="text-gray-600">一致</span>
          </div>
        </div>
      </div>
    </div>
  );
}
