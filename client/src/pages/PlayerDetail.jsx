import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  UserCircle, Upload, Link2, TrendingUp, Video, ClipboardList, Edit2, Save, X,
  Calendar, Ruler, Weight, MapPin, GraduationCap, Users, Footprints, MessageSquare, Send, Trash2,
  Star, Zap
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, ReferenceLine, Cell
} from 'recharts';

export default function PlayerDetail() {
  const { id } = useParams();
  const { user, isCoach, isOperator } = useAuth();
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('evaluation');
  const [evaluationSummary, setEvaluationSummary] = useState([]);
  const [evaluationComparison, setEvaluationComparison] = useState({ comparison: [], hasData: false });
  const [progressData, setProgressData] = useState({ progressData: [], categories: [] });
  const [heatmapData, setHeatmapData] = useState({ heatmapData: [], categoryGroups: {} });
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [teams, setTeams] = useState([]);
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);
  const [linkEmail, setLinkEmail] = useState('');
  const [linkingUser, setLinkingUser] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [teamCategories, setTeamCategories] = useState([]);

  useEffect(() => {
    fetchPlayer();
    fetchEvaluationSummary();
    fetchTeams();
    fetchNotes();
    fetchEvaluationComparison();
    fetchProgressData();
    fetchHeatmapData();
  }, [id]);

  const fetchNotes = async () => {
    try {
      const res = await fetch(`/api/players/${id}/notes`, { credentials: 'include' });
      const data = await res.json();
      setNotes(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch notes:', error);
    }
  };

  const fetchEvaluationComparison = async () => {
    try {
      const res = await fetch(`/api/evaluations/comparison/${id}`, { credentials: 'include' });
      const data = await res.json();
      setEvaluationComparison(data);
    } catch (error) {
      console.error('Failed to fetch evaluation comparison:', error);
    }
  };

  const fetchProgressData = async () => {
    try {
      const res = await fetch(`/api/evaluations/progress/${id}`, { credentials: 'include' });
      const data = await res.json();
      setProgressData(data);
    } catch (error) {
      console.error('Failed to fetch progress data:', error);
    }
  };

  const fetchHeatmapData = async () => {
    try {
      const res = await fetch(`/api/evaluations/heatmap/${id}`, { credentials: 'include' });
      const data = await res.json();
      setHeatmapData(data);
    } catch (error) {
      console.error('Failed to fetch heatmap data:', error);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setSubmittingNote(true);
    try {
      const res = await fetch(`/api/players/${id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: newNote }),
      });
      if (res.ok) {
        setNewNote('');
        fetchNotes();
      }
    } catch (error) {
      console.error('Failed to add note:', error);
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!confirm('このノートを削除しますか？')) return;
    try {
      await fetch(`/api/players/${id}/notes/${noteId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      fetchNotes();
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
  };

  const handleLinkUser = async () => {
    if (!linkEmail.trim()) return;
    setLinkingUser(true);
    setLinkError('');
    try {
      const res = await fetch(`/api/players/${id}/link-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: linkEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        setPlayer(prev => ({ ...prev, userId: data.userId, user: data.user }));
        setLinkEmail('');
      } else {
        setLinkError(data.error || 'ユーザーの紐付けに失敗しました');
      }
    } catch (error) {
      setLinkError('ユーザーの紐付けに失敗しました');
    } finally {
      setLinkingUser(false);
    }
  };

  const handleUnlinkUser = async () => {
    if (!confirm('このユーザーとの紐付けを解除しますか？')) return;
    setLinkingUser(true);
    try {
      const res = await fetch(`/api/players/${id}/unlink-user`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setPlayer(prev => ({ ...prev, userId: null, user: null }));
      }
    } catch (error) {
      console.error('Failed to unlink user:', error);
    } finally {
      setLinkingUser(false);
    }
  };

  const fetchTeams = async () => {
    try {
      const res = await fetch('/api/teams', { credentials: 'include' });
      const data = await res.json();
      const flatTeams = [];
      data.forEach(team => {
        flatTeams.push({ ...team, children: undefined });
        if (team.children) {
          team.children.forEach(child => {
            flatTeams.push({ ...child, parentId: team.id });
          });
        }
      });
      setTeams(flatTeams);
    } catch (error) {
      console.error('Failed to fetch teams:', error);
    }
  };

  const fetchTeamCategories = async () => {
    if (!player?.teamId) return;
    try {
      const res = await fetch(`/api/team-categories?teamId=${player.teamId}`, { credentials: 'include' });
      const data = await res.json();
      setTeamCategories(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch team categories:', error);
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
      nameRomaji: player.nameRomaji || '',
      number: player.number || '',
      position: player.position || '',
      birthDate: player.birthDate ? player.birthDate.split('T')[0] : '',
      height: player.height || '',
      weight: player.weight || '',
      dominantFoot: player.dominantFoot || '',
      hometown: player.hometown || '',
      school: player.school || '',
      previousTeam: player.previousTeam || '',
      teamId: player.teamId || '',
      teamCategoryId: player.teamCategoryId || ''
    });
    setEditing(true);
    fetchTeamCategories();
  };

  const cancelEditing = () => {
    setEditing(false);
    setEditForm({});
  };

  const getParentTeams = () => teams.filter(t => !t.parentId);
  const getChildTeams = (parentId) => teams.filter(t => t.parentId === parentId);
  const getCurrentParentId = () => {
    const currentTeam = teams.find(t => t.id === editForm.teamId);
    if (!currentTeam) return '';
    return currentTeam.parentId || currentTeam.id;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...editForm };
      if (!isCoachOrAdmin || editForm.teamId === player.teamId) {
        delete payload.teamId;
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

  const calculateAge = (birthDate) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  };

  const getScoreColor = (score) => {
    if (!score) return 'bg-gray-100';
    const colors = [
      'bg-blue-100',
      'bg-blue-200',
      'bg-blue-300',
      'bg-blue-400',
      'bg-blue-500'
    ];
    return colors[Math.min(score - 1, 4)];
  };

  const getScoreTextColor = (score) => {
    if (!score) return 'text-gray-400';
    if (score >= 4) return 'text-white';
    return 'text-gray-800';
  };

  const getGapBadge = (gap) => {
    if (gap === null || gap === undefined) return null;
    if (gap > 0) {
      return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">+{gap}</span>;
    } else if (gap < 0) {
      return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">{gap}</span>;
    }
    return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">0</span>;
  };

  const getHeatmapColor = (percentage) => {
    if (percentage === 0) return 'bg-gray-200';
    if (percentage <= 20) return 'bg-blue-100';
    if (percentage <= 40) return 'bg-blue-200';
    if (percentage <= 60) return 'bg-blue-300';
    if (percentage <= 80) return 'bg-blue-400';
    return 'bg-blue-500';
  };

  const categoryColors = [
    '#3B82F6',
    '#10B981',
    '#F59E0B',
    '#EF4444',
    '#8B5CF6',
    '#EC4899'
  ];

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
  const isCoachOrAdmin = isCoach(player.teamId) || isOperator();
  const canEdit = isSelf || isCoachOrAdmin;

  const positionColors = {
    GK: 'bg-yellow-500',
    DF: 'bg-blue-500',
    MF: 'bg-green-500',
    FW: 'bg-red-500'
  };

  const tabs = [
    { id: 'evaluation', label: '評価データ', icon: ClipboardList },
    { id: 'videos', label: '動画', icon: Video },
    { id: 'notes', label: 'コメント/ノート', icon: MessageSquare },
    { id: 'progress', label: '上達状況', icon: TrendingUp },
    { id: 'appeal', label: 'アピール', icon: Link2 },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 rounded-2xl shadow-lg p-6 text-white">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="relative flex-shrink-0">
            {player.passportUrl ? (
              <img
                src={player.passportUrl}
                alt=""
                className="w-32 h-32 md:w-40 md:h-40 rounded-2xl object-cover border-4 border-white/30 shadow-xl"
              />
            ) : (
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-2xl bg-white/20 flex items-center justify-center border-4 border-white/30">
                <UserCircle className="w-20 h-20 text-white/60" />
              </div>
            )}
            {canEdit && (
              <label className="absolute -bottom-2 -right-2 p-2.5 bg-white rounded-full shadow-lg cursor-pointer hover:bg-gray-100 transition-colors">
                <Upload className="w-5 h-5 text-primary-600" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePassportUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <div className="flex-1 text-center md:text-left">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-4">
              <div className="flex-shrink-0 bg-white/20 rounded-xl px-6 py-3 backdrop-blur-sm">
                <span className="text-4xl md:text-5xl font-bold">
                  {player.number ? `No.${player.number}` : '-'}
                </span>
              </div>
              
              <div className="flex-1">
                <h1 className="text-3xl md:text-4xl font-bold tracking-wide">
                  {player.name}
                </h1>
                {player.nameRomaji && (
                  <p className="text-lg text-white/80 mt-1">{player.nameRomaji}</p>
                )}
                <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-3">
                  {player.position && (
                    <span className={`px-4 py-1.5 rounded-full text-sm font-semibold ${positionColors[player.position] || 'bg-gray-500'}`}>
                      {player.position}
                    </span>
                  )}
                  <span className="px-4 py-1.5 rounded-full text-sm font-medium bg-white/20 backdrop-blur-sm">
                    {player.team?.parent ? `${player.team.parent.name} / ${player.team.name}` : player.team?.name}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {canEdit && !editing && (
            <button
              onClick={startEditing}
              className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors backdrop-blur-sm"
            >
              <Edit2 className="w-4 h-4" />
              編集
            </button>
          )}
        </div>
      </div>

      {editing && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">選手情報を編集</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">名前</label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ローマ字名</label>
              <input
                type="text"
                value={editForm.nameRomaji}
                onChange={(e) => setEditForm({ ...editForm, nameRomaji: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="例: Taro Yamada"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">背番号</label>
              <input
                type="text"
                value={editForm.number}
                onChange={(e) => setEditForm({ ...editForm, number: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ポジション</label>
              <select
                value={editForm.position}
                onChange={(e) => setEditForm({ ...editForm, position: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">選択してください</option>
                <option value="GK">GK</option>
                <option value="DF">DF</option>
                <option value="MF">MF</option>
                <option value="FW">FW</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">生年月日</label>
              <input
                type="date"
                value={editForm.birthDate}
                onChange={(e) => setEditForm({ ...editForm, birthDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">身長 (cm)</label>
              <input
                type="number"
                value={editForm.height}
                onChange={(e) => setEditForm({ ...editForm, height: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="170"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">体重 (kg)</label>
              <input
                type="number"
                value={editForm.weight}
                onChange={(e) => setEditForm({ ...editForm, weight: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="65"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">利き足</label>
              <select
                value={editForm.dominantFoot}
                onChange={(e) => setEditForm({ ...editForm, dominantFoot: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">選択してください</option>
                <option value="右">右</option>
                <option value="左">左</option>
                <option value="両足">両足</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">出身地</label>
              <input
                type="text"
                value={editForm.hometown}
                onChange={(e) => setEditForm({ ...editForm, hometown: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="東京都"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">出身校</label>
              <input
                type="text"
                value={editForm.school}
                onChange={(e) => setEditForm({ ...editForm, school: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="○○高校"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">前所属チーム</label>
              <input
                type="text"
                value={editForm.previousTeam}
                onChange={(e) => setEditForm({ ...editForm, previousTeam: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">選択してください</option>
                    {getParentTeams().map((team) => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                  </select>
                </div>
                {getCurrentParentId() && getChildTeams(getCurrentParentId()).length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">サブチーム</label>
                    <select
                      value={editForm.teamId}
                      onChange={(e) => setEditForm({ ...editForm, teamId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="">選択してください</option>
                      {getChildTeams(getCurrentParentId()).map((team) => (
                        <option key={team.id} value={team.id}>{team.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                {teamCategories.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      お知らせカテゴリー
                      <span className="text-xs text-gray-500 ml-2">（お知らせの配信先に使用）</span>
                    </label>
                    <select
                      value={editForm.teamCategoryId}
                      onChange={(e) => setEditForm({ ...editForm, teamCategoryId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="">未設定</option>
                      {teamCategories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="flex gap-3 mt-6">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? '保存中...' : '保存'}
            </button>
            <button
              onClick={cancelEditing}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
              キャンセル
            </button>
          </div>
        </div>
      )}

      {(isCoach || isOperator) && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Link2 className="w-5 h-5 text-primary-500" />
            アカウント紐付け
          </h2>
          {player?.user ? (
            <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
              <div>
                <p className="text-sm text-green-700 font-medium">紐付け済み</p>
                <p className="text-sm text-green-600">{player.user.email}</p>
              </div>
              <button
                onClick={handleUnlinkUser}
                disabled={linkingUser}
                className="px-4 py-2 text-sm text-red-600 bg-white border border-red-300 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                解除
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                この選手にログインアカウントを紐付けると、選手本人がマイページで評価データを確認できるようになります。
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={linkEmail}
                  onChange={(e) => setLinkEmail(e.target.value)}
                  placeholder="ユーザーのメールアドレス"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <button
                  onClick={handleLinkUser}
                  disabled={linkingUser || !linkEmail.trim()}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {linkingUser ? '処理中...' : '紐付ける'}
                </button>
              </div>
              {linkError && (
                <p className="text-sm text-red-600">{linkError}</p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">基本情報</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
            <Calendar className="w-5 h-5 text-primary-500 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500">生年月日</p>
              <p className="font-medium text-gray-900">
                {formatDate(player.birthDate)}
                {player.birthDate && (
                  <span className="ml-1 text-sm text-gray-500">({calculateAge(player.birthDate)}歳)</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
            <Ruler className="w-5 h-5 text-primary-500 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500">身長</p>
              <p className="font-medium text-gray-900">{player.height ? `${player.height} cm` : '-'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
            <Weight className="w-5 h-5 text-primary-500 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500">体重</p>
              <p className="font-medium text-gray-900">{player.weight ? `${player.weight} kg` : '-'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
            <Footprints className="w-5 h-5 text-primary-500 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500">利き足</p>
              <p className="font-medium text-gray-900">{player.dominantFoot || '-'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
            <MapPin className="w-5 h-5 text-primary-500 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500">出身地</p>
              <p className="font-medium text-gray-900">{player.hometown || '-'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
            <GraduationCap className="w-5 h-5 text-primary-500 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500">出身校</p>
              <p className="font-medium text-gray-900">{player.school || '-'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
            <Users className="w-5 h-5 text-primary-500 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500">前所属チーム</p>
              <p className="font-medium text-gray-900">{player.previousTeam || '-'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
            <Star className="w-5 h-5 text-primary-500 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500">目標とする選手</p>
              <p className="font-medium text-gray-900">{player.roleModel || '-'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
            <Zap className="w-5 h-5 text-primary-500 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500">プレースタイル</p>
              <p className="font-medium text-gray-900">{player.playStyle || '-'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-6 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-3 border-b-2 text-sm font-medium whitespace-nowrap transition-colors ${
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

      {activeTab === 'evaluation' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">指導者評価 vs 自己評価</h2>
            {evaluationComparison.hasData && evaluationComparison.comparison.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-600">大項目</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">中項目</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">項目名</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-600">指導者</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-600">自己</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-600">ギャップ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evaluationComparison.comparison.map((row, idx) => (
                      <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-gray-700">{row.category || '-'}</td>
                        <td className="py-3 px-4 text-gray-700">{row.subCategory || '-'}</td>
                        <td className="py-3 px-4 font-medium text-gray-900">{row.itemName}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-bold ${getScoreColor(row.coachScore)} ${getScoreTextColor(row.coachScore)}`}>
                            {row.coachScore ?? '-'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-bold ${getScoreColor(row.selfScore)} ${getScoreTextColor(row.selfScore)}`}>
                            {row.selfScore ?? '-'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {getGapBadge(row.gap)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">評価データがありません</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">評価サマリー（ヒートマップ）</h2>
            {Object.keys(heatmapData.categoryGroups).length > 0 ? (
              <div className="space-y-6">
                {Object.entries(heatmapData.categoryGroups).map(([category, items]) => (
                  <div key={category}>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">{category}</h3>
                    <div className="flex flex-wrap gap-2">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className={`relative group px-3 py-2 rounded-lg ${getHeatmapColor(item.percentage)} transition-all cursor-default`}
                          title={`${item.name}: ${item.score}/5 (${item.percentage.toFixed(0)}%)`}
                        >
                          <span className={`text-xs font-medium ${item.percentage > 60 ? 'text-white' : 'text-gray-700'}`}>
                            {item.name}
                          </span>
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                            {item.score}/5 ({item.percentage.toFixed(0)}%)
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-4 pt-4 border-t border-gray-200">
                  <span className="text-xs text-gray-500">達成度:</span>
                  <div className="flex items-center gap-1">
                    <div className="w-8 h-4 bg-gray-200 rounded"></div>
                    <span className="text-xs text-gray-500">0%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-8 h-4 bg-blue-200 rounded"></div>
                    <span className="text-xs text-gray-500">40%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-8 h-4 bg-blue-400 rounded"></div>
                    <span className="text-xs text-gray-500">80%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-8 h-4 bg-blue-500 rounded"></div>
                    <span className="text-xs text-gray-500">100%</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">評価項目がありません</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'videos' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">動画一覧</h2>
          {player.videos?.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {player.videos.map((video) => (
                <div key={video.id} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                  <div className="aspect-video bg-gray-100 flex items-center justify-center">
                    <Video className="w-12 h-12 text-gray-400" />
                  </div>
                  <div className="p-3">
                    <p className="font-medium text-gray-900 truncate">{video.title}</p>
                    <p className="text-sm text-gray-500 truncate">{video.description}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Video className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">動画がありません</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'notes' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">コメント/ノート</h2>
          
          {isCoachOrAdmin && (
            <div className="mb-6">
              <div className="flex gap-3">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="選手へのフィードバックやメモを入力..."
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  rows={3}
                />
                <button
                  onClick={handleAddNote}
                  disabled={submittingNote || !newNote.trim()}
                  className="self-end px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {notes.length > 0 ? (
            <div className="space-y-4">
              {notes.map((note) => (
                <div key={note.id} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                        <UserCircle className="w-6 h-6 text-primary-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900">{note.author?.name || '不明'}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(note.createdAt).toLocaleDateString('ja-JP', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <p className="text-gray-700 whitespace-pre-wrap">{note.content}</p>
                      </div>
                    </div>
                    {(note.authorId === user?.id || isOperator()) && (
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">まだコメント/ノートがありません</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'progress' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">総合スコア推移（合計点）</h2>
            {progressData.progressData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={progressData.progressData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="roundName" tick={{ fontSize: 12 }} stroke="#6B7280" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#6B7280" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #E5E7EB',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="coachTotal" 
                      name="指導者評価（合計）" 
                      stroke="#3B82F6" 
                      strokeWidth={2}
                      dot={{ fill: '#3B82F6', strokeWidth: 2 }}
                      connectNulls
                    />
                    <Line 
                      type="monotone" 
                      dataKey="selfTotal" 
                      name="自己評価（合計）" 
                      stroke="#10B981" 
                      strokeWidth={2}
                      dot={{ fill: '#10B981', strokeWidth: 2 }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-8">
                <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">評価データが蓄積されるとグラフが表示されます</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">カテゴリ別推移（指導者評価）</h2>
            {progressData.progressData.length > 0 && progressData.categories.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={progressData.progressData.map(d => {
                    const categoryData = { roundName: d.roundName };
                    progressData.categories.forEach((cat) => {
                      categoryData[cat] = d.categories[cat]?.coach ? parseFloat(d.categories[cat].coach) : null;
                    });
                    return categoryData;
                  })}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="roundName" tick={{ fontSize: 12 }} stroke="#6B7280" />
                    <YAxis domain={[0, 5]} tick={{ fontSize: 12 }} stroke="#6B7280" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #E5E7EB',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                    />
                    <Legend />
                    {progressData.categories.map((cat, idx) => (
                      <Line 
                        key={cat}
                        type="monotone" 
                        dataKey={cat} 
                        name={cat} 
                        stroke={categoryColors[idx % categoryColors.length]} 
                        strokeWidth={2}
                        dot={{ fill: categoryColors[idx % categoryColors.length], strokeWidth: 2 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-8">
                <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">カテゴリ別データがありません</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">評価ギャップ推移</h2>
            {progressData.progressData.length > 0 && progressData.progressData.some(d => d.gap !== null) ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={progressData.progressData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="roundName" tick={{ fontSize: 12 }} stroke="#6B7280" />
                    <YAxis domain={[-2, 2]} tick={{ fontSize: 12 }} stroke="#6B7280" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #E5E7EB',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                      formatter={(value) => [value, 'ギャップ (指導者 - 自己)']}
                    />
                    <ReferenceLine y={0} stroke="#9CA3AF" strokeDasharray="3 3" />
                    <Bar 
                      dataKey="gap" 
                      name="ギャップ"
                      radius={[4, 4, 0, 0]}
                    >
                      {progressData.progressData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.gap >= 0 ? '#3B82F6' : '#EF4444'} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-8">
                <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">ギャップデータがありません</p>
              </div>
            )}
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600">
                <span className="font-medium text-blue-600">プラス (青)</span>: 指導者の方が高く評価 → 選手は謙虚、伸び代あり<br />
                <span className="font-medium text-red-600">マイナス (赤)</span>: 自己評価の方が高い → 自己認識のズレ、要フィードバック
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'appeal' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">アピールURL</h2>
          
          {isSelf && (
            <button
              onClick={() => handleCreateAppeal('simple')}
              className="mb-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              シンプル版URLを発行
            </button>
          )}

          {player.appealLinks?.length > 0 ? (
            <div className="space-y-3">
              {player.appealLinks.map((link) => (
                <div key={link.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">
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
                    className="text-sm text-primary-600 hover:underline font-medium"
                  >
                    URLを開く
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Link2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">アピールURLがありません</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
