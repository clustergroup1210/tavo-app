import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  UserCircle, TrendingUp, Link2, Edit2, Save, X, Target, Plus, Trash2, Camera,
  Calendar, Ruler, Weight, MapPin, GraduationCap, Users, Footprints, Star, Zap, Upload
} from 'lucide-react';

export default function MyPage() {
  const { user } = useAuth();
  const [playerData, setPlayerData] = useState(null);
  const [evaluationSummary, setEvaluationSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [goals, setGoals] = useState([]);
  const [goalCategories, setGoalCategories] = useState([]);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [newGoal, setNewGoal] = useState({ categoryId: '', content: '' });
  const [editingGoalId, setEditingGoalId] = useState(null);
  const [editingGoalContent, setEditingGoalContent] = useState('');
  const passportInputRef = useRef(null);

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
          birthDate: myPlayer.birthDate ? myPlayer.birthDate.split('T')[0] : '',
          height: myPlayer.height || '',
          weight: myPlayer.weight || '',
          dominantFoot: myPlayer.dominantFoot || '',
          hometown: myPlayer.hometown || '',
          school: myPlayer.school || '',
          previousTeam: myPlayer.previousTeam || '',
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
          birthDate: editForm.birthDate || null,
          height: editForm.height ? parseInt(editForm.height) : null,
          weight: editForm.weight ? parseInt(editForm.weight) : null,
          dominantFoot: editForm.dominantFoot,
          hometown: editForm.hometown,
          school: editForm.school,
          previousTeam: editForm.previousTeam,
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
      birthDate: playerData?.birthDate ? playerData.birthDate.split('T')[0] : '',
      height: playerData?.height || '',
      weight: playerData?.weight || '',
      dominantFoot: playerData?.dominantFoot || '',
      hometown: playerData?.hometown || '',
      school: playerData?.school || '',
      previousTeam: playerData?.previousTeam || '',
    });
    setEditing(false);
  };

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

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!playerData) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <UserCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-gray-900 mb-2">選手情報が見つかりません</h2>
          <p className="text-sm text-gray-500">選手アカウントに紐付けられていません。管理者にお問い合わせください。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-primary-500 to-primary-600 p-6">
          <div className="flex items-start gap-6">
            <div className="flex gap-4">
              <div className="relative group">
                <div className="w-32 h-32 md:w-40 md:h-40 rounded-2xl bg-white/20 flex items-center justify-center border-4 border-white/30 shadow-xl overflow-hidden">
                  {playerData.photoUrl ? (
                    <img
                      src={playerData.photoUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <UserCircle className="w-20 h-20 text-white/60" />
                  )}
                </div>
              </div>
              
              <div className="relative group">
                <div className="flex flex-col items-center">
                  <div className="w-16 h-20 md:w-20 md:h-24 rounded-lg bg-white/20 flex items-center justify-center border-2 border-white/30 shadow-lg overflow-hidden">
                    {playerData.passportUrl ? (
                      <img
                        src={playerData.passportUrl}
                        alt="選手証"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Camera className="w-6 h-6 text-white/60" />
                    )}
                  </div>
                  <span className="mt-1 text-xs text-white/80">選手証</span>
                  <label className="absolute -bottom-1 -right-1 p-1.5 bg-white rounded-full shadow-lg cursor-pointer hover:bg-gray-100 transition-colors">
                    <Upload className="w-3.5 h-3.5 text-primary-600" />
                    <input
                      ref={passportInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePassportUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="flex-1 text-white">
              <div className="flex items-center gap-4 mb-2">
                <span className="text-4xl font-bold">No.{playerData.number || '-'}</span>
                <h1 className="text-3xl font-bold">{playerData.name}</h1>
              </div>
              {playerData.nameRomaji && (
                <p className="text-primary-100 mb-3">{playerData.nameRomaji}</p>
              )}
              <div className="flex items-center gap-3">
                {playerData.position && (
                  <span className="px-3 py-1 bg-primary-400/30 rounded-full text-sm font-medium">
                    {playerData.position}
                  </span>
                )}
                <span className="px-3 py-1 bg-white/20 rounded-full text-sm">
                  {playerData.team?.parent?.name ? `${playerData.team.parent.name} / ${playerData.team.name}` : playerData.team?.name}
                </span>
              </div>
            </div>

            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors"
            >
              <Edit2 className="w-4 h-4" />
              編集
            </button>
          </div>
        </div>

        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">基本情報</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Calendar className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">生年月日</p>
                <p className="text-sm font-medium text-gray-900">{formatDate(playerData.birthDate)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Ruler className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">身長</p>
                <p className="text-sm font-medium text-gray-900">{playerData.height ? `${playerData.height}cm` : '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Weight className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">体重</p>
                <p className="text-sm font-medium text-gray-900">{playerData.weight ? `${playerData.weight}kg` : '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Footprints className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">利き足</p>
                <p className="text-sm font-medium text-gray-900">{playerData.dominantFoot || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <MapPin className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">出身地</p>
                <p className="text-sm font-medium text-gray-900">{playerData.hometown || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <GraduationCap className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">出身校</p>
                <p className="text-sm font-medium text-gray-900">{playerData.school || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Users className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">前所属チーム</p>
                <p className="text-sm font-medium text-gray-900">{playerData.previousTeam || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Star className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">目標とする選手</p>
                <p className="text-sm font-medium text-gray-900">{playerData.roleModel || '-'}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <Zap className="w-5 h-5 text-gray-400" />
            <div className="flex-1">
              <p className="text-xs text-gray-500">プレースタイル</p>
              <p className="text-sm font-medium text-gray-900">{playerData.playStyle || '-'}</p>
            </div>
          </div>
        </div>
      </div>

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
                              <Edit2 className="w-4 h-4" />
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-primary-600" />
            <h3 className="text-lg font-semibold text-gray-900">評価サマリー</h3>
          </div>
          {evaluationSummary.length > 0 ? (
            <div className="space-y-3">
              {evaluationSummary.slice(0, 5).map((s) => (
                <div key={s.item.id} className="py-2 border-b border-gray-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600">{s.item.name}</span>
                    {s.progress !== 0 && (
                      <span className={`text-xs ${s.progress > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {s.progress > 0 ? '+' : ''}{s.progress}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500">指導者:</span>
                      <span className="text-lg font-semibold text-primary-600">
                        {s.latestCoachScore ?? '-'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500">自己:</span>
                      <span className="text-lg font-semibold text-gray-600">
                        {s.latestSelfScore ?? '-'}
                      </span>
                    </div>
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
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">プロフィール編集</h3>
              <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">生年月日</label>
                <input
                  type="date"
                  value={editForm.birthDate}
                  onChange={(e) => setEditForm({ ...editForm, birthDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">身長 (cm)</label>
                <input
                  type="number"
                  value={editForm.height}
                  onChange={(e) => setEditForm({ ...editForm, height: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">体重 (kg)</label>
                <input
                  type="number"
                  value={editForm.weight}
                  onChange={(e) => setEditForm({ ...editForm, weight: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">利き足</label>
                <select
                  value={editForm.dominantFoot}
                  onChange={(e) => setEditForm({ ...editForm, dominantFoot: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">選択してください</option>
                  <option value="右">右</option>
                  <option value="左">左</option>
                  <option value="両方">両方</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">出身地</label>
                <input
                  type="text"
                  value={editForm.hometown}
                  onChange={(e) => setEditForm({ ...editForm, hometown: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">出身校</label>
                <input
                  type="text"
                  value={editForm.school}
                  onChange={(e) => setEditForm({ ...editForm, school: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">前所属チーム</label>
                <input
                  type="text"
                  value={editForm.previousTeam}
                  onChange={(e) => setEditForm({ ...editForm, previousTeam: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">目標とする選手</label>
                <input
                  type="text"
                  value={editForm.roleModel}
                  onChange={(e) => setEditForm({ ...editForm, roleModel: e.target.value })}
                  placeholder="例: リオネル・メッシ"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">プレースタイル</label>
                <input
                  type="text"
                  value={editForm.playStyle}
                  onChange={(e) => setEditForm({ ...editForm, playStyle: e.target.value })}
                  placeholder="例: ドリブル突破、パス重視"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

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
