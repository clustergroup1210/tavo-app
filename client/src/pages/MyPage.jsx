import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  UserCircle, TrendingUp, Link2, Edit2, Save, X, Target, Plus, Trash2, Camera,
  Calendar, Ruler, Weight, MapPin, GraduationCap, Users, Footprints, Star, Zap, Upload, Clock, ChevronLeft, ChevronRight
} from 'lucide-react';
import PlayerMatrix from '../components/PlayerMatrix';
import MentoringTable from '../components/MentoringTable';

export default function MyPage() {
  const { user, isParent, childPlayerData } = useAuth();
  const [playerData, setPlayerData] = useState(null);
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
  const [personalEvents, setPersonalEvents] = useState([]);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventForm, setEventForm] = useState({
    title: '', description: '', startDate: '', startTime: '09:00',
    endDate: '', endTime: '10:00', allDay: false, location: ''
  });
  const passportInputRef = useRef(null);
  const photoInputRef = useRef(null);
  const isParentView = isParent();

  useEffect(() => {
    fetchMyData();
  }, [user, childPlayerData]);

  const fetchMyData = async () => {
    try {
      let myPlayer = null;
      
      if (isParentView && childPlayerData) {
        const playerRes = await fetch(`/api/players/${childPlayerData.id}`, { credentials: 'include' });
        if (playerRes.ok) {
          myPlayer = await playerRes.json();
        }
      } else {
        const playersRes = await fetch('/api/players', { credentials: 'include' });
        const players = await playersRes.json();
        myPlayer = players.find(p => p.userId === user?.id);
      }

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
        const [goalsRes, categoriesRes] = await Promise.all([
          fetch(`/api/goals/player/${myPlayer.id}`, { credentials: 'include' }),
          fetch(`/api/goals/categories?teamId=${categoryTeamId}`, { credentials: 'include' }),
        ]);
        
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

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !playerData) return;

    const formData = new FormData();
    formData.append('photo', file);

    try {
      const res = await fetch(`/api/players/${playerData.id}/photo`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (res.ok) {
        const updated = await res.json();
        setPlayerData({ ...playerData, photoUrl: updated.photoUrl });
      }
    } catch (error) {
      console.error('Failed to upload photo:', error);
    }
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

  useEffect(() => {
    fetchPersonalEvents();
  }, [calendarMonth]);

  const fetchPersonalEvents = async () => {
    try {
      const month = calendarMonth.getMonth() + 1;
      const year = calendarMonth.getFullYear();
      const res = await fetch(`/api/calendar/personal?month=${month}&year=${year}`, { credentials: 'include' });
      const data = await res.json();
      setPersonalEvents(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch personal events:', error);
    }
  };

  const openNewEvent = () => {
    setEditingEvent(null);
    const today = new Date().toISOString().split('T')[0];
    setEventForm({
      title: '', description: '', startDate: today, startTime: '09:00',
      endDate: today, endTime: '10:00', allDay: false, location: ''
    });
    setShowEventModal(true);
  };

  const openEditEvent = (event) => {
    setEditingEvent(event);
    const start = new Date(event.startDate);
    const end = event.endDate ? new Date(event.endDate) : start;
    setEventForm({
      title: event.title, description: event.description || '',
      startDate: start.toISOString().split('T')[0],
      startTime: start.toTimeString().slice(0, 5),
      endDate: end.toISOString().split('T')[0],
      endTime: end.toTimeString().slice(0, 5),
      allDay: event.allDay, location: event.location || ''
    });
    setShowEventModal(true);
  };

  const handleSaveEvent = async () => {
    if (!eventForm.title.trim() || !eventForm.startDate) return;
    try {
      const startDt = eventForm.allDay
        ? new Date(eventForm.startDate)
        : new Date(`${eventForm.startDate}T${eventForm.startTime}`);
      const endDt = eventForm.allDay
        ? new Date(eventForm.endDate || eventForm.startDate)
        : new Date(`${eventForm.endDate || eventForm.startDate}T${eventForm.endTime}`);

      const payload = {
        title: eventForm.title, description: eventForm.description,
        startDate: startDt.toISOString(), endDate: endDt.toISOString(),
        allDay: eventForm.allDay, eventType: 'personal',
        location: eventForm.location, isPersonal: true
      };

      let res;
      if (editingEvent) {
        res = await fetch(`/api/calendar/${editingEvent.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          credentials: 'include', body: JSON.stringify(payload)
        });
      } else {
        res = await fetch('/api/calendar', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          credentials: 'include', body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        setShowEventModal(false);
        fetchPersonalEvents();
      }
    } catch (error) {
      console.error('Failed to save event:', error);
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (!confirm('この予定を削除しますか？')) return;
    try {
      await fetch(`/api/calendar/${eventId}`, { method: 'DELETE', credentials: 'include' });
      fetchPersonalEvents();
    } catch (error) {
      console.error('Failed to delete event:', error);
    }
  };

  const formatEventDate = (dateStr) => {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const formatEventTime = (dateStr) => {
    const d = new Date(dateStr);
    return d.toTimeString().slice(0, 5);
  };

  const calendarMonthLabel = `${calendarMonth.getFullYear()}年${calendarMonth.getMonth() + 1}月`;

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
      {isParentView && (
        <div className="bg-pink-50 border border-pink-200 rounded-lg p-4 flex items-center gap-3">
          <Users className="w-5 h-5 text-pink-600" />
          <div>
            <p className="text-sm font-medium text-pink-800">保護者としてログイン中</p>
            <p className="text-xs text-pink-600">{playerData?.name}さんのデータを閲覧しています（編集不可）</p>
          </div>
        </div>
      )}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-primary-500 to-primary-600 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="relative group flex flex-col items-center">
                <div className="w-20 h-20 sm:w-32 sm:h-32 md:w-40 md:h-40 rounded-2xl bg-white/20 flex items-center justify-center border-3 sm:border-4 border-white/30 shadow-xl overflow-hidden">
                  {playerData.photoUrl ? (
                    <img
                      src={playerData.photoUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <UserCircle className="w-10 h-10 sm:w-20 sm:h-20 text-white/60" />
                  )}
                </div>
                <span className="mt-1 text-[10px] sm:text-xs text-white/80">プロフィール</span>
                {!isParentView && (
                  <label className="absolute bottom-5 -right-1 p-1 sm:p-1.5 bg-white rounded-full shadow-lg cursor-pointer hover:bg-gray-100 transition-colors">
                    <Upload className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary-600" />
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
              
              <div className="relative group flex flex-col items-center">
                <div className="w-12 h-16 sm:w-16 sm:h-20 md:w-20 md:h-24 rounded-lg bg-white/20 flex items-center justify-center border-2 border-white/30 shadow-lg overflow-hidden">
                  {playerData.passportUrl ? (
                    <img
                      src={playerData.passportUrl}
                      alt="選手証"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Camera className="w-5 h-5 sm:w-6 sm:h-6 text-white/60" />
                  )}
                </div>
                <span className="mt-1 text-[10px] sm:text-xs text-white/80">選手証</span>
                {!isParentView && (
                  <label className="absolute bottom-5 -right-1 p-1 sm:p-1.5 bg-white rounded-full shadow-lg cursor-pointer hover:bg-gray-100 transition-colors">
                    <Upload className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary-600" />
                    <input
                      ref={passportInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePassportUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <div className="flex-1 text-white sm:hidden min-w-0">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-2xl font-bold">No.{playerData.number || '-'}</span>
                </div>
                <h1 className="text-xl font-bold truncate">{playerData.name}</h1>
                {playerData.nameRomaji && (
                  <p className="text-primary-100 text-xs mt-0.5 truncate">{playerData.nameRomaji}</p>
                )}
              </div>
            </div>

            <div className="hidden sm:flex flex-1 text-white flex-col min-w-0">
              <div className="flex items-center gap-4 mb-2">
                <span className="text-3xl md:text-4xl font-bold">No.{playerData.number || '-'}</span>
                <h1 className="text-2xl md:text-3xl font-bold truncate">{playerData.name}</h1>
              </div>
              {playerData.nameRomaji && (
                <p className="text-primary-100 mb-3">{playerData.nameRomaji}</p>
              )}
              <div className="flex items-center gap-3 flex-wrap">
                {playerData.position && (
                  <span className="px-3 py-1 bg-primary-400/30 rounded-full text-sm font-medium">
                    {playerData.position}
                  </span>
                )}
                <span className="px-3 py-1 bg-white/20 rounded-full text-sm truncate">
                  {playerData.team?.parent?.name ? `${playerData.team.parent.name} / ${playerData.team.name}` : playerData.team?.name}
                </span>
              </div>
            </div>

            {!isParentView && (
              <button
                onClick={() => setEditing(true)}
                className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors shrink-0"
              >
                <Edit2 className="w-4 h-4" />
                編集
              </button>
            )}
          </div>

          <div className="sm:hidden mt-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              {playerData.position && (
                <span className="px-2.5 py-0.5 bg-primary-400/30 rounded-full text-xs font-medium text-white">
                  {playerData.position}
                </span>
              )}
              <span className="px-2.5 py-0.5 bg-white/20 rounded-full text-xs text-white truncate">
                {playerData.team?.parent?.name ? `${playerData.team.parent.name} / ${playerData.team.name}` : playerData.team?.name}
              </span>
            </div>
            {!isParentView && (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors text-xs shrink-0"
              >
                <Edit2 className="w-3.5 h-3.5" />
                編集
              </button>
            )}
          </div>
        </div>

        <div className="p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">基本情報</h3>
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 bg-gray-50 rounded-lg">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-gray-500">生年月日</p>
                <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">{formatDate(playerData.birthDate)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 bg-gray-50 rounded-lg">
              <Ruler className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-gray-500">身長</p>
                <p className="text-xs sm:text-sm font-medium text-gray-900">{playerData.height ? `${playerData.height}cm` : '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 bg-gray-50 rounded-lg">
              <Weight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-gray-500">体重</p>
                <p className="text-xs sm:text-sm font-medium text-gray-900">{playerData.weight ? `${playerData.weight}kg` : '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 bg-gray-50 rounded-lg">
              <Footprints className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-gray-500">利き足</p>
                <p className="text-xs sm:text-sm font-medium text-gray-900">{playerData.dominantFoot || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 bg-gray-50 rounded-lg">
              <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-gray-500">出身地</p>
                <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">{playerData.hometown || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 bg-gray-50 rounded-lg">
              <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-gray-500">出身校</p>
                <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">{playerData.school || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 bg-gray-50 rounded-lg">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-gray-500">前所属</p>
                <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">{playerData.previousTeam || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 bg-gray-50 rounded-lg">
              <Star className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-gray-500">目標選手</p>
                <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">{playerData.roleModel || '-'}</p>
              </div>
            </div>
          </div>

          <div className="mt-3 sm:mt-4 flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 bg-gray-50 rounded-lg">
            <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] sm:text-xs text-gray-500">プレースタイル</p>
              <p className="text-xs sm:text-sm font-medium text-gray-900">{playerData.playStyle || '-'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 sm:w-5 sm:h-5 text-primary-600" />
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">目標</h3>
          </div>
          {goalCategories.length > 0 && !isParentView && (
            <button
              onClick={() => setShowGoalModal(true)}
              className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              追加
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
                          {!isParentView && (
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
                          )}
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

      {!isParentView && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">個人カレンダー</h3>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1))}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs sm:text-sm font-medium text-gray-700 min-w-[80px] text-center">{calendarMonthLabel}</span>
                <button
                  onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1))}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={openNewEvent}
                className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600"
              >
                <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                追加
              </button>
            </div>
          </div>

          {personalEvents.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">この月の個人予定はありません</p>
          ) : (
            <div className="space-y-2">
              {personalEvents.map((event) => {
                const startD = new Date(event.startDate);
                return (
                  <div key={event.id} className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-100 rounded-lg group">
                    <div className="flex-shrink-0 w-12 text-center">
                      <p className="text-lg font-bold text-amber-600">{startD.getDate()}</p>
                      <p className="text-[10px] text-amber-500">{['日','月','火','水','木','金','土'][startD.getDay()]}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{event.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {event.allDay ? (
                          <span className="text-[11px] text-amber-600">終日</span>
                        ) : (
                          <span className="flex items-center gap-0.5 text-[11px] text-gray-500">
                            <Clock className="w-3 h-3" />
                            {formatEventTime(event.startDate)}
                            {event.endDate && ` - ${formatEventTime(event.endDate)}`}
                          </span>
                        )}
                        {event.location && (
                          <span className="flex items-center gap-0.5 text-[11px] text-gray-500">
                            <MapPin className="w-3 h-3" />
                            {event.location}
                          </span>
                        )}
                      </div>
                      {event.description && (
                        <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">{event.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEditEvent(event)}
                        className="p-1 text-gray-400 hover:text-amber-600 rounded hover:bg-amber-100"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteEvent(event.id)}
                        className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <PlayerMatrix playerId={playerData.id} />

      <MentoringTable playerId={playerData.id} isSelf={!isParent()} isCoach={false} />

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-3 sm:mb-4">
          <Link2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary-600" />
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">アピールURL</h3>
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
          className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm sm:text-base"
        >
          アピールURLを発行
        </button>
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

      {showEventModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingEvent ? '予定を編集' : '個人予定を追加'}
              </h3>
              <button onClick={() => setShowEventModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">タイトル</label>
                <input
                  type="text"
                  value={eventForm.title}
                  onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  placeholder="予定のタイトル"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="personalAllDay"
                  checked={eventForm.allDay}
                  onChange={(e) => setEventForm({ ...eventForm, allDay: e.target.checked })}
                  className="rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                />
                <label htmlFor="personalAllDay" className="text-sm text-gray-600">終日</label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">開始日</label>
                  <input
                    type="date"
                    value={eventForm.startDate}
                    onChange={(e) => setEventForm({ ...eventForm, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                {!eventForm.allDay && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">開始時間</label>
                    <input
                      type="time"
                      value={eventForm.startTime}
                      onChange={(e) => setEventForm({ ...eventForm, startTime: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">終了日</label>
                  <input
                    type="date"
                    value={eventForm.endDate}
                    onChange={(e) => setEventForm({ ...eventForm, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                {!eventForm.allDay && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">終了時間</label>
                    <input
                      type="time"
                      value={eventForm.endTime}
                      onChange={(e) => setEventForm({ ...eventForm, endTime: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">場所</label>
                <input
                  type="text"
                  value={eventForm.location}
                  onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  placeholder="場所（任意）"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">メモ</label>
                <textarea
                  value={eventForm.description}
                  onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  placeholder="詳細メモ（任意）"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowEventModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSaveEvent}
                  disabled={!eventForm.title.trim() || !eventForm.startDate}
                  className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50"
                >
                  {editingEvent ? '更新' : '追加'}
                </button>
              </div>
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
