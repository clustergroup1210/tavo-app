import React, { useState, useEffect } from 'react';
import { Bell, Mail, ClipboardCheck, Target, MessageSquare, Calendar, Megaphone, Save, ArrowLeft, Smartphone, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import {
  isPushSupported,
  getPushPermissionState,
  getCurrentSubscription,
  subscribeToPush,
  unsubscribeFromPush,
  sendTestPush
} from '../lib/push';

const settingItems = [
  {
    key: 'notifyEvaluation',
    label: '指導者からの評価',
    description: '指導者があなたの評価を行った時に通知',
    icon: ClipboardCheck,
    color: 'text-blue-600 bg-blue-100'
  },
  {
    key: 'notifySelfEvaluation',
    label: '自己評価の提出',
    description: '選手が自己評価を提出した時に通知（指導者向け）',
    icon: ClipboardCheck,
    color: 'text-green-600 bg-green-100'
  },
  {
    key: 'notifyTask',
    label: '課題の設定',
    description: 'コーチが課題を設定した時に通知',
    icon: Target,
    color: 'text-orange-600 bg-orange-100'
  },
  {
    key: 'notifyComment',
    label: '動画コメント',
    description: '動画にコメントがついた時に通知',
    icon: MessageSquare,
    color: 'text-purple-600 bg-purple-100'
  },
  {
    key: 'notifyCalendar',
    label: 'カレンダー更新',
    description: 'カレンダーに予定が追加・更新された時に通知',
    icon: Calendar,
    color: 'text-teal-600 bg-teal-100'
  },
  {
    key: 'notifyAnnouncement',
    label: 'お知らせ',
    description: '新しいお知らせが配信された時に通知',
    icon: Megaphone,
    color: 'text-red-600 bg-red-100'
  }
];

export default function NotificationSettings() {
  const [settings, setSettings] = useState({
    notifyEvaluation: true,
    notifySelfEvaluation: true,
    notifyTask: true,
    notifyComment: true,
    notifyCalendar: true,
    notifyAnnouncement: true,
    enableEmail: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState('default');
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState('');
  const [pushInfo, setPushInfo] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchSettings();
    refreshPushState();
  }, []);

  const refreshPushState = async () => {
    const supported = isPushSupported();
    setPushSupported(supported);
    if (!supported) return;
    setPushPermission(await getPushPermissionState());
    const sub = await getCurrentSubscription();
    setPushSubscribed(!!sub);
  };

  const handleEnablePush = async () => {
    setPushBusy(true);
    setPushError('');
    setPushInfo('');
    try {
      await subscribeToPush();
      setPushInfo('プッシュ通知を有効にしました');
    } catch (e) {
      setPushError(e.message || '有効化に失敗しました');
    } finally {
      await refreshPushState();
      setPushBusy(false);
    }
  };

  const handleDisablePush = async () => {
    setPushBusy(true);
    setPushError('');
    setPushInfo('');
    try {
      await unsubscribeFromPush();
      setPushInfo('プッシュ通知を無効にしました');
    } catch (e) {
      setPushError(e.message || '無効化に失敗しました');
    } finally {
      await refreshPushState();
      setPushBusy(false);
    }
  };

  const handleTestPush = async () => {
    setPushBusy(true);
    setPushError('');
    setPushInfo('');
    try {
      const res = await sendTestPush();
      if (res.sent > 0) {
        setPushInfo(`テスト通知を ${res.sent} 件送信しました`);
      } else {
        setPushError('送信先がありません。先にプッシュ通知を有効にしてください');
      }
    } catch (e) {
      setPushError(e.message || 'テスト通知に失敗しました');
    } finally {
      setPushBusy(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/notifications/settings', {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (key) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/notifications/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(settings)
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">通知設定</h1>
          <p className="text-sm text-gray-500 mt-1">
            通知の受け取り方法を設定します
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
              <Bell className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Web通知</h2>
              <p className="text-sm text-gray-500">アプリ内で通知を受け取る項目を選択</p>
            </div>
          </div>
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
                  <div>
                    <p className="font-medium text-gray-900">{item.label}</p>
                    <p className="text-sm text-gray-500">{item.description}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleToggle(item.key)}
                  className={clsx(
                    'relative w-12 h-6 rounded-full transition-colors',
                    settings[item.key] ? 'bg-primary-600' : 'bg-gray-300'
                  )}
                >
                  <span
                    className={clsx(
                      'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow',
                      settings[item.key] ? 'left-7' : 'left-1'
                    )}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">プッシュ通知（ブラウザ）</p>
                <p className="text-sm text-gray-500">
                  ブラウザを閉じていてもデスクトップ・モバイルに通知を表示
                </p>
              </div>
            </div>
            {pushSupported ? (
              pushSubscribed ? (
                <button
                  onClick={handleDisablePush}
                  disabled={pushBusy}
                  className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 whitespace-nowrap"
                >
                  無効にする
                </button>
              ) : (
                <button
                  onClick={handleEnablePush}
                  disabled={pushBusy || pushPermission === 'denied'}
                  className="px-3 py-1.5 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap"
                >
                  有効にする
                </button>
              )
            ) : (
              <span className="text-xs text-gray-500">非対応のブラウザです</span>
            )}
          </div>
          {pushSupported && pushPermission === 'denied' && (
            <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
              ブラウザの通知許可がブロックされています。アドレスバーの設定から「通知」を許可してください。
            </p>
          )}
          {pushSupported && pushSubscribed && (
            <div className="mt-3">
              <button
                onClick={handleTestPush}
                disabled={pushBusy}
                className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                テスト通知を送る
              </button>
            </div>
          )}
          {pushError && <p className="mt-2 text-sm text-red-600">{pushError}</p>}
          {pushInfo && <p className="mt-2 text-sm text-green-600">{pushInfo}</p>}
        </div>
      </div>

      <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
              <Mail className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">メール通知</p>
              <p className="text-sm text-gray-500">登録メールアドレスに通知を送信</p>
            </div>
          </div>
          <button
            onClick={() => handleToggle('enableEmail')}
            className={clsx(
              'relative w-12 h-6 rounded-full transition-colors',
              settings.enableEmail ? 'bg-primary-600' : 'bg-gray-300'
            )}
          >
            <span
              className={clsx(
                'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow',
                settings.enableEmail ? 'left-7' : 'left-1'
              )}
            />
          </button>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div>
          {saved && (
            <span className="text-sm text-green-600 flex items-center gap-1">
              <Save className="w-4 h-4" />
              設定を保存しました
            </span>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              保存中...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              設定を保存
            </>
          )}
        </button>
      </div>
    </div>
  );
}
