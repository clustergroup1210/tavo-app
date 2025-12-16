import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { UserCircle, Building2 } from 'lucide-react';

export default function AppealPublic() {
  const { token } = useParams();
  const [appeal, setAppeal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAppeal();
  }, [token]);

  const fetchAppeal = async () => {
    try {
      const res = await fetch(`/api/appeals/public/${token}`);
      if (!res.ok) {
        throw new Error('アピールページが見つかりません');
      }
      const data = await res.json();
      setAppeal(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="flex items-center gap-6 mb-8">
            <div className="w-20 h-20 rounded-xl bg-gray-100 flex items-center justify-center">
              <UserCircle className="w-12 h-12 text-gray-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{appeal.player.name}</h1>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                {appeal.player.number && <span>背番号: {appeal.player.number}</span>}
                {appeal.player.position && <span>ポジション: {appeal.player.position}</span>}
              </div>
            </div>
          </div>

          {appeal.player.team && (
            <div className="flex items-center gap-3 mb-8 p-4 bg-gray-50 rounded-lg">
              {appeal.player.team.logoUrl ? (
                <img
                  src={appeal.player.team.logoUrl}
                  alt=""
                  className="w-10 h-10 rounded-lg object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-gray-400" />
                </div>
              )}
              <span className="font-medium text-gray-900">{appeal.player.team.name}</span>
            </div>
          )}

          {appeal.type === 'recommended' && appeal.comment && (
            <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm font-medium text-blue-800 mb-2">推薦コメント</p>
              <p className="text-sm text-blue-700">{appeal.comment}</p>
            </div>
          )}

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">評価サマリー</h2>
            {appeal.evaluationSummary.length > 0 ? (
              <div className="space-y-3">
                {appeal.evaluationSummary.map((s) => (
                  <div
                    key={s.item.id}
                    className="flex items-center justify-between py-3 border-b border-gray-100"
                  >
                    <span className="text-sm text-gray-600">{s.item.name}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-primary-600 rounded-full h-2"
                          style={{ width: `${(s.latestScore / 5) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-900 w-8 text-right">
                        {s.latestScore}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">評価データがありません</p>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-8">
          このページは選手のアピール用に生成されたものです
        </p>
      </div>
    </div>
  );
}
