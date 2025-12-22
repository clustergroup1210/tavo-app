import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UserCircle, TrendingUp, Link2, Edit3, Save, X } from 'lucide-react';

export default function MyPage() {
  const { user } = useAuth();
  const [playerData, setPlayerData] = useState(null);
  const [evaluationSummary, setEvaluationSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ roleModel: '', playStyle: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchMyData();
  }, [user]);

  const fetchMyData = async () => {
    try {
      const playersRes = await fetch('/api/players', { credentials: 'include' });
      const players = await playersRes.json();
      const myPlayer = players.find(p => p.userId === user?.id);

      if (myPlayer) {
        setPlayerData(myPlayer);
        setEditForm({
          roleModel: myPlayer.roleModel || '',
          playStyle: myPlayer.playStyle || '',
        });
        const summaryRes = await fetch(`/api/evaluations/summary/${myPlayer.id}`, {
          credentials: 'include',
        });
        const summary = await summaryRes.json();
        setEvaluationSummary(summary);
      }
    } catch (error) {
      console.error('Failed to fetch player data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!playerData) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/players/${playerData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          roleModel: editForm.roleModel,
          playStyle: editForm.playStyle,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setPlayerData(updated);
        setEditing(false);
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditForm({
      roleModel: playerData?.roleModel || '',
      playStyle: playerData?.playStyle || '',
    });
    setEditing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">マイページ</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-xl bg-gray-100 flex items-center justify-center">
            {playerData?.passportUrl ? (
              <img
                src={playerData.passportUrl}
                alt=""
                className="w-20 h-20 rounded-xl object-cover"
              />
            ) : (
              <UserCircle className="w-12 h-12 text-gray-400" />
            )}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {playerData?.name || user?.name}
            </h2>
            {playerData && (
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                <span>背番号: {playerData.number || '-'}</span>
                <span>ポジション: {playerData.position || '-'}</span>
                <span>チーム: {playerData.team?.name}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {playerData && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">プロフィール</h3>
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-primary-600 hover:bg-primary-50 rounded-lg"
              >
                <Edit3 className="w-4 h-4" />
                編集
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCancel}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-4 h-4" />
                  キャンセル
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  保存
                </button>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                目標とする選手
              </label>
              {editing ? (
                <input
                  type="text"
                  value={editForm.roleModel}
                  onChange={(e) => setEditForm({ ...editForm, roleModel: e.target.value })}
                  placeholder="例: リオネル・メッシ"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              ) : (
                <p className="text-gray-900 py-2">
                  {playerData.roleModel || <span className="text-gray-400">未設定</span>}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                プレースタイル
              </label>
              {editing ? (
                <input
                  type="text"
                  value={editForm.playStyle}
                  onChange={(e) => setEditForm({ ...editForm, playStyle: e.target.value })}
                  placeholder="例: ドリブル突破、パス重視"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              ) : (
                <p className="text-gray-900 py-2">
                  {playerData.playStyle || <span className="text-gray-400">未設定</span>}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-primary-600" />
            <h3 className="text-lg font-semibold text-gray-900">評価サマリー</h3>
          </div>
          {evaluationSummary.length > 0 ? (
            <div className="space-y-3">
              {evaluationSummary.slice(0, 5).map((s) => (
                <div key={s.item.id} className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">{s.item.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold text-gray-900">{s.latestScore}</span>
                    {s.progress !== 0 && (
                      <span className={`text-xs ${s.progress > 0 ? 'text-green-600' : 'text-red-600'}`}>
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

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Link2 className="w-5 h-5 text-primary-600" />
            <h3 className="text-lg font-semibold text-gray-900">アピールURL</h3>
          </div>
          {playerData && (
            <button
              onClick={async () => {
                try {
                  const res = await fetch('/api/appeals', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ playerId: playerData.id, type: 'simple' }),
                  });
                  const data = await res.json();
                  const url = `${window.location.origin}${data.url}`;
                  navigator.clipboard.writeText(url);
                  alert(`URLをコピーしました: ${url}`);
                } catch (error) {
                  console.error('Failed to create appeal:', error);
                }
              }}
              className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              アピールURLを発行
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
