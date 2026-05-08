import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Check, ClipboardList, Calendar, ChevronRight, X, Video, Target, MessageSquare, Tag, StickyNote } from 'lucide-react';
import clsx from 'clsx';

const TARGET_TYPES = [
  { value: 'EVALUATION', label: '評価入力', icon: ClipboardList, color: 'text-blue-600 bg-blue-50' },
  { value: 'VIDEO',      label: '動画確認', icon: Video,         color: 'text-purple-600 bg-purple-50' },
  { value: 'MENTORING',  label: 'メンタリング', icon: MessageSquare, color: 'text-teal-600 bg-teal-50' },
  { value: 'MEETING',    label: 'ミーティング', icon: Calendar,    color: 'text-amber-600 bg-amber-50' },
  { value: 'GOAL',       label: '目標設定',  icon: Target,        color: 'text-green-600 bg-green-50' },
  { value: 'OTHER',      label: 'その他',    icon: Tag,           color: 'text-gray-600 bg-gray-50' },
];

function buildTargetUrl(type, playerId) {
  if (!type) return '';
  switch (type) {
    case 'EVALUATION': return playerId ? `/evaluations/entry?playerId=${playerId}` : '/evaluations/entry';
    case 'VIDEO':      return '/videos';
    case 'MENTORING':  return playerId ? `/players/${playerId}` : '/players';
    case 'MEETING':    return '/calendar';
    case 'GOAL':       return playerId ? `/players/${playerId}` : '/players';
    default:           return '';
  }
}

function formatDueDate(d) {
  if (!d) return null;
  const date = new Date(d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target - today) / 86400000);
  const label = `${date.getMonth() + 1}/${date.getDate()}`;
  if (diff < 0) return { label: `${label}（${-diff}日超過）`, overdue: true };
  if (diff === 0) return { label: `${label}（今日）`, urgent: true };
  if (diff <= 2) return { label: `${label}（あと${diff}日）`, urgent: true };
  return { label, overdue: false, urgent: false };
}

export default function TaskListWidget() {
  const navigate = useNavigate();
  const { currentTeam, isCoach, isOperator, isPlayer, isParent, user } = useAuth();
  const teamId = currentTeam?.id;
  const canAssign = (teamId && isCoach(teamId)) || isOperator();

  const [tasks, setTasks] = useState([]);
  const [players, setPlayers] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const playerMode = (isPlayer() || isParent()) && !canAssign;

  useEffect(() => {
    fetchTasks();
  }, [teamId, playerMode]);

  useEffect(() => {
    if (canAssign && teamId) {
      fetchPlayers();
      fetchStaff();
    }
  }, [teamId, canAssign]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const url = playerMode
        ? '/api/tasks/my-tasks'
        : (teamId ? `/api/tasks?teamId=${teamId}` : '');
      if (!url) { setTasks([]); setLoading(false); return; }
      const res = await fetch(url, { credentials: 'include' });
      const data = await res.json();
      setTasks(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to fetch tasks:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlayers = async () => {
    try {
      const res = await fetch(`/api/players?teamId=${teamId}`, { credentials: 'include' });
      const data = await res.json();
      setPlayers(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to fetch players:', e);
    }
  };

  const fetchStaff = async () => {
    try {
      const res = await fetch(`/api/users?teamId=${teamId}`, { credentials: 'include' });
      if (!res.ok) { setStaff([]); return; }
      const data = await res.json();
      const list = (Array.isArray(data) ? data : [])
        .map(u => {
          const tr = (u.teams || []).find(t => t.teamId === teamId);
          return tr ? { id: u.id, name: u.name, role: tr.role } : null;
        })
        .filter(u => u && ['TEAM_MANAGER', 'COACH', 'GUEST_COACH'].includes(u.role) && u.id !== user?.id);
      setStaff(list);
    } catch (e) {
      console.error('Failed to fetch staff:', e);
    }
  };

  const openTasks = useMemo(
    () => tasks.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED')
               .sort((a, b) => {
                 if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
                 if (a.dueDate) return -1;
                 if (b.dueDate) return 1;
                 return new Date(b.createdAt) - new Date(a.createdAt);
               }),
    [tasks]
  );

  const handleComplete = async (taskId, e) => {
    e?.stopPropagation();
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'COMPLETED' })
      });
      if (res.ok) setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (err) {
      console.error('Failed to complete task:', err);
    }
  };

  const handleNavigate = (task) => {
    if (task.targetUrl) navigate(task.targetUrl);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-orange-50 text-orange-600">
            <ClipboardList className="w-4 h-4" />
          </div>
          <h3 className="text-[14px] font-semibold text-gray-900 truncate">
            {playerMode ? 'マイタスク' : '担当タスク'}
          </h3>
          {openTasks.length > 0 && (
            <span className="text-[11px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
              {openTasks.length}
            </span>
          )}
        </div>
        {canAssign && (
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[12px] font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            作成
          </button>
        )}
      </div>

      <div className="divide-y divide-gray-50">
        {loading ? (
          <div className="px-5 py-8 text-center">
            <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-orange-500"></div>
          </div>
        ) : openTasks.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <div className="inline-flex w-12 h-12 rounded-full bg-gray-50 items-center justify-center mb-2">
              <Check className="w-5 h-5 text-gray-300" />
            </div>
            <p className="text-[13px] text-gray-500">現在、担当タスクはありません</p>
            {canAssign && (
              <p className="text-[11px] text-gray-400 mt-1">右上の「+作成」から追加できます</p>
            )}
          </div>
        ) : (
          openTasks.slice(0, 8).map(task => {
            const due = formatDueDate(task.dueDate);
            const typeMeta = TARGET_TYPES.find(t => t.value === task.targetType);
            const TypeIcon = typeMeta?.icon;
            const clickable = !!task.targetUrl;
            return (
              <div
                key={task.id}
                onClick={() => clickable && handleNavigate(task)}
                className={clsx(
                  'flex items-center gap-3 px-4 sm:px-5 py-3 transition-colors',
                  clickable ? 'cursor-pointer hover:bg-gray-50' : ''
                )}
              >
                <button
                  onClick={(e) => handleComplete(task.id, e)}
                  className="flex-shrink-0 w-5 h-5 rounded-md border-2 border-gray-300 hover:border-green-500 hover:bg-green-50 flex items-center justify-center transition-colors group"
                  aria-label="完了にする"
                  title="完了にする"
                >
                  <Check className="w-3 h-3 text-transparent group-hover:text-green-600" />
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {typeMeta && TypeIcon && (
                      <span className={clsx('inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium', typeMeta.color)}>
                        <TypeIcon className="w-2.5 h-2.5" />
                        {typeMeta.label}
                      </span>
                    )}
                    <span className="text-[13px] font-medium text-gray-900 truncate">
                      {task.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    {!playerMode && (task.player || task.assignee) && (() => {
                      const isSelfMemo = task.assignee && task.assignee.id === user?.id && task.assignedBy === user?.id;
                      return (
                        <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 truncate">
                          {isSelfMemo ? (
                            <span className="inline-flex items-center gap-0.5 px-1 py-px text-[9px] bg-amber-50 text-amber-700 rounded">
                              <StickyNote className="w-2.5 h-2.5" />メモ
                            </span>
                          ) : task.assignee ? (
                            <span className="px-1 py-px text-[9px] bg-indigo-50 text-indigo-700 rounded">スタッフ</span>
                          ) : null}
                          {!isSelfMemo && (task.player?.name || task.assignee?.name)}
                        </span>
                      );
                    })()}
                    {due && (
                      <span className={clsx(
                        'inline-flex items-center gap-0.5 text-[11px]',
                        due.overdue ? 'text-red-600 font-medium' : due.urgent ? 'text-amber-600 font-medium' : 'text-gray-500'
                      )}>
                        <Calendar className="w-3 h-3" />
                        {due.label}
                      </span>
                    )}
                  </div>
                </div>

                {clickable && (
                  <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                )}
              </div>
            );
          })
        )}
        {openTasks.length > 8 && (
          <div className="px-5 py-2 text-center">
            <span className="text-[11px] text-gray-400">他 {openTasks.length - 8} 件</span>
          </div>
        )}
      </div>

      {showModal && (
        <CreateTaskModal
          players={players}
          staff={staff}
          teamId={teamId}
          currentUser={user}
          onClose={() => setShowModal(false)}
          onCreated={(t) => { setTasks(prev => [t, ...prev]); setShowModal(false); }}
        />
      )}
    </div>
  );
}

function CreateTaskModal({ players, staff, teamId, currentUser, onClose, onCreated }) {
  const [form, setForm] = useState({
    assigneeKind: 'SELF',
    assigneeId: currentUser?.id || '',
    title: '',
    description: '',
    dueDate: '',
    targetType: '',
    targetUrl: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const setKind = (kind) => {
    if (kind === 'SELF') setForm(f => ({ ...f, assigneeKind: 'SELF', assigneeId: currentUser?.id || '' }));
    else setForm(f => ({ ...f, assigneeKind: kind, assigneeId: '' }));
  };

  const targetUrlAuto = form.targetType
    ? buildTargetUrl(form.targetType, form.assigneeKind === 'PLAYER' ? form.assigneeId : null)
    : '';

  const submitDisabled = submitting || !form.title.trim() || (form.assigneeKind !== 'SELF' && !form.assigneeId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitDisabled) return;
    setSubmitting(true);
    setError('');
    try {
      const body = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        dueDate: form.dueDate || null,
        targetType: form.targetType || null,
        targetUrl: form.targetType ? (form.targetUrl || targetUrlAuto || null) : null
      };
      if (form.assigneeKind === 'PLAYER') {
        body.playerId = form.assigneeId;
      } else if (form.assigneeKind === 'STAFF') {
        body.assigneeUserId = form.assigneeId;
        body.teamId = teamId;
      } else {
        body.assigneeUserId = currentUser?.id;
        body.teamId = teamId;
      }
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'タスクの作成に失敗しました');
        return;
      }
      const task = await res.json();
      onCreated(task);
    } catch (err) {
      console.error(err);
      setError('タスクの作成に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto overflow-x-hidden shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <h3 className="text-[14px] font-semibold text-gray-900">新しいタスク</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1.5">担当者の種類</label>
            <div className="grid grid-cols-3 gap-1.5 mb-2">
              <button
                type="button"
                onClick={() => setKind('SELF')}
                className={clsx(
                  'inline-flex items-center justify-center gap-1 px-2 py-1.5 text-[12px] rounded-lg border transition-colors',
                  form.assigneeKind === 'SELF' ? 'bg-amber-50 border-amber-400 text-amber-800 font-medium' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                )}
              >
                <StickyNote className="w-3 h-3" />
                自分用メモ
              </button>
              <button
                type="button"
                onClick={() => setKind('PLAYER')}
                className={clsx(
                  'px-2 py-1.5 text-[12px] rounded-lg border transition-colors',
                  form.assigneeKind === 'PLAYER' ? 'bg-orange-50 border-orange-400 text-orange-800 font-medium' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                )}
              >
                選手
              </button>
              <button
                type="button"
                onClick={() => setKind('STAFF')}
                className={clsx(
                  'px-2 py-1.5 text-[12px] rounded-lg border transition-colors',
                  form.assigneeKind === 'STAFF' ? 'bg-indigo-50 border-indigo-400 text-indigo-800 font-medium' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                )}
              >
                スタッフ
              </button>
            </div>
            {form.assigneeKind === 'SELF' ? (
              <p className="text-[11px] text-gray-500 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                自分専用のメモタスクとして登録します。他のユーザーには通知されません。
              </p>
            ) : (
              <>
                <label className="block text-[11px] font-medium text-gray-500 mb-1">
                  {form.assigneeKind === 'PLAYER' ? '担当選手' : '担当スタッフ'} <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.assigneeId}
                  onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}
                  required
                  className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                >
                  <option value="">{form.assigneeKind === 'PLAYER' ? '選手を選択...' : 'スタッフを選択...'}</option>
                  {form.assigneeKind === 'PLAYER'
                    ? players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)
                    : staff.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name}（{s.role === 'TEAM_MANAGER' ? 'チーム管理者' : s.role === 'COACH' ? 'コーチ' : 'ゲストコーチ'}）
                        </option>
                      ))}
                </select>
                {form.assigneeKind === 'STAFF' && staff.length === 0 && (
                  <p className="text-[10px] text-gray-400 mt-1">このチームに登録されているスタッフがいません。</p>
                )}
                {form.assigneeKind !== 'SELF' && (
                  <p className="text-[10px] text-gray-400 mt-1">担当者がタスクを完了すると、あなたに完了通知が届きます。</p>
                )}
              </>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1">タスク名 <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              placeholder="例: 〇月評価入力を完了する"
              className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1.5">タスクの種類</label>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => setForm({ ...form, targetType: '', targetUrl: '' })}
                className={clsx(
                  'px-2 py-1.5 text-[11px] rounded-lg border transition-colors',
                  !form.targetType ? 'bg-gray-100 border-gray-400 text-gray-800 font-medium' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                )}
              >
                なし
              </button>
              {TARGET_TYPES.map(t => {
                const Icon = t.icon;
                const active = form.targetType === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setForm({ ...form, targetType: t.value, targetUrl: '' })}
                    className={clsx(
                      'inline-flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] rounded-lg border transition-colors',
                      active ? 'bg-orange-50 border-orange-400 text-orange-800 font-medium' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    )}
                  >
                    <Icon className="w-3 h-3" />
                    {t.label}
                  </button>
                );
              })}
            </div>
            {form.targetType && targetUrlAuto && (
              <p className="text-[10px] text-gray-400 mt-1.5 break-all">遷移先: {form.targetUrl || targetUrlAuto}</p>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1">期限（任意）</label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1">詳細（任意）</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              placeholder="補足や注意点..."
              className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none resize-none"
            />
          </div>

          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-[12px] text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-[12px] text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={submitDisabled}
              className="px-4 py-2 text-[12px] font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? '作成中...' : '作成'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
