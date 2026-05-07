import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Save, Plus, X, Calendar, CheckCircle, HelpCircle, Trash2, Edit3, ChevronLeft, ChevronRight, ChevronDown, Users } from 'lucide-react';
import clsx from 'clsx';

const getScoreColor = (score) => {
  if (!score) return '';
  if (score >= 5) return 'bg-blue-100 text-blue-700';
  if (score >= 4) return 'bg-green-100 text-green-700';
  if (score >= 3) return 'bg-yellow-100 text-yellow-700';
  if (score >= 2) return 'bg-orange-100 text-orange-700';
  return 'bg-red-100 text-red-700';
};

const getScoreBg = (score) => {
  if (!score) return 'bg-gray-50';
  if (score >= 5) return 'bg-blue-50';
  if (score >= 4) return 'bg-green-50';
  if (score >= 3) return 'bg-yellow-50';
  if (score >= 2) return 'bg-orange-50';
  return 'bg-red-50';
};

export default function EvaluationEntry() {
  const { currentTeam, user, isCoach, isPlayer, isParent, playerData } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [players, setPlayers] = useState([]);
  const [evaluableInfo, setEvaluableInfo] = useState({ all: true, playerIds: [] });
  const [teamCategories, setTeamCategories] = useState([]);
  const [filterCategory, setFilterCategory] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [items, setItems] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [scoreMap, setScoreMap] = useState({});
  const [selectedRound, setSelectedRound] = useState('');
  const [editScores, setEditScores] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showAddRound, setShowAddRound] = useState(false);
  const [newRoundYear, setNewRoundYear] = useState(new Date().getFullYear());
  const [newRoundMonth, setNewRoundMonth] = useState(new Date().getMonth() + 1);
  const [addingRound, setAddingRound] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const tableRef = useRef(null);

  const isSelfEval = isPlayer();
  const evaluatorType = isSelfEval ? 'SELF' : 'COACH';

  useEffect(() => {
    if (isPlayer() && playerData) {
      setSelectedPlayer(playerData.id);
    }
  }, [playerData]);

  useEffect(() => {
    const pid = searchParams.get('playerId');
    if (pid && !isPlayer()) {
      setSelectedPlayer(pid);
    }
  }, [searchParams]);

  useEffect(() => {
    if (currentTeam || (isPlayer() && playerData)) {
      fetchBaseData();
    }
  }, [currentTeam, playerData]);

  useEffect(() => {
    if (selectedPlayer) {
      fetchHistory();
    } else {
      setItems([]);
      setRounds([]);
      setScoreMap({});
      setSelectedRound('');
      setEditScores({});
      setIsEditing(false);
    }
    setSuccess(false);
  }, [selectedPlayer]);

  useEffect(() => {
    if (selectedRound && scoreMap) {
      const existing = {};
      leaves.forEach(leaf => {
        const key = `${selectedRound}_${leaf.id}_${evaluatorType}`;
        if (scoreMap[key]) existing[leaf.id] = scoreMap[key];
      });
      setEditScores(existing);
      setIsEditing(false);
    }
  }, [selectedRound]);

  const fetchBaseData = async () => {
    const teamId = isPlayer() && playerData ? playerData.teamId : currentTeam?.id;
    if (!teamId) return;

    if (!isPlayer()) {
      try {
        const [playersRes, categoriesRes, evaluableRes] = await Promise.all([
          fetch(`/api/players?teamId=${teamId}&includeChildren=true`, { credentials: 'include' }),
          fetch(`/api/team-categories?teamId=${teamId}`, { credentials: 'include' }),
          fetch(`/api/evaluations/evaluable-players?teamId=${teamId}`, { credentials: 'include' }),
        ]);
        const playersData = await playersRes.json();
        setPlayers(Array.isArray(playersData) ? playersData : []);
        if (categoriesRes.ok) {
          const catData = await categoriesRes.json();
          setTeamCategories(Array.isArray(catData) ? catData : []);
        }
        if (evaluableRes.ok) {
          const evalData = await evaluableRes.json();
          setEvaluableInfo(evalData);
        }
      } catch (error) {
        console.error('Failed to fetch base data:', error);
      }
    }
  };

  const fetchHistory = async (preserveRound) => {
    if (!selectedPlayer) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/evaluations/history/${selectedPlayer}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data.items) ? data.items : []);
        const newRounds = Array.isArray(data.rounds) ? data.rounds : [];
        setRounds(newRounds);
        setScoreMap(data.scoreMap || {});

        if (preserveRound && newRounds.some(r => r.id === preserveRound)) {
          setSelectedRound(preserveRound);
        } else if (newRounds.length > 0) {
          setSelectedRound(newRounds[newRounds.length - 1].id);
        } else {
          setSelectedRound('');
        }
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setLoading(false);
    }
  };

  const collectLeaves = (item) => {
    if (!item.children || item.children.length === 0) return [item];
    return item.children.flatMap(c => collectLeaves(c));
  };

  const leaves = useMemo(() => items.flatMap(i => collectLeaves(i)), [items]);

  const hasExistingEvals = useMemo(() => {
    if (!selectedRound) return false;
    return leaves.some(leaf => {
      const key = `${selectedRound}_${leaf.id}_${evaluatorType}`;
      return scoreMap[key] !== undefined;
    });
  }, [selectedRound, scoreMap, leaves, evaluatorType]);

  const canEdit = !hasExistingEvals || isEditing;

  const handleScoreChange = (itemId, value) => {
    setEditScores(prev => ({ ...prev, [itemId]: parseInt(value) || 0 }));
  };

  const handleSubmit = async () => {
    if (!selectedPlayer || !selectedRound) {
      alert(isSelfEval ? '評価期間を選択してください' : '選手と評価期間を選択してください');
      return;
    }
    setSaving(true);
    setSuccess(false);
    try {
      const evaluations = Object.entries(editScores)
        .filter(([_, score]) => score > 0)
        .map(([itemId, score]) => ({ itemId, score }));

      const res = await fetch('/api/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ playerId: selectedPlayer, roundId: selectedRound, evaluations }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || '評価の保存に失敗しました');
        return;
      }

      setSuccess(true);
      setIsEditing(false);
      await fetchHistory(selectedRound);
    } catch (error) {
      alert('評価の保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedPlayer || !selectedRound) return;
    if (!confirm('この評価を削除してもよろしいですか？')) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/evaluations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ playerId: selectedPlayer, roundId: selectedRound, raterType: evaluatorType }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || '削除に失敗しました');
        return;
      }
      setEditScores({});
      setIsEditing(false);
      setSuccess(false);
      await fetchHistory(selectedRound);
    } catch (error) {
      alert('削除に失敗しました');
    } finally {
      setDeleting(false);
    }
  };

  const handleAddRound = async () => {
    const teamId = isPlayer() && playerData ? playerData.teamId : currentTeam?.id;
    if (!teamId) return;
    setAddingRound(true);
    try {
      const startDate = new Date(newRoundYear, newRoundMonth - 1, 1);
      const endDate = new Date(newRoundYear, newRoundMonth, 0);
      const name = `${newRoundYear}年${newRoundMonth}月`;
      const res = await fetch('/api/evaluations/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ teamId, name, startDate: startDate.toISOString(), endDate: endDate.toISOString() }),
      });
      if (res.ok) {
        const round = await res.json();
        setShowAddRound(false);
        await fetchHistory();
        setSelectedRound(round.id);
      } else {
        const error = await res.json();
        alert(error.error || '評価期間の追加に失敗しました');
      }
    } catch (error) {
      alert('評価期間の追加に失敗しました');
    } finally {
      setAddingRound(false);
    }
  };

  const buildRowsForParent = (parent) => {
    if (!parent.children || parent.children.length === 0) {
      return [{ childName: null, leaf: parent, childRowSpan: 1, isFirstChild: true }];
    }
    const rows = [];
    const childGroups = parent.children.map(child => {
      const grandchildren = child.children && child.children.length > 0 ? child.children : [child];
      const hasGrandchildren = child.children && child.children.length > 0;
      return { child, grandchildren, hasGrandchildren };
    });
    childGroups.forEach((group) => {
      group.grandchildren.forEach((gc, gi) => {
        rows.push({
          childName: group.hasGrandchildren ? group.child.name : null,
          leaf: gc,
          childRowSpan: group.grandchildren.length,
          isFirstChild: gi === 0,
        });
      });
    });
    return rows;
  };

  const groups = useMemo(() => items.map(parent => ({
    parent,
    leaves: collectLeaves(parent),
    rows: buildRowsForParent(parent),
  })), [items]);

  const [collapsedParents, setCollapsedParents] = useState(() => new Set());

  const toggleParentCollapsed = (parentId) => {
    setCollapsedParents(prev => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId);
      else next.add(parentId);
      return next;
    });
  };

  const collapseAllParents = () => {
    setCollapsedParents(new Set(items.map(p => p.id)));
  };

  const expandAllParents = () => {
    setCollapsedParents(new Set());
  };

  useEffect(() => {
    setCollapsedParents(new Set());
  }, [selectedPlayer]);

  const selectedRoundIdx = rounds.findIndex(r => r.id === selectedRound);

  const visibleHistoryRounds = useMemo(() => {
    if (rounds.length === 0) return [];
    const idx = selectedRoundIdx >= 0 ? selectedRoundIdx : rounds.length - 1;
    const start = Math.max(0, idx - 2);
    const historyRounds = [];
    for (let i = start; i < idx; i++) {
      historyRounds.push(rounds[i]);
    }
    return historyRounds;
  }, [rounds, selectedRoundIdx]);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);

  const canEvaluatePlayerId = (pid) => {
    if (evaluableInfo.all) return true;
    return evaluableInfo.playerIds.includes(pid);
  };

  const filteredPlayers = players.filter(p => !filterCategory || p.teamCategoryId === filterCategory);

  const selectedPlayerObj = players.find(p => p.id === selectedPlayer) || (isSelfEval && playerData ? playerData : null);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">
          {isSelfEval ? '自己評価' : '評価入力'}
        </h1>
        <p className="mt-0.5 text-xs text-gray-500">
          {isSelfEval ? '自分の評価を入力してください' : '選手を選択して評価を入力してください'}
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className={clsx('grid gap-3', isSelfEval ? 'grid-cols-1' : teamCategories.length > 0 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2')}>
          {!isSelfEval && (
            <>
              {teamCategories.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">カテゴリー</label>
                  <select
                    value={filterCategory}
                    onChange={(e) => { setFilterCategory(e.target.value); setSelectedPlayer(''); }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">全カテゴリー</option>
                    {teamCategories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">選手</label>
                <select
                  value={selectedPlayer}
                  onChange={(e) => setSelectedPlayer(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">選択してください</option>
                  {filteredPlayers
                    .filter(p => canEvaluatePlayerId(p.id))
                    .map(player => (
                      <option key={player.id} value={player.id}>
                        {player.number ? `#${player.number} ` : ''}{player.name}
                        {player.teamCategory ? ` (${player.teamCategory.name})` : ''}
                      </option>
                    ))}
                </select>
                {!evaluableInfo.all && evaluableInfo.playerIds.length === 0 && (
                  <p className="mt-1 text-xs text-amber-600">
                    担当選手が割り当てられていません。チーム管理者に指導者体制の設定を依頼してください。
                  </p>
                )}
                {!evaluableInfo.all && evaluableInfo.playerIds.length > 0 && (
                  <p className="mt-1 text-xs text-gray-500">
                    担当選手のみ表示されています（{evaluableInfo.playerIds.length}名）
                  </p>
                )}
              </div>
            </>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">評価期間</label>
            <div className="flex gap-2">
              <select
                value={selectedRound}
                onChange={(e) => setSelectedRound(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">選択してください</option>
                {rounds.map(round => (
                  <option key={round.id} value={round.id}>{round.name}</option>
                ))}
              </select>
              {!isSelfEval && (
                <button
                  onClick={() => setShowAddRound(true)}
                  className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  title="新しい期間を追加"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {showAddRound && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-900 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                新しい評価期間を追加
              </h3>
              <button onClick={() => setShowAddRound(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-end gap-2">
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">年</label>
                <select value={newRoundYear} onChange={(e) => setNewRoundYear(parseInt(e.target.value))} className="px-2 py-1.5 border border-gray-300 rounded text-sm">
                  {years.map(year => <option key={year} value={year}>{year}年</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">月</label>
                <select value={newRoundMonth} onChange={(e) => setNewRoundMonth(parseInt(e.target.value))} className="px-2 py-1.5 border border-gray-300 rounded text-sm">
                  {monthOptions.map(month => <option key={month} value={month}>{month}月</option>)}
                </select>
              </div>
              <button onClick={handleAddRound} disabled={addingRound} className="px-3 py-1.5 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50 text-sm font-medium">
                {addingRound ? '追加中...' : '追加'}
              </button>
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      )}

      {!loading && selectedPlayer && selectedRound && items.length > 0 && (
        <>
          {hasExistingEvals && !isEditing && (
            <div className="p-3 rounded-lg text-sm bg-green-50 text-green-700 border border-green-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                <span className="text-xs">この期間の評価は入力済みです</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setIsEditing(true); setSuccess(false); }} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700">
                  <Edit3 className="w-3 h-3" />
                  編集
                </button>
                <button onClick={handleDelete} disabled={deleting} className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 disabled:opacity-50">
                  <Trash2 className="w-3 h-3" />
                  {deleting ? '...' : '削除'}
                </button>
              </div>
            </div>
          )}

          {isEditing && (
            <div className="p-3 rounded-lg text-xs bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-2">
              <Edit3 className="w-3.5 h-3.5" />
              編集モード：点数を変更して保存してください
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-xs flex items-center gap-2">
              <CheckCircle className="w-3.5 h-3.5" />
              評価を保存しました
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-200 bg-gray-50">
              <div className="text-[11px] text-gray-500">
                大分類のヘッダーをタップして開閉できます
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={collapseAllParents}
                  className="text-[11px] text-gray-600 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100"
                >
                  全て折りたたむ
                </button>
                <button
                  type="button"
                  onClick={expandAllParents}
                  className="text-[11px] text-gray-600 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100"
                >
                  全て展開
                </button>
              </div>
            </div>
            <div className="overflow-x-auto" ref={tableRef}>
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="sticky left-0 z-10 bg-gray-50 border-b border-r border-gray-200 px-2 py-2 text-left font-semibold text-gray-700 min-w-[90px] w-[90px]">中分類</th>
                    <th className="sticky left-[90px] z-10 bg-gray-50 border-b border-r border-gray-200 px-2 py-2 text-left font-semibold text-gray-700 min-w-[120px] w-[120px]">評価項目</th>
                    {visibleHistoryRounds.map(r => (
                      <th key={r.id} className="border-b border-r border-gray-200 px-1 py-2 text-center font-medium text-gray-400 min-w-[52px] w-[52px] whitespace-nowrap">
                        {r.name.replace(/年/, '/').replace(/月/, '')}
                      </th>
                    ))}
                    <th className="border-b border-gray-200 px-1 py-2 text-center font-semibold text-primary-700 min-w-[60px] w-[60px] bg-primary-50 whitespace-nowrap">
                      {rounds.find(r => r.id === selectedRound)?.name.replace(/年/, '/').replace(/月/, '') || '今回'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group) => {
                    const isCollapsed = collapsedParents.has(group.parent.id);
                    const totalLeaves = group.leaves.length;
                    const filledCount = group.leaves.filter(l => {
                      if (Object.prototype.hasOwnProperty.call(editScores, l.id)) {
                        return editScores[l.id] > 0;
                      }
                      const savedKey = `${selectedRound}_${l.id}_${evaluatorType}`;
                      return !!scoreMap[savedKey];
                    }).length;
                    const totalCols = 2 + visibleHistoryRounds.length + 1;

                    return (
                      <React.Fragment key={group.parent.id}>
                        <tr
                          className="bg-gray-100 hover:bg-gray-200 cursor-pointer border-t-2 border-gray-300"
                          onClick={() => toggleParentCollapsed(group.parent.id)}
                        >
                          <td colSpan={totalCols} className="px-2 py-2">
                            <div className="flex items-center gap-2">
                              {isCollapsed ? (
                                <ChevronRight className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
                              )}
                              <span className="font-semibold text-gray-900 text-[12px]">{group.parent.name}</span>
                              <span className="text-[11px] text-gray-500 ml-auto">
                                {filledCount}/{totalLeaves} 入力済
                              </span>
                            </div>
                          </td>
                        </tr>
                        {!isCollapsed && group.rows.map((row, ri) => (
                          <tr key={`${group.parent.id}_${ri}`} className="hover:bg-gray-50/50">
                            {row.isFirstChild && row.childName && (
                              <td
                                rowSpan={row.childRowSpan}
                                className="sticky left-0 z-10 bg-white border-b border-r border-gray-200 px-2 py-1.5 align-top text-gray-600 text-[11px]"
                              >
                                {row.childName}
                              </td>
                            )}
                            {row.isFirstChild && !row.childName && (
                              <td
                                rowSpan={row.childRowSpan || 1}
                                className="sticky left-0 z-10 bg-white border-b border-r border-gray-200 px-2 py-1.5 align-top text-gray-400 text-[11px]"
                              >
                                -
                              </td>
                            )}
                            <td className="sticky left-[90px] z-10 bg-white border-b border-r border-gray-200 px-2 py-1.5 text-gray-700 text-[11px]">
                              {row.leaf.name}
                            </td>
                            {visibleHistoryRounds.map(r => {
                              const score = scoreMap[`${r.id}_${row.leaf.id}_${evaluatorType}`];
                              return (
                                <td key={r.id} className={clsx('border-b border-r border-gray-200 px-1 py-1.5 text-center', getScoreBg(score))}>
                                  <span className={clsx('inline-flex items-center justify-center w-6 h-5 rounded text-[11px] font-bold', score ? getScoreColor(score) : 'text-gray-300')}>
                                    {score || '-'}
                                  </span>
                                </td>
                              );
                            })}
                            <td className={clsx('border-b border-gray-200 px-1 py-1 text-center bg-primary-50/30')}>
                              {canEdit ? (
                                <select
                                  value={editScores[row.leaf.id] || ''}
                                  onChange={(e) => handleScoreChange(row.leaf.id, e.target.value)}
                                  className="w-12 px-0.5 py-0.5 border border-gray-300 rounded text-xs text-center bg-white focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                                >
                                  <option value="">-</option>
                                  {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                              ) : (
                                <span className={clsx('inline-flex items-center justify-center w-6 h-5 rounded text-[11px] font-bold', editScores[row.leaf.id] ? getScoreColor(editScores[row.leaf.id]) : 'text-gray-300')}>
                                  {editScores[row.leaf.id] || '-'}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            {isEditing && (
              <button
                onClick={() => {
                  setIsEditing(false);
                  const existing = {};
                  leaves.forEach(leaf => {
                    const key = `${selectedRound}_${leaf.id}_${evaluatorType}`;
                    if (scoreMap[key]) existing[leaf.id] = scoreMap[key];
                  });
                  setEditScores(existing);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
              >
                <X className="w-4 h-4" />
                キャンセル
              </button>
            )}
            {canEdit && (
              <button
                onClick={handleSubmit}
                disabled={saving || !selectedPlayer || !selectedRound}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm font-medium"
              >
                <Save className="w-4 h-4" />
                {saving ? '保存中...' : hasExistingEvals ? '更新' : '保存'}
              </button>
            )}
          </div>
        </>
      )}

      {!loading && selectedPlayer && items.length === 0 && !selectedRound && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500">評価項目が設定されていません</p>
        </div>
      )}
    </div>
  );
}
