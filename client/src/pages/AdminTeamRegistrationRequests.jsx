import React, { useEffect, useState } from 'react';
import { Building2, Check, X, Clock, CheckCircle, XCircle, Mail, Phone } from 'lucide-react';

export default function AdminTeamRegistrationRequests() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [processing, setProcessing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.append('status', filter);
      const res = await fetch(`/api/team-registration-requests?${params}`, { credentials: 'include' });
      if (res.ok) setRows(await res.json());
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filter]);

  const approve = async (id) => {
    if (!confirm('この申請を承認しますか？\nチームと代表者アカウントが作成されます。')) return;
    setProcessing(id);
    try {
      let res = await fetch(`/api/team-registration-requests/${id}/approve`, {
        method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}'
      });
      if (res.status === 409) {
        const d = await res.json().catch(() => ({}));
        if (d.error === 'EXISTING_USER_CONFIRMATION_REQUIRED') {
          if (!confirm(d.message + '\n\nOK = 既存ユーザーをTEAM_MANAGERに紐付けて承認 / キャンセル = 承認中止')) {
            return;
          }
          res = await fetch(`/api/team-registration-requests/${id}/approve`, {
            method: 'PUT', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ confirmReuseExistingUser: true })
          });
        }
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || '承認に失敗しました');
      }
      load();
    } finally { setProcessing(null); }
  };

  const reject = async (id) => {
    const reason = prompt('却下理由（任意）');
    if (reason === null) return;
    setProcessing(id);
    try {
      const res = await fetch(`/api/team-registration-requests/${id}/reject`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || '却下に失敗しました');
      }
      load();
    } finally { setProcessing(null); }
  };

  const statusBadge = (s) => {
    switch (s) {
      case 'pending': return { label: '審査中', color: 'bg-yellow-100 text-yellow-700', Icon: Clock };
      case 'approved': return { label: '承認済み', color: 'bg-green-100 text-green-700', Icon: CheckCircle };
      case 'rejected': return { label: '却下', color: 'bg-red-100 text-red-700', Icon: XCircle };
      default: return { label: s, color: 'bg-gray-100 text-gray-600', Icon: Clock };
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">チーム新規登録申請</h1>
        <p className="mt-1 text-sm text-gray-500">外部からのチーム新規登録申請を承認・却下します。</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">申請一覧</h2>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="pending">審査中</option>
            <option value="approved">承認済み</option>
            <option value="rejected">却下</option>
            <option value="all">すべて</option>
          </select>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-500">読み込み中...</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Building2 className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p>申請はありません</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {rows.map(r => {
              const b = statusBadge(r.status);
              return (
                <li key={r.id} className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900">{r.desiredTeamName}</h3>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${b.color}`}>
                          <b.Icon className="w-3 h-3" />{b.label}
                        </span>
                        {(r.region || r.league) && (
                          <span className="text-xs text-gray-500">{[r.region, r.league].filter(Boolean).join(' / ')}</span>
                        )}
                      </div>
                      <div className="mt-2 text-sm text-gray-700">
                        <span className="font-medium">{r.requesterName}</span>
                        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
                          <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{r.requesterEmail}</span>
                          <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{r.requesterPhone}</span>
                        </div>
                      </div>
                      {r.existingUser && r.status === 'pending' && (
                        <p className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded bg-amber-100 text-amber-800">
                          ⚠ 既存ユーザー紐付け候補: {r.existingUser.name}（{r.existingUser.email}）
                        </p>
                      )}
                      {r.description && <p className="mt-2 text-xs text-gray-600">{r.description}</p>}
                      {r.message && <p className="mt-2 text-xs text-gray-500 italic">「{r.message}」</p>}
                      <p className="mt-2 text-xs text-gray-400">申請日: {new Date(r.createdAt).toLocaleString('ja-JP')}</p>
                      {r.status !== 'pending' && r.reviewer && (
                        <p className="mt-1 text-xs text-gray-500">{r.reviewer.name}が{r.status === 'approved' ? '承認' : '却下'} ({r.reviewedAt && new Date(r.reviewedAt).toLocaleString('ja-JP')})</p>
                      )}
                      {r.rejectionReason && <p className="mt-1 text-xs text-red-600">却下理由: {r.rejectionReason}</p>}
                    </div>
                    {r.status === 'pending' && (
                      <div className="flex items-center gap-2">
                        <button onClick={() => approve(r.id)} disabled={processing === r.id}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-green-700 bg-green-50 hover:bg-green-100 rounded-lg disabled:opacity-50">
                          <Check className="w-4 h-4" />承認
                        </button>
                        <button onClick={() => reject(r.id)} disabled={processing === r.id}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-700 bg-red-50 hover:bg-red-100 rounded-lg disabled:opacity-50">
                          <X className="w-4 h-4" />却下
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
