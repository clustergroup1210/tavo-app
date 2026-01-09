import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UserPlus, Check, X, Clock, CheckCircle, XCircle, Mail } from 'lucide-react';

export default function JoinRequests() {
  const { currentTeam } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [processing, setProcessing] = useState(null);

  useEffect(() => {
    if (currentTeam?.id) {
      fetchRequests();
    }
  }, [currentTeam?.id, filter]);

  const fetchRequests = async () => {
    try {
      const params = new URLSearchParams({ teamId: currentTeam.id });
      if (filter !== 'all') {
        params.append('status', filter);
      }
      const res = await fetch(`/api/join-requests?${params}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } catch (error) {
      console.error('Failed to fetch join requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    if (!confirm('この申請を承認しますか？選手としてチームに追加されます。')) return;
    
    setProcessing(id);
    try {
      const res = await fetch(`/api/join-requests/${id}/approve`, {
        method: 'PUT',
        credentials: 'include'
      });
      if (res.ok) {
        fetchRequests();
      }
    } catch (error) {
      console.error('Failed to approve request:', error);
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (id) => {
    if (!confirm('この申請を却下しますか？')) return;
    
    setProcessing(id);
    try {
      const res = await fetch(`/api/join-requests/${id}/reject`, {
        method: 'PUT',
        credentials: 'include'
      });
      if (res.ok) {
        fetchRequests();
      }
    } catch (error) {
      console.error('Failed to reject request:', error);
    } finally {
      setProcessing(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return { label: '審査中', color: 'bg-yellow-100 text-yellow-700', icon: Clock };
      case 'approved':
        return { label: '承認済み', color: 'bg-green-100 text-green-700', icon: CheckCircle };
      case 'rejected':
        return { label: '却下', color: 'bg-red-100 text-red-700', icon: XCircle };
      default:
        return { label: status, color: 'bg-gray-100 text-gray-600', icon: Clock };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">参加申請</h1>
          <p className="mt-1 text-sm text-gray-500">チームへの参加申請を管理</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">申請一覧</h2>
            <div className="flex items-center gap-2">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="pending">審査中</option>
                <option value="approved">承認済み</option>
                <option value="rejected">却下</option>
                <option value="all">すべて</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  申請者
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  選手名
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  メッセージ
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ステータス
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  申請日
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {requests.length > 0 ? (
                requests.map((request) => {
                  const statusBadge = getStatusBadge(request.status);
                  const StatusIcon = statusBadge.icon;
                  return (
                    <tr key={request.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                            <span className="text-sm font-medium text-primary-700">
                              {request.user?.name?.charAt(0) || 'U'}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{request.user?.name}</p>
                            <div className="flex items-center gap-1 text-sm text-gray-500">
                              <Mail className="w-3 h-3" />
                              {request.user?.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {request.playerName}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                        {request.message || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full ${statusBadge.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusBadge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(request.createdAt).toLocaleDateString('ja-JP')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {request.status === 'pending' && (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleApprove(request.id)}
                              disabled={processing === request.id}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg disabled:opacity-50"
                              title="承認"
                            >
                              <Check className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleReject(request.id)}
                              disabled={processing === request.id}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                              title="却下"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                        )}
                        {request.status !== 'pending' && request.reviewer && (
                          <span className="text-xs text-gray-500">
                            {request.reviewer.name}が{request.status === 'approved' ? '承認' : '却下'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <UserPlus className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                    <p>{filter === 'pending' ? '審査中の申請はありません' : '申請が見つかりません'}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
