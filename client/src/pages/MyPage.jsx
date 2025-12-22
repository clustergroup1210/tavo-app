import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UserCircle, TrendingUp, Link2, Edit3, Save, X, Target, Plus, Trash2, Camera, IdCard } from 'lucide-react';

export default function MyPage() {
  const { user } = useAuth();
  const [playerData, setPlayerData] = useState(null);
  const [evaluationSummary, setEvaluationSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ roleModel: '', playStyle: '' });
  const [saving, setSaving] = useState(false);
  const [goals, setGoals] = useState([]);
  const [goalCategories, setGoalCategories] = useState([]);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [newGoal, setNewGoal] = useState({ categoryId: '', content: '' });
  const [editingGoalId, setEditingGoalId] = useState(null);
  const [editingGoalContent, setEditingGoalContent] = useState('');

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
        
        const categoryTeamId = myPlayer.team?.parentId || myPlayer.teamId;
        const [summaryRes, goalsRes, categoriesRes] = await Promise.all([
          fetch(`/api/evaluations/summary/${myPlayer.id}`, { credentials: 'include' }),
          fetch(`/api/goals/player/${myPlayer.id}`, { credentials: 'include' }),
          fetch(`/api/goals/categories?teamId=${categoryTeamId}`, { credentials: 'include' })
        ]);
        
        const summary = await summaryRes.json();
        setEvaluationSummary(summary);
        
        const goalsData = await goalsRes.json();
        setGoals(Array.isArray(goalsData) ? goalsData : []);
        
        const categoriesData = await categoriesRes.json();
        setGoalCategories(Array.isArray(categoriesData) ? categoriesData : []);
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

  const handleAddGoal = async () => {
    if (!newGoal.categoryId || !newGoal.content.trim()) return;
    try {
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          playerId: playerData.id,
          categoryId: newGoal.categoryId,
          content: newGoal.content,
        }),
      });
      if (res.ok) {
        const goal = await res.json();
        setGoals([...goals, goal]);
        setNewGoal({ categoryId: '', content: '' });
        setShowGoalModal(false);
      }
    } catch (error) {
      console.error('Failed to add goal:', error);
    }
  };

  const handleUpdateGoal = async (goalId) => {
    if (!editingGoalContent.trim()) return;
    try {
      const res = await fetch(`/api/goals/${goalId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: editingGoalContent }),
      });
      if (res.ok) {
        const updated = await res.json();
        setGoals(goals.map(g => g.id === goalId ? updated : g));
        setEditingGoalId(null);
        setEditingGoalContent('');
      }
    } catch (error) {
      console.error('Failed to update goal:', error);
    }
  };

  const handleDeleteGoal = async (goalId) => {
    if (!confirm('この目標を削除しますか？')) return;
    try {
      await fetch(`/api/goals/${goalId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      setGoals(goals.filter(g => g.id !== goalId));
    } catch (error) {
      console.error('Failed to delete goal:', error);
    }
  };

  const goalsByCategory = goalCategories.map(cat => ({
    ...cat,
    goals: goals.filter(g => g.categoryId === cat.id)
  }));

  const passportInputRef = useRef(null);

  const handlePassportUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !playerData) return;

    const formData = new FormData();
    formData.append('passport', file);

    try {
      const res = await fetch(`/api/players/${playerData.id}/passport`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (res.ok) {
        const updated = await res.json();
        setPlayerData({ ...playerData, passportUrl: updated.passportUrl });
      }
    } catch (error) {
      console.error('Failed to upload passport:', error);
    }
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
        <div className="flex items-start gap-6">
          <div className="relative group">
            <div className="w-24 h-24 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden">
              {playerData?.passportUrl ? (
                <img
                  src={playerData.passportUrl}
                  alt=""
                  className="w-24 h-24 rounded-xl object-cover"
                />
              ) : (
                <UserCircle className="w-14 h-14 text-gray-400" />
              )}
            </div>
            {playerData && (
              <button
                onClick={() => passportInputRef.current?.click()}
                className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Camera className="w-6 h-6 text-white" />
              </button>
            )}
            <input
              ref={passportInputRef}
              type="file"
              accept="image/*"
              onChange={handlePassportUpload}
              className="hidden"
            />
          </div>
          <div className="flex-1">
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
          {playerData && (
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center bg-gray-50">
                {playerData.passportUrl ? (
                  <img src={playerData.passportUrl} alt="JFA" className="w-14 h-18 object-cover rounded" />
                ) : (
                  <>
                    <IdCard className="w-6 h-6 text-gray-400" />
                    <span className="text-[10px] text-gray-400 mt-1">選手証</span>
                  </>
                )}
              </div>
              <span className="text-xs text-gray-500">JFA Passport</span>
            </div>
          )}
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

      {playerData && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-primary-600" />
              <h3 className="text-lg font-semibold text-gray-900">目標</h3>
            </div>
            {goalCategories.length > 0 && (
              <button
                onClick={() => setShowGoalModal(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                <Plus className="w-4 h-4" />
                目標を追加
              </button>
            )}
          </div>

          {goalCategories.length === 0 ? (
            <p className="text-sm text-gray-500">目標カテゴリーが設定されていません</p>
          ) : goalsByCategory.every(cat => cat.goals.length === 0) ? (
            <p className="text-sm text-gray-500">まだ目標が設定されていません</p>
          ) : (
            <div className="space-y-4">
              {goalsByCategory.filter(cat => cat.goals.length > 0).map((cat) => (
                <div key={cat.id} className="border border-gray-100 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">{cat.name}</h4>
                  <div className="space-y-2">
                    {cat.goals.map((goal) => (
                      <div key={goal.id} className="flex items-start justify-between gap-2 bg-gray-50 p-3 rounded-lg">
                        {editingGoalId === goal.id ? (
                          <div className="flex-1 flex items-center gap-2">
                            <input
                              type="text"
                              value={editingGoalContent}
                              onChange={(e) => setEditingGoalContent(e.target.value)}
                              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                            />
                            <button
                              onClick={() => handleUpdateGoal(goal.id)}
                              className="text-primary-600 hover:text-primary-700"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => { setEditingGoalId(null); setEditingGoalContent(''); }}
                              className="text-gray-500 hover:text-gray-700"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm text-gray-900 flex-1">{goal.content}</p>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => { setEditingGoalId(goal.id); setEditingGoalContent(goal.content); }}
                                className="text-gray-400 hover:text-primary-600"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteGoal(goal.id)}
                                className="text-gray-400 hover:text-red-600"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
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

      {showGoalModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">目標を追加</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">カテゴリー</label>
                <select
                  value={newGoal.categoryId}
                  onChange={(e) => setNewGoal({ ...newGoal, categoryId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">選択してください</option>
                  {goalCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">目標内容</label>
                <textarea
                  value={newGoal.content}
                  onChange={(e) => setNewGoal({ ...newGoal, content: e.target.value })}
                  placeholder="具体的な目標を入力してください"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => { setShowGoalModal(false); setNewGoal({ categoryId: '', content: '' }); }}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleAddGoal}
                  disabled={!newGoal.categoryId || !newGoal.content.trim()}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  追加
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
