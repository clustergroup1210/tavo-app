function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export async function ensureServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg =
      (await navigator.serviceWorker.getRegistration('/')) ||
      (await navigator.serviceWorker.register('/service-worker.js'));
    await navigator.serviceWorker.ready;
    return reg;
  } catch (e) {
    console.error('SW registration failed', e);
    return null;
  }
}

export async function getPushPermissionState() {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

export async function getCurrentSubscription() {
  const reg = await ensureServiceWorker();
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

export async function subscribeToPush() {
  if (!isPushSupported()) throw new Error('このブラウザは通知に対応していません');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('通知の許可が得られませんでした');
  }

  const reg = await ensureServiceWorker();
  if (!reg) throw new Error('Service Workerの登録に失敗しました');

  const keyRes = await fetch('/api/push/vapid-public-key', { credentials: 'include' });
  if (!keyRes.ok) throw new Error('プッシュ通知が設定されていません');
  const { publicKey } = await keyRes.json();

  let sub = await reg.pushManager.getSubscription();
  let createdNew = false;
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });
    createdNew = true;
  }

  try {
    const json = sub.toJSON();
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys })
    });
    if (!res.ok) {
      let msg = '購読の登録に失敗しました';
      try { const j = await res.json(); if (j?.error) msg = j.error; } catch {}
      throw new Error(msg);
    }
    return sub;
  } catch (e) {
    if (createdNew) {
      try { await sub.unsubscribe(); } catch {}
    }
    throw e;
  }
}

export async function unsubscribeFromPush() {
  const sub = await getCurrentSubscription();
  if (!sub) return true;
  const endpoint = sub.endpoint;

  const res = await fetch('/api/push/unsubscribe', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint })
  });
  if (!res.ok) {
    let msg = '購読の解除に失敗しました';
    try { const j = await res.json(); if (j?.error) msg = j.error; } catch {}
    throw new Error(msg);
  }

  try {
    await sub.unsubscribe();
  } catch (e) {}
  return true;
}

export async function sendTestPush() {
  const res = await fetch('/api/push/test', {
    method: 'POST',
    credentials: 'include'
  });
  if (!res.ok) throw new Error('テスト通知の送信に失敗しました');
  return res.json();
}
