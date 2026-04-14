import React, { useState, useEffect } from 'react';
import { 
  Bell, Send, Users, CheckCircle, RefreshCw, Search,
  ClipboardCheck, Target, MessageSquare, Calendar, Megaphone, Mail,
  ChevronDown, AlertCircle, Trash2
} from 'lucide-react';
import clsx from 'clsx';

export default function AdminNotificationManagement() {
  const [activeTab, setActiveTab] = useState('broadcast');
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recentNotifications, setRecentNotifications] = useState([]);
  const [stats, setStats] = useState(null);
  const [defaultSettings, setDefaultSettings] = useState({
    defaultNotifyEvaluation: true,
    defaultNotifySelfEvaluation: true,
    defaultNotifyTask: true,
    defaultNotifyComment: true,
    defaultNotifyCalendar: true,
    defaultNotifyAnnouncement: true,
    defaultEnableEmail: true,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [broadcastForm, setBroadcastForm] = useState({
    title: '',
    message: '',
    targetType: 'all',
    targetTeamId: '',
  });
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [teamsRes, statsRes, recentRes, settingsRes] = await Promise.all([
        fetch('/api/admin/teams', { credentials: 'include' }),
        fetch('/api/admin/notification-stats', { credentials: 'include' }),
        fetch('/api/admin/recent-notifications', { credentials: 'include' }),
        fetch('/api/admin/system-settings', { credentials: 'include' }),
      ]);
      if (teamsRes.ok) setTeams(await teamsRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
      if (recentRes.ok) setRecentNotifications(await recentRes.json());
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setDefaultSettings(prev => ({ ...prev, ...data }));
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendBroadcast = async () => {
    if (!broadcastForm.title.trim() || !broadcastForm.message.trim()) {
      alert('タイトルとメッセージを入力してください');
      return;
    }
    if (!confirm('通知を送信しますか？')) return;
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch('/api/admin/broadcast-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(broadcastForm),
      });
      const data = await res.json();
      if (res.ok) {
        setSendResult({ type: 'success', message: `${data.count}人に通知を送信しました` });
        setBroadcastForm({ title: '', message: '', targetType: 'all', targetTeamId: '' });
        fetchData();
      } else {
        setSendResult({ type: 'error', message: data.error || '送信に失敗しました' });
      }
    } catch (error) {
      setSendResult({ type: 'error', message: '送信に失敗しました' });
    } finally {
      setSending(false);
    }
  };

  const handleSaveDefaults = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/system-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(defaultSettings),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (error) {
      console.error('Failed to save defaults:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNotification = async (id) => {
    if (!confirm('この通知を削除しますか？')) return;
    try {
      await fetch(`/api/admin/notifications/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      fetchData();
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const tabs = [
    { id: 'broadcast', label: '一斉通知', icon: Send },
    { id: 'defaults', label: 'デフォルト設定', icon: Bell },
    { id: 'history', label: '通知履歴', icon: ClipboardCheck },
  ];

  const settingItems = [
    { key: 'defaultNotifyEvaluation', label: '指導者からの評価', icon: ClipboardCheck, color: 'text-blue-600 bg-blue-100' },
    { key: 'defaultNotifySelfEvaluation', label: '自己評価の提出', icon: ClipboardCheck, color: 'text-green-600 bg-green-100' },
    { key: 'defaultNotifyTask', label: '課題の設定', icon: Target, color: 'text-orange-600 bg-orange-100' },
    { key: 'defaultNotifyComment', label: '動画コメント', icon: MessageSquare, color: 'text-purple-600 bg-purple-100' },
    { key: 'defaultNotifyCalendar', label: 'カレンダー更新', icon: Calendar, color: 'text-teal-600 bg-teal-100' },
    { key: 'defaultNotifyAnnouncement', label: 'お知らせ', icon: Megaphone, color: 'text-red-600 bg-red-100' },
    { key: 'defaultEnableEmail', label: 'メール通知', icon: Mail, color: 'text-gray-600 bg-gray-100' },
  ];

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
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
        <h1 className="text-2xl font-bold text-gray-900">通知管理</h1>
        <p className="mt-1 text-sm text-gray-500">一斉通知の送信やデフォルト通知設定を管理します</p>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-50">
              <Bell className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">総通知数</p>
              <p className="text-xl font-bold text-gray-900">{stats.totalNotifications?.toLocaleString() || 0}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-green-50">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">既読率</p>
              <p className="text-xl font-bold text-gray-900">{stats.readRate || 0}%</p>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-purple-50">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">通知設定済みユーザー</p>
              <p className="text-xl font-bold text-gray-900">{stats.usersWithSettings || 0}</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2 border-b border-gray-200">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition',
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'broadcast' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Send className="w-4 h-4 text-primary-600" />
              一斉通知を送信
            </h2>
            <p className="text-sm text-gray-500 mt-1">全ユーザーまたは特定のチームに通知を送信します</p>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">送信対象</label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="targetType"
                    value="all"
                    checked={broadcastForm.targetType === 'all'}
                    onChange={() => setBroadcastForm(prev => ({ ...prev, targetType: 'all', targetTeamId: '' }))}
                    className="text-primary-600"
                  />
                  <span className="text-sm text-gray-700">全ユーザー</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="targetType"
                    value="team"
                    checked={broadcastForm.targetType === 'team'}
                    onChange={() => setBroadcastForm(prev => ({ ...prev, targetType: 'team' }))}
                    className="text-primary-600"
                  />
                  <span className="text-sm text-gray-700">特定チーム</span>
                </label>
              </div>
              {broadcastForm.targetType === 'team' && (
                <select
                  value={broadcastForm.targetTeamId}
                  onChange={(e) => setBroadcastForm(prev => ({ ...prev, targetTeamId: e.target.value }))}
                  className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  required
                >
                  <option value="">チームを選択</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">タイトル</label>
              <input
                type="text"
                value={broadcastForm.title}
                onChange={(e) => setBroadcastForm(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="通知タイトル"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">メッセージ</label>
              <textarea
                value={broadcastForm.message}
                onChange={(e) => setBroadcastForm(prev => ({ ...prev, message: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                rows={4}
                placeholder="通知メッセージ"
              />
            </div>

            {sendResult && (
              <div className={clsx(
                'flex items-center gap-2 p-3 rounded-lg text-sm',
                sendResult.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              )}>
                {sendResult.type === 'success' ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
                {sendResult.message}
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={handleSendBroadcast}
                disabled={sending || !broadcastForm.title.trim() || !broadcastForm.message.trim()}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
              >
                {sending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {sending ? '送信中...' : '通知を送信'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'defaults' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary-600" />
                新規ユーザーのデフォルト通知設定
              </h2>
              <p className="text-sm text-gray-500 mt-1">新しく登録されるユーザーに適用される初期設定</p>
            </div>
            <div className="divide-y divide-gray-100">
              {settingItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.key} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={clsx('w-10 h-10 rounded-full flex items-center justify-center', item.color)}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <p className="font-medium text-gray-900">{item.label}</p>
                    </div>
                    <button
                      onClick={() => setDefaultSettings(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                      className={clsx(
                        'relative w-12 h-6 rounded-full transition-colors',
                        defaultSettings[item.key] ? 'bg-primary-600' : 'bg-gray-300'
                      )}
                    >
                      <span className={clsx(
                        'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow',
                        defaultSettings[item.key] ? 'left-7' : 'left-1'
                      )} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              {saved && (
                <span className="text-sm text-green-600 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  保存しました
                </span>
              )}
            </div>
            <button
              onClick={handleSaveDefaults}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {saving ? '保存中...' : 'デフォルト設定を保存'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">最近の一斉通知</h2>
          </div>
          {recentNotifications.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Bell className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p>一斉通知の履歴がありません</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentNotifications.map((notification) => (
                <div key={notification.id} className="px-6 py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-gray-900">{notification.title}</p>
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                          {notification.targetType === 'all' ? '全体' : notification.targetTeamName || 'チーム'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">{notification.message}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                        <span>{formatDate(notification.createdAt)}</span>
                        <span>{notification.recipientCount}人に送信</span>
                        <span>送信者: {notification.senderName}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteNotification(notification.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded hover:bg-red-50 transition ml-3"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
