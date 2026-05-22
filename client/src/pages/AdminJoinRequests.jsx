import React, { useEffect, useState } from 'react';
import { UserPlus, Check, X, Clock, CheckCircle, XCircle, Mail, Phone, AlertTriangle } from 'lucide-react';

export default function AdminJoinRequests() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [onlyNoManager, setOnlyNoManager] = useState(false);
  const [processing, setProcessing] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.append('status', filter);
      const res = await fetch(`/api/join-requests?${params}`, { credentials: 'include' });
      if (res.ok) setRows(await res.json());
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filter]);

  const approve = async (id) => {
    if (!confirm('この申請を承認しますか？')) return;
    setProcessing(id);
    try {
      const res = await fetch(`/api/join-requests/${id}/approve`, { method: 'PUT', credentials: 'include' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || '承認に失敗しました');
      }
      load();
    } finally { setProcessing(null); }
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    const id = rejectTarget.id;
    setProcessing(id);
    try {
      const res = await fetch(`/api/join-requests/${id}/reject`, { method: 'PUT', credentials: 'include' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || '却下に失敗しました');
      }
      load();
    } finally {
      setProcessing(null);
      setRejectTarget(null);
    }
  };

  const visible = onlyNoManager ? rows.filter(r => r.hasTeamManager === false) : rows;

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
        <h1 className="text-2xl font-bold text-gray-900">参加申請（全チーム）</h1>
        <p className="mt-1 text-sm text-gray-500">全チームへの参加申請を確認できます。チーム管理者不在のチームは「管理者なし」バッジ付きで表示され、システム管理者のみ承認できます。</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-lg font-semibold text-gray-900">申請一覧</h2>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={onlyNoManager} onChange={(e) => setOnlyNoManager(e.target.checked)} />
              管理者不在のみ
            </label>
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="pending">審査中</option>
              <option value="approved">承認済み</option>
              <option value="rejected">却下</option>
              <option value="all">すべて</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-500">読み込み中...</div>
        ) : visible.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <UserPlus className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p>申請はありません</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {visible.map(r => {
              const b = statusBadge(r.status);
              return (
                <li key={r.id} className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900">{r.playerName}</h3>
                        <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${r.requestType === 'STAFF' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                          {r.requestType === 'STAFF' ? 'スタッフ' : '選手'}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${b.color}`}>
                          <b.Icon className="w-3 h-3" />{b.label}
                        </span>
                        {r.hasTeamManager === false && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-orange-100 text-orange-700">
                            <AlertTriangle className="w-3 h-3" />管理者なし
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-sm text-gray-700">
                        参加先: <span className="font-medium">{r.team?.name}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
                        <span>{r.user?.name}</span>
                        <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{r.user?.email}</span>
                        {r.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{r.phone}</span>}
                      </div>
                      {r.message && <p className="mt-2 text-xs text-gray-500 italic">「{r.message}」</p>}
                      <p className="mt-2 text-xs text-gray-400">{new Date(r.createdAt).toLocaleString('ja-JP')}</p>
                    </div>
                    {r.status === 'pending' && (
                      <div className="flex items-center gap-2">
                        <button onClick={() => approve(r.id)} disabled={processing === r.id}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-green-700 bg-green-50 hover:bg-green-100 rounded-lg disabled:opacity-50">
                          <Check className="w-4 h-4" />承認
                        </button>
                        <button onClick={() => setRejectTarget(r)} disabled={processing === r.id}
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

      {rejectTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => processing !== rejectTarget.id && setRejectTarget(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-semibold text-gray-900">この申請を却下しますか？</h3>
                <p className="mt-1 text-sm text-gray-600">
                  <span className="font-medium text-gray-900">{rejectTarget.playerName}</span>
                  （{rejectTarget.requestType === 'STAFF' ? 'スタッフ' : '選手'}） — 参加先: <span className="font-medium">{rejectTarget.team?.name}</span> の申請を却下します。この操作は元に戻せません。
                </p>
                {rejectTarget.user?.email && (
                  <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                    <Mail className="w-3 h-3" />{rejectTarget.user.email}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => setRejectTarget(null)}
                disabled={processing === rejectTarget.id}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                onClick={confirmReject}
                disabled={processing === rejectTarget.id}
                className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
              >
                {processing === rejectTarget.id ? '却下中...' : '却下する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
