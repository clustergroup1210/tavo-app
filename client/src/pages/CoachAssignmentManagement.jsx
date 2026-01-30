import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Users, UserCircle, Check, X, Shield, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

export default function CoachAssignmentManagement() {
  const { currentTeam } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState(null);
  const [selectedCoach, setSelectedCoach] = useState(null);
  const [assignedPlayerIds, setAssignedPlayerIds] = useState(new Set());
  const [headCoachId, setHeadCoachId] = useState(null);
  const [expandedCoach, setExpandedCoach] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (currentTeam) {
      fetchAssignments();
    }
  }, [currentTeam]);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/coach-assignments/${currentTeam.id}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const result = await res.json();
        setData(result);
        setHeadCoachId(result.team?.headCoachId || null);
      }
    } catch (error) {
      console.error('Failed to fetch assignments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSetHeadCoach = async (userId) => {
    try {
      setSaving(true);
      setError('');
      const res = await fetch(`/api/teams/${currentTeam.id}/head-coach`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        setHeadCoachId(userId);
        setSuccess('代表監督を設定しました');
        setTimeout(() => setSuccess(''), 3000);
        fetchAssignments();
      } else {
        const data = await res.json();
        setError(data.error || '設定に失敗しました');
      }
    } catch (error) {
      setError('設定に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveHeadCoach = async () => {
    if (!confirm('代表監督の設定を解除しますか？')) return;
    try {
      setSaving(true);
      setError('');
      const res = await fetch(`/api/teams/${currentTeam.id}/head-coach`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setHeadCoachId(null);
        setSuccess('代表監督を解除しました');
        setTimeout(() => setSuccess(''), 3000);
        fetchAssignments();
      }
    } catch (error) {
      setError('解除に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectCoach = (coach) => {
    setSelectedCoach(coach);
    const assignments = data.assignments.filter(a => a.coachId === coach.id);
    setAssignedPlayerIds(new Set(assignments.map(a => a.playerId)));
    setExpandedCoach(coach.id);
  };

  const handlePlayerToggle = (playerId) => {
    const newSet = new Set(assignedPlayerIds);
    if (newSet.has(playerId)) {
      newSet.delete(playerId);
    } else {
      newSet.add(playerId);
    }
    setAssignedPlayerIds(newSet);
  };

  const handleSaveAssignments = async () => {
    if (!selectedCoach) return;
    try {
      setSaving(true);
      setError('');

      await fetch(`/api/coach-assignments/coach/${selectedCoach.id}/team/${currentTeam.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (assignedPlayerIds.size > 0) {
        const res = await fetch('/api/coach-assignments/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            coachId: selectedCoach.id,
            playerIds: Array.from(assignedPlayerIds),
            teamId: currentTeam.id,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error);
        }
      }

      setSuccess('担当選手を更新しました');
      setTimeout(() => setSuccess(''), 3000);
      fetchAssignments();
    } catch (error) {
      setError(error.message || '更新に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const getCoachAssignmentCount = (coachId) => {
    return data?.assignments.filter(a => a.coachId === coachId).length || 0;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-gray-500">
        データの読み込みに失敗しました
      </div>
    );
  }

  const allStaff = [
    ...(data.team?.headCoach ? [{ ...data.team.headCoach, isHeadCoach: true }] : []),
    ...data.coaches.filter(c => c.id !== data.team?.headCoachId)
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">指導者体制</h1>
        <p className="mt-1 text-sm text-gray-500">
          代表監督の設定と、コーチの担当選手割り当てを管理します
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          {success}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">代表監督</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          代表監督はチーム内の全選手を評価できます（1チームにつき1名）
        </p>

        <div className="flex items-center gap-4">
          <select
            value={headCoachId || ''}
            onChange={(e) => handleSetHeadCoach(e.target.value)}
            disabled={saving}
            className="flex-1 max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
          >
            <option value="">代表監督を選択...</option>
            {allStaff.map((staff) => (
              <option key={staff.id} value={staff.id}>
                {staff.name} ({staff.email})
              </option>
            ))}
          </select>
          {headCoachId && (
            <button
              onClick={handleRemoveHeadCoach}
              disabled={saving}
              className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
            >
              解除
            </button>
          )}
        </div>

        {data.headCoach && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Shield className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">{data.headCoach.name}</p>
              <p className="text-sm text-gray-500">{data.headCoach.email}</p>
            </div>
            <span className="ml-auto px-2.5 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
              代表監督
            </span>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-green-600" />
          <h2 className="text-lg font-semibold text-gray-900">担当選手の割り当て</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          各コーチに担当選手を割り当てます。担当コーチは割り当てられた選手のみ評価できます。
        </p>

        {data.coaches.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>コーチが登録されていません</p>
            <p className="text-sm mt-1">スタッフ管理からコーチを追加してください</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.coaches.map((coach) => {
              const isExpanded = expandedCoach === coach.id;
              const assignmentCount = getCoachAssignmentCount(coach.id);
              const isHeadCoach = coach.id === headCoachId;

              return (
                <div key={coach.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => {
                      if (isExpanded) {
                        setExpandedCoach(null);
                        setSelectedCoach(null);
                      } else {
                        handleSelectCoach(coach);
                      }
                    }}
                    className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                        <UserCircle className="w-6 h-6 text-gray-500" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-gray-900 flex items-center gap-2">
                          {coach.name}
                          {isHeadCoach && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                              代表監督
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-gray-500">
                          {isHeadCoach ? '全選手を評価可能' : `担当選手: ${assignmentCount}名`}
                        </p>
                      </div>
                    </div>
                    {!isHeadCoach && (
                      isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )
                    )}
                  </button>

                  {isExpanded && !isHeadCoach && (
                    <div className="p-4 border-t border-gray-200">
                      <p className="text-sm text-gray-600 mb-3">
                        担当する選手を選択してください（チェックを入れた選手を評価できます）
                      </p>
                      
                      {data.players.length === 0 ? (
                        <p className="text-center py-4 text-gray-500">選手が登録されていません</p>
                      ) : (
                        <>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-64 overflow-y-auto mb-4">
                            {data.players.map((player) => {
                              const isAssigned = assignedPlayerIds.has(player.id);
                              return (
                                <button
                                  key={player.id}
                                  onClick={() => handlePlayerToggle(player.id)}
                                  className={`p-2 rounded-lg border text-left transition-colors flex items-center gap-2 ${
                                    isAssigned
                                      ? 'border-green-500 bg-green-50 text-green-800'
                                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                                  }`}
                                >
                                  <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
                                    isAssigned ? 'bg-green-500 border-green-500' : 'border-gray-300'
                                  }`}>
                                    {isAssigned && <Check className="w-3 h-3 text-white" />}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-medium text-sm truncate">
                                      {player.number && `#${player.number} `}{player.name}
                                    </p>
                                    {player.position && (
                                      <p className="text-xs text-gray-500">{player.position}</p>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                          
                          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                            <p className="text-sm text-gray-500">
                              {assignedPlayerIds.size}名を選択中
                            </p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setAssignedPlayerIds(new Set())}
                                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                              >
                                すべて解除
                              </button>
                              <button
                                onClick={() => setAssignedPlayerIds(new Set(data.players.map(p => p.id)))}
                                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                              >
                                すべて選択
                              </button>
                              <button
                                onClick={handleSaveAssignments}
                                disabled={saving}
                                className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                              >
                                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                保存
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
        <h3 className="font-medium text-gray-900 mb-2">権限について</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• <strong>代表監督</strong>：チーム内の全選手を評価できます</li>
          <li>• <strong>担当コーチ</strong>：割り当てられた選手のみ評価できます</li>
          <li>• <strong>チーム管理者</strong>：代表監督・担当コーチに関係なく全選手を評価できます</li>
        </ul>
      </div>
    </div>
  );
}
