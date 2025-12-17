import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { UserCircle, Upload, Link2, TrendingUp, Video, ClipboardList, Edit2, Save, X } from 'lucide-react';

export default function PlayerDetail() {
  const { id } = useParams();
  const { user, isCoach } = useAuth();
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [evaluationSummary, setEvaluationSummary] = useState([]);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', number: '', position: '', teamId: '' });
  const [saving, setSaving] = useState(false);
  const [teams, setTeams] = useState([]);

  useEffect(() => {
    fetchPlayer();
    fetchEvaluationSummary();
    fetchTeams();
  }, [id]);

  const fetchTeams = async () => {
    try {
      const res = await fetch('/api/teams', { credentials: 'include' });
      const data = await res.json();
      setTeams(data);
    } catch (error) {
      console.error('Failed to fetch teams:', error);
    }
  };

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

  const startEditing = () => {
    setEditForm({
      name: player.name || '',
      number: player.number || '',
      position: player.position || '',
      teamId: player.teamId || ''
    });
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setEditForm({ name: '', number: '', position: '', teamId: '' });
  };

  const getParentTeams = () => {
    return teams.filter(t => !t.parentId);
  };

  const getChildTeams = (parentId) => {
    return teams.filter(t => t.parentId === parentId);
  };

  const getCurrentParentId = () => {
    const currentTeam = teams.find(t => t.id === editForm.teamId);
    if (!currentTeam) return '';
    return currentTeam.parentId || currentTeam.id;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        name: editForm.name,
        number: editForm.number,
        position: editForm.position
      };
      if (isCoachOrAdmin && editForm.teamId && editForm.teamId !== player.teamId) {
        payload.teamId = editForm.teamId;
      }
      const res = await fetch(`/api/players/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        await fetchPlayer();
        setEditing(false);
      } else {
        const data = await res.json();
        alert(data.error || '更新に失敗しました');
      }
    } catch (error) {
      console.error('Failed to update player:', error);
      alert('更新に失敗しました');
    } finally {
      setSaving(false);
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
  const isCoachOrAdmin = isCoach(player.teamId);
  const canEdit = isSelf || isCoachOrAdmin;

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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">基本情報</h2>
            {canEdit && !editing && (
              <button
                onClick={startEditing}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-primary-600 hover:bg-primary-50 rounded-lg"
              >
                <Edit2 className="w-4 h-4" />
                編集
              </button>
            )}
          </div>
          
          {editing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">名前</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">背番号</label>
                <input
                  type="text"
                  value={editForm.number}
                  onChange={(e) => setEditForm({ ...editForm, number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ポジション</label>
                <select
                  value={editForm.position}
                  onChange={(e) => setEditForm({ ...editForm, position: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">選択してください</option>
                  <option value="GK">GK</option>
                  <option value="DF">DF</option>
                  <option value="MF">MF</option>
                  <option value="FW">FW</option>
                </select>
              </div>
              {isCoachOrAdmin && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">チーム</label>
                    <select
                      value={getCurrentParentId()}
                      onChange={(e) => {
                        const parentId = e.target.value;
                        const children = getChildTeams(parentId);
                        setEditForm({ ...editForm, teamId: children.length > 0 ? '' : parentId });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">選択してください</option>
                      {getParentTeams().map((team) => (
                        <option key={team.id} value={team.id}>{team.name}</option>
                      ))}
                    </select>
                  </div>
                  {getCurrentParentId() && getChildTeams(getCurrentParentId()).length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">カテゴリー</label>
                      <select
                        value={editForm.teamId}
                        onChange={(e) => setEditForm({ ...editForm, teamId: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="">選択してください</option>
                        {getChildTeams(getCurrentParentId()).map((team) => (
                          <option key={team.id} value={team.id}>{team.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? '保存中...' : '保存'}
                </button>
                <button
                  onClick={cancelEditing}
                  className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-4 h-4" />
                  キャンセル
                </button>
              </div>
            </div>
          ) : (
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
                <span className="ml-2 text-gray-900">
                  {player.team?.parent ? player.team.parent.name : player.team?.name}
                </span>
              </div>
              {player.team?.parent && (
                <div>
                  <span className="text-gray-500">カテゴリー:</span>
                  <span className="ml-2 text-gray-900">{player.team.name}</span>
                </div>
              )}
            </div>
          )}
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
