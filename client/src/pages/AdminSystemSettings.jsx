import React, { useState, useEffect } from 'react';
import { 
  Settings, Save, Shield, Database, Upload, Clock, Users, 
  AlertTriangle, CheckCircle, RefreshCw, HardDrive, FileText
} from 'lucide-react';
import clsx from 'clsx';

const defaultSettings = {
  maxVideoSizeMB: 100,
  maxPlayerPhotoSizeMB: 5,
  defaultEvaluationMaxScore: 5,
  sessionTimeoutMinutes: 1440,
  maintenanceMode: false,
  maintenanceMessage: '',
  allowSelfRegistration: true,
  requireApprovalForJoinRequests: true,
  defaultNotifyEvaluation: true,
  defaultNotifyTask: true,
  defaultNotifyComment: true,
  defaultNotifyCalendar: true,
  defaultNotifyAnnouncement: true,
  defaultEnableEmail: true,
};

export default function AdminSystemSettings() {
  const [settings, setSettings] = useState(defaultSettings);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [settingsRes, statsRes] = await Promise.all([
        fetch('/api/admin/system-settings', { credentials: 'include' }),
        fetch('/api/admin/system-stats', { credentials: 'include' }),
      ]);
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setSettings(prev => ({ ...prev, ...data }));
      }
      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/system-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const tabs = [
    { id: 'general', label: '一般設定', icon: Settings },
    { id: 'limits', label: '制限設定', icon: HardDrive },
    { id: 'registration', label: '登録・参加', icon: Users },
    { id: 'system', label: 'システム情報', icon: Database },
  ];

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
        <div>
          <h1 className="text-2xl font-bold text-gray-900">システム設定</h1>
          <p className="mt-1 text-sm text-gray-500">システム全体の動作設定を管理します</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
        >
          {saving ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? '保存中...' : saved ? '保存しました' : '設定を保存'}
        </button>
      </div>

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

      {activeTab === 'general' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                メンテナンスモード
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">メンテナンスモード</p>
                  <p className="text-sm text-gray-500">有効にすると管理者以外のログインが制限されます</p>
                </div>
                <button
                  onClick={() => handleChange('maintenanceMode', !settings.maintenanceMode)}
                  className={clsx(
                    'relative w-12 h-6 rounded-full transition-colors',
                    settings.maintenanceMode ? 'bg-amber-500' : 'bg-gray-300'
                  )}
                >
                  <span className={clsx(
                    'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow',
                    settings.maintenanceMode ? 'left-7' : 'left-1'
                  )} />
                </button>
              </div>
              {settings.maintenanceMode && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">メンテナンスメッセージ</label>
                  <textarea
                    value={settings.maintenanceMessage}
                    onChange={(e) => handleChange('maintenanceMessage', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    rows={3}
                    placeholder="メンテナンス中のメッセージを入力してください"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                セッション設定
              </h2>
            </div>
            <div className="p-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">セッションタイムアウト（分）</label>
                <input
                  type="number"
                  value={settings.sessionTimeoutMinutes}
                  onChange={(e) => handleChange('sessionTimeoutMinutes', parseInt(e.target.value) || 60)}
                  min={30}
                  max={43200}
                  className="w-48 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {Math.floor(settings.sessionTimeoutMinutes / 60)}時間{settings.sessionTimeoutMinutes % 60}分後にセッションが切れます
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-green-500" />
                評価設定
              </h2>
            </div>
            <div className="p-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">評価項目のデフォルト最大スコア</label>
                <input
                  type="number"
                  value={settings.defaultEvaluationMaxScore}
                  onChange={(e) => handleChange('defaultEvaluationMaxScore', parseInt(e.target.value) || 5)}
                  min={1}
                  max={10}
                  className="w-48 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <p className="text-xs text-gray-500 mt-1">新しい評価項目作成時のデフォルト値</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'limits' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Upload className="w-4 h-4 text-blue-500" />
                アップロード制限
              </h2>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">動画の最大サイズ（MB）</label>
                <input
                  type="number"
                  value={settings.maxVideoSizeMB}
                  onChange={(e) => handleChange('maxVideoSizeMB', parseInt(e.target.value) || 100)}
                  min={10}
                  max={500}
                  className="w-48 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <p className="text-xs text-gray-500 mt-1">動画アップロード時の最大ファイルサイズ</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">選手写真の最大サイズ（MB）</label>
                <input
                  type="number"
                  value={settings.maxPlayerPhotoSizeMB}
                  onChange={(e) => handleChange('maxPlayerPhotoSizeMB', parseInt(e.target.value) || 5)}
                  min={1}
                  max={20}
                  className="w-48 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <p className="text-xs text-gray-500 mt-1">プロフィール写真の最大ファイルサイズ</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'registration' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-500" />
                ユーザー登録
              </h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">セルフ登録</p>
                  <p className="text-sm text-gray-500">ユーザーが招待なしでアカウントを作成できるようにする</p>
                </div>
                <button
                  onClick={() => handleChange('allowSelfRegistration', !settings.allowSelfRegistration)}
                  className={clsx(
                    'relative w-12 h-6 rounded-full transition-colors',
                    settings.allowSelfRegistration ? 'bg-primary-600' : 'bg-gray-300'
                  )}
                >
                  <span className={clsx(
                    'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow',
                    settings.allowSelfRegistration ? 'left-7' : 'left-1'
                  )} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">参加リクエストの承認</p>
                  <p className="text-sm text-gray-500">選手がチームに参加する際に管理者の承認を必要とする</p>
                </div>
                <button
                  onClick={() => handleChange('requireApprovalForJoinRequests', !settings.requireApprovalForJoinRequests)}
                  className={clsx(
                    'relative w-12 h-6 rounded-full transition-colors',
                    settings.requireApprovalForJoinRequests ? 'bg-primary-600' : 'bg-gray-300'
                  )}
                >
                  <span className={clsx(
                    'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow',
                    settings.requireApprovalForJoinRequests ? 'left-7' : 'left-1'
                  )} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'system' && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'チーム数', value: stats.totalTeams, icon: Shield, color: 'bg-blue-50 text-blue-600' },
              { label: 'ユーザー数', value: stats.totalUsers, icon: Users, color: 'bg-green-50 text-green-600' },
              { label: '選手数', value: stats.totalPlayers, icon: Users, color: 'bg-purple-50 text-purple-600' },
              { label: '評価数', value: stats.totalEvaluations, icon: FileText, color: 'bg-orange-50 text-orange-600' },
            ].map((item, idx) => {
              const Icon = item.icon;
              return (
                <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center gap-3">
                    <div className={clsx('p-2.5 rounded-lg', item.color)}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">{item.label}</p>
                      <p className="text-xl font-bold text-gray-900">{item.value?.toLocaleString() || 0}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Database className="w-4 h-4 text-gray-500" />
                データ詳細
              </h2>
            </div>
            <div className="divide-y divide-gray-100">
              {[
                { label: '動画数', value: stats.totalVideos },
                { label: '通知数', value: stats.totalNotifications },
                { label: 'お知らせ数', value: stats.totalAnnouncements },
                { label: 'カレンダーイベント数', value: stats.totalCalendarEvents },
                { label: '目標数', value: stats.totalGoals },
                { label: '課題数', value: stats.totalTasks },
              ].map((item, idx) => (
                <div key={idx} className="px-6 py-3 flex items-center justify-between">
                  <span className="text-sm text-gray-600">{item.label}</span>
                  <span className="text-sm font-semibold text-gray-900">{item.value?.toLocaleString() || 0}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
