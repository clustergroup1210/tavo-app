import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { UserCircle, Upload, Link2, TrendingUp, Video, ClipboardList } from 'lucide-react';

export default function PlayerDetail() {
  const { id } = useParams();
  const { user, isCoach } = useAuth();
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [evaluationSummary, setEvaluationSummary] = useState([]);

  useEffect(() => {
    fetchPlayer();
    fetchEvaluationSummary();
  }, [id]);

  const fetchPlayer = async () => {
    try {
      const res = await fetch(`/api/players/${id}`, { credentials: 'include' });
      const data = await res.json();
      setPlayer(data);
    } catch (error) {
      console.error('Failed to fetch player:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEvaluationSummary = async () => {
    try {
      const res = await fetch(`/api/evaluations/summary/${id}`, { credentials: 'include' });
      const data = await res.json();
      setEvaluationSummary(data);
    } catch (error) {
      console.error('Failed to fetch evaluation summary:', error);
    }
  };

  const handlePassportUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('passport', file);

    try {
      await fetch(`/api/players/${id}/passport`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      fetchPlayer();
    } catch (error) {
      console.error('Failed to upload passport:', error);
    }
  };

  const handleCreateAppeal = async (type) => {
    try {
      const res = await fetch('/api/appeals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ playerId: id, type }),
      });
      const data = await res.json();
      alert(`アピールURL: ${window.location.origin}${data.url}`);
      fetchPlayer();
    } catch (error) {
      console.error('Failed to create appeal:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!player) {
    return <div className="text-center text-gray-500">選手が見つかりません</div>;
  }

  const isSelf = player.userId === user?.id;
  const canEdit = isSelf || isCoach(player.teamId);

  const tabs = [
    { id: 'dashboard', label: 'ダッシュボード', icon: UserCircle },
    { id: 'evaluation', label: '評価', icon: ClipboardList },
    { id: 'progress', label: '上達状況', icon: TrendingUp },
    { id: 'videos', label: '動画', icon: Video },
    { id: 'appeal', label: 'アピール', icon: Link2 },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-start gap-6">
          <div className="relative">
            {player.passportUrl ? (
              <img
                src={player.passportUrl}
                alt=""
                className="w-24 h-24 rounded-xl object-cover"
              />
            ) : (
              <div className="w-24 h-24 rounded-xl bg-gray-100 flex items-center justify-center">
                <UserCircle className="w-12 h-12 text-gray-400" />
              </div>
            )}
            {canEdit && (
              <label className="absolute -bottom-2 -right-2 p-2 bg-white rounded-full shadow-md cursor-pointer hover:bg-gray-50">
                <Upload className="w-4 h-4 text-gray-600" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePassportUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{player.name}</h1>
            <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
              <span>背番号: {player.number || '-'}</span>
              <span>ポジション: {player.position || '-'}</span>
              <span>チーム: {player.team?.name}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-3 border-b-2 text-sm font-medium ${
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {activeTab === 'dashboard' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">基本情報</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">名前:</span>
              <span className="ml-2 text-gray-900">{player.name}</span>
            </div>
            <div>
              <span className="text-gray-500">背番号:</span>
              <span className="ml-2 text-gray-900">{player.number || '-'}</span>
            </div>
            <div>
              <span className="text-gray-500">ポジション:</span>
              <span className="ml-2 text-gray-900">{player.position || '-'}</span>
            </div>
            <div>
              <span className="text-gray-500">チーム:</span>
              <span className="ml-2 text-gray-900">{player.team?.name}</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'evaluation' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">評価サマリー</h2>
          {evaluationSummary.length > 0 ? (
            <div className="space-y-4">
              {evaluationSummary.map((s) => (
                <div key={s.item.id} className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">{s.item.name}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-lg font-semibold text-gray-900">{s.latestScore}</span>
                    {s.progress !== 0 && (
                      <span className={`text-sm ${s.progress > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {s.progress > 0 ? '+' : ''}{s.progress}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">まだ評価がありません</p>
          )}
        </div>
      )}

      {activeTab === 'progress' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">上達状況</h2>
          <p className="text-sm text-gray-500">評価データが蓄積されるとグラフが表示されます</p>
        </div>
      )}

      {activeTab === 'videos' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">動画一覧</h2>
          {player.videos?.length > 0 ? (
            <div className="grid grid-cols-2 gap-4">
              {player.videos.map((video) => (
                <div key={video.id} className="border border-gray-200 rounded-lg p-4">
                  <p className="font-medium text-gray-900">{video.title}</p>
                  <p className="text-sm text-gray-500">{video.description}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">動画がありません</p>
          )}
        </div>
      )}

      {activeTab === 'appeal' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">アピールURL</h2>
          
          {isSelf && (
            <button
              onClick={() => handleCreateAppeal('simple')}
              className="mb-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              シンプル版URLを発行
            </button>
          )}

          {player.appealLinks?.length > 0 ? (
            <div className="space-y-3">
              {player.appealLinks.map((link) => (
                <div key={link.id} className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {link.type === 'simple' ? 'シンプル版' : '推薦付き'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(link.createdAt).toLocaleDateString('ja-JP')}
                    </p>
                  </div>
                  <a
                    href={`/appeal/${link.token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary-600 hover:underline"
                  >
                    URLを開く
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">アピールURLがありません</p>
          )}
        </div>
      )}
    </div>
  );
}
