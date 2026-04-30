import React, { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  isPushSupported,
  getPushPermissionState,
  getCurrentSubscription,
  subscribeToPush,
} from '../lib/push';

const dismissKey = (userId) => `push-prompt-dismissed-${userId}`;

const safeGetItem = (key) => {
  try { return localStorage.getItem(key); } catch { return null; }
};
const safeSetItem = (key, value) => {
  try { localStorage.setItem(key, value); } catch {}
};

export default function PostLoginPushPrompt() {
  const { user } = useAuth();
  const userId = user?.id || null;

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [promptUserId, setPromptUserId] = useState(null);

  useEffect(() => {
    setOpen(false);
    setBusy(false);
    setError('');
    setPromptUserId(null);

    if (!userId) return;
    let cancelled = false;
    const evaluatedUserId = userId;

    const check = async () => {
      if (!isPushSupported()) return;
      if (safeGetItem(dismissKey(evaluatedUserId))) return;

      const permission = await getPushPermissionState();

      if (permission === 'denied') return;

      if (permission === 'granted') {
        try {
          await subscribeToPush();
        } catch (e) {
          console.warn('Silent push re-association failed:', e);
        }
        return;
      }

      try {
        const sub = await getCurrentSubscription();
        if (sub) {
          try {
            await subscribeToPush();
          } catch (e) {
            console.warn('Silent push re-association failed:', e);
          }
          return;
        }
      } catch {
        return;
      }

      setTimeout(() => {
        if (cancelled) return;
        setPromptUserId(evaluatedUserId);
        setOpen(true);
      }, 800);
    };

    check();
    return () => { cancelled = true; };
  }, [userId]);

  const handleEnable = async () => {
    if (promptUserId !== userId) {
      setOpen(false);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await subscribeToPush();
      setOpen(false);
    } catch (e) {
      const msg = e?.message || '通知の設定に失敗しました';
      setError(msg);
      if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
        safeSetItem(dismissKey(userId), '1');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDismiss = () => {
    if (promptUserId === userId && userId) {
      safeSetItem(dismissKey(userId), '1');
    }
    setOpen(false);
  };

  if (!open || !userId || promptUserId !== userId) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 sm:p-7 relative">
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
          aria-label="閉じる"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-4">
            <Bell className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            通知を受け取りますか？
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed mb-6">
            新しいお知らせ・コメント・タスクなどがあると、プッシュ通知でお知らせします。重要なやり取りを見逃しません。
          </p>

          {error && (
            <div className="w-full mb-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              {error}
            </div>
          )}

          <button
            onClick={handleEnable}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium rounded-lg transition-colors"
          >
            <Bell className="w-4 h-4" />
            {busy ? '設定中...' : '通知を受け取る'}
          </button>

          <button
            onClick={handleDismiss}
            disabled={busy}
            className="mt-3 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-60"
          >
            後で設定する
          </button>
        </div>
      </div>
    </div>
  );
}
