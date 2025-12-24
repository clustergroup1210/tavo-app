import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Bell, Plus, X, Edit2, Trash2, AlertCircle, Info, Megaphone,
  Clock, Building2, Users
} from 'lucide-react';

export default function Announcements() {
  const { user, isCoach, isOperator } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [manageAnnouncements, setManageAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [activeTab, setActiveTab] = useState('view');
  const [form, setForm] = useState({
    title: '',
    content: '',
    priority: 'normal',
    isPublished: true,
    expiresAt: ''
  });

  const currentTeamId = user?.teams?.[0]?.teamId;
  const canManage = isCoach(currentTeamId) || isOperator();

  useEffect(() => {
    fetchAnnouncements();
    if (canManage) {
      fetchManageAnnouncements();
    }
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const res = await fetch('/api/announcements/my', { credentials: 'include' });
      const data = await res.json();
      setAnnouncements(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch announcements:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchManageAnnouncements = async () => {
    try {
      const url = currentTeamId 
        ? `/api/announcements/manage?teamId=${currentTeamId}`
        : '/api/announcements/manage';
      const res = await fetch(url, { credentials: 'include' });
      const data = await res.json();
      setManageAnnouncements(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch manage announcements:', error);
    }
  };

  const openCreateModal = () => {
    setEditingAnnouncement(null);
    setForm({
      title: '',
      content: '',
      priority: 'normal',
      isPublished: true,
      expiresAt: ''
    });
    setShowModal(true);
  };

  const openEditModal = (announcement) => {
    setEditingAnnouncement(announcement);
    setForm({
      title: announcement.title,
      content: announcement.content,
      priority: announcement.priority,
      isPublished: announcement.isPublished,
      expiresAt: announcement.expiresAt ? announcement.expiresAt.split('T')[0] : ''
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    try {
      const payload = {
        teamId: currentTeamId,
        title: form.title,
        content: form.content,
        priority: form.priority,
        isPublished: form.isPublished,
        expiresAt: form.expiresAt || null
      };

      if (editingAnnouncement) {
        await fetch(`/api/announcements/${editingAnnouncement.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        });
      } else {
        await fetch('/api/announcements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        });
      }
      setShowModal(false);
      fetchAnnouncements();
      fetchManageAnnouncements();
    } catch (error) {
      console.error('Failed to save announcement:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('このお知らせを削除しますか？')) return;
    try {
      await fetch(`/api/announcements/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      fetchAnnouncements();
      fetchManageAnnouncements();
    } catch (error) {
      console.error('Failed to delete announcement:', error);
    }
  };

  const priorityConfig = {
    high: { color: 'bg-red-100 text-red-800 border-red-200', icon: AlertCircle, label: '重要' },
    normal: { color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Info, label: '通常' },
    low: { color: 'bg-gray-100 text-gray-800 border-gray-200', icon: Bell, label: '低' }
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' });
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Megaphone className="w-6 h-6 text-primary-600" />
          <h1 className="text-2xl font-bold text-gray-900">お知らせ</h1>
        </div>
        {canManage && (
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus className="w-4 h-4" />
            お知らせを作成
          </button>
        )}
      </div>

      {canManage && (
        <div className="flex gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('view')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              activeTab === 'view' 
                ? 'border-primary-600 text-primary-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            受信したお知らせ
          </button>
          <button
            onClick={() => setActiveTab('manage')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              activeTab === 'manage' 
                ? 'border-primary-600 text-primary-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            配信管理
          </button>
        </div>
      )}

      {activeTab === 'view' ? (
        <div className="space-y-4">
          {announcements.length > 0 ? (
            announcements.map(announcement => {
              const config = priorityConfig[announcement.priority] || priorityConfig.normal;
              const Icon = config.icon;
              return (
                <div key={announcement.id} className={`bg-white rounded-xl shadow-sm border p-6 ${announcement.priority === 'high' ? 'border-red-200' : 'border-gray-200'}`}>
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${config.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 text-xs rounded-full ${config.color}`}>
                          {config.label}
                        </span>
                        <h3 className="font-semibold text-gray-900">{announcement.title}</h3>
                      </div>
                      <p className="text-gray-600 whitespace-pre-wrap">{announcement.content}</p>
                      <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(announcement.createdAt)}
                        </div>
                        {announcement.team && (
                          <div className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {announcement.team.name}
                          </div>
                        )}
                        {announcement.organization && !announcement.team && (
                          <div className="flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {announcement.organization.name}
                          </div>
                        )}
                        {announcement.author && (
                          <span>by {announcement.author.name}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
              <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">お知らせはありません</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {manageAnnouncements.length > 0 ? (
            manageAnnouncements.map(announcement => {
              const config = priorityConfig[announcement.priority] || priorityConfig.normal;
              return (
                <div key={announcement.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 text-xs rounded-full ${config.color}`}>
                          {config.label}
                        </span>
                        {!announcement.isPublished && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-800">
                            下書き
                          </span>
                        )}
                        <h3 className="font-semibold text-gray-900">{announcement.title}</h3>
                      </div>
                      <p className="text-gray-600 text-sm line-clamp-2">{announcement.content}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                        <span>{formatDate(announcement.createdAt)}</span>
                        {announcement.expiresAt && (
                          <span>有効期限: {formatDate(announcement.expiresAt)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEditModal(announcement)} className="p-2 text-gray-400 hover:text-primary-600">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(announcement.id)} className="p-2 text-gray-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
              <Megaphone className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">配信したお知らせはありません</p>
              <button
                onClick={openCreateModal}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                <Plus className="w-4 h-4" />
                最初のお知らせを作成
              </button>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingAnnouncement ? 'お知らせを編集' : '新しいお知らせ'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">タイトル</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="お知らせのタイトル"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">内容</label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  rows={5}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="お知らせの内容"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">重要度</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="high">重要</option>
                  <option value="normal">通常</option>
                  <option value="low">低</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">有効期限（任意）</label>
                <input
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isPublished"
                  checked={form.isPublished}
                  onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
                  className="rounded border-gray-300 text-primary-600"
                />
                <label htmlFor="isPublished" className="text-sm text-gray-700">公開する</label>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!form.title || !form.content}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {editingAnnouncement ? '更新' : '作成'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
