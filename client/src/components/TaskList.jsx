import React, { useState, useEffect } from 'react';
import { Target, Plus, Check, Clock, X, Calendar, User } from 'lucide-react';
import clsx from 'clsx';

const statusConfig = {
  PENDING: { label: '未着手', color: 'bg-gray-100 text-gray-700', icon: Clock },
  IN_PROGRESS: { label: '進行中', color: 'bg-blue-100 text-blue-700', icon: Target },
  COMPLETED: { label: '完了', color: 'bg-green-100 text-green-700', icon: Check },
  CANCELLED: { label: 'キャンセル', color: 'bg-red-100 text-red-700', icon: X }
};

export default function TaskList({ playerId, canAssign = false, showAssigner = true }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ title: '', description: '', dueDate: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (playerId) {
      fetchTasks();
    }
  }, [playerId]);

  const fetchTasks = async () => {
    try {
      const res = await fetch(`/api/tasks/player/${playerId}`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          playerId,
          title: formData.title,
          description: formData.description || null,
          dueDate: formData.dueDate || null
        })
      });

      if (res.ok) {
        const task = await res.json();
        setTasks([task, ...tasks]);
        setShowForm(false);
        setFormData({ title: '', description: '', dueDate: '' });
      }
    } catch (error) {
      console.error('Failed to create task:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus })
      });

      if (res.ok) {
        const updated = await res.json();
        setTasks(tasks.map(t => t.id === taskId ? updated : t));
      }
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
  };

  const isOverdue = (dueDate, status) => {
    if (!dueDate || status === 'COMPLETED' || status === 'CANCELLED') return false;
    return new Date(dueDate) < new Date();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-orange-600" />
          <h3 className="font-semibold text-gray-900">課題一覧</h3>
          <span className="text-sm text-gray-500">({tasks.length})</span>
        </div>
        {canAssign && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700"
          >
            <Plus className="w-4 h-4" />
            課題を追加
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-orange-50 rounded-lg p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">課題タイトル</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="例: 左足でのシュート練習"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">詳細（任意）</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              rows={2}
              placeholder="具体的な内容や目標..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">期限（任意）</label>
            <input
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setShowForm(false); setFormData({ title: '', description: '', dueDate: '' }); }}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
            >
              {submitting ? '追加中...' : '追加'}
            </button>
          </div>
        </form>
      )}

      {tasks.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-6 text-center text-gray-500">
          課題はまだ設定されていません
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => {
            const config = statusConfig[task.status];
            const Icon = config.icon;
            const overdue = isOverdue(task.dueDate, task.status);

            return (
              <div
                key={task.id}
                className={clsx(
                  'bg-white border rounded-lg p-4',
                  overdue ? 'border-red-300 bg-red-50' : 'border-gray-200'
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0', config.color)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className={clsx(
                          'font-medium',
                          task.status === 'COMPLETED' ? 'text-gray-400 line-through' : 'text-gray-900'
                        )}>
                          {task.title}
                        </h4>
                        {task.description && (
                          <p className="text-sm text-gray-500 mt-1">{task.description}</p>
                        )}
                      </div>
                      <span className={clsx('px-2 py-0.5 text-xs rounded-full flex-shrink-0', config.color)}>
                        {config.label}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                      {task.dueDate && (
                        <span className={clsx('flex items-center gap-1', overdue && 'text-red-600 font-medium')}>
                          <Calendar className="w-3 h-3" />
                          期限: {formatDate(task.dueDate)}
                          {overdue && ' (期限超過)'}
                        </span>
                      )}
                      {showAssigner && task.assigner && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {task.assigner.name}
                        </span>
                      )}
                    </div>
                    {task.status !== 'COMPLETED' && task.status !== 'CANCELLED' && (
                      <div className="mt-3 flex gap-2">
                        {task.status === 'PENDING' && (
                          <button
                            onClick={() => handleStatusChange(task.id, 'IN_PROGRESS')}
                            className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                          >
                            着手する
                          </button>
                        )}
                        <button
                          onClick={() => handleStatusChange(task.id, 'COMPLETED')}
                          className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                        >
                          完了にする
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
