import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Save, Plus, X, Calendar, CheckCircle, HelpCircle, Trash2, Edit3 } from 'lucide-react';

export default function EvaluationEntry() {
  const { currentTeam, user, isCoach, isPlayer, playerData } = useAuth();
  const [players, setPlayers] = useState([]);
  const [teamCategories, setTeamCategories] = useState([]);
  const [filterCategory, setFilterCategory] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [items, setItems] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [selectedRound, setSelectedRound] = useState('');
  const [scores, setScores] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showAddRound, setShowAddRound] = useState(false);
  const [newRoundYear, setNewRoundYear] = useState(new Date().getFullYear());
  const [newRoundMonth, setNewRoundMonth] = useState(new Date().getMonth() + 1);
  const [addingRound, setAddingRound] = useState(false);
  const [existingEvaluations, setExistingEvaluations] = useState([]);
  const [hasExistingEvaluations, setHasExistingEvaluations] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (isPlayer() && playerData) {
      setSelectedPlayer(playerData.id);
    }
  }, [playerData]);

  useEffect(() => {
    if (currentTeam || (isPlayer() && playerData)) {
      fetchData();
    }
  }, [currentTeam, playerData]);

  useEffect(() => {
    if (selectedPlayer && selectedRound) {
      fetchExistingEvaluations();
    } else {
      setScores({});
      setExistingEvaluations([]);
      setHasExistingEvaluations(false);
      setIsEditing(false);
    }
    setSuccess(false);
  }, [selectedPlayer, selectedRound]);

  const fetchExistingEvaluations = async () => {
    try {
      const evaluatorType = isPlayer() ? 'SELF' : 'COACH';
      const res = await fetch(
        `/api/evaluations?playerId=${selectedPlayer}&roundId=${selectedRound}&evaluatorType=${evaluatorType}`,
        { credentials: 'include' }
      );
      if (res.ok) {
        const data = await res.json();
        const evaluations = Array.isArray(data) ? data : [];
        setExistingEvaluations(evaluations);
        setHasExistingEvaluations(evaluations.length > 0);
        setIsEditing(false);

        const existingScores = {};
        evaluations.forEach(ev => {
          existingScores[ev.itemId] = ev.score;
        });
        setScores(existingScores);
      }
    } catch (error) {
      console.error('Failed to fetch existing evaluations:', error);
    }
  };

  const fetchData = async () => {
    try {
      const teamId = isPlayer() && playerData ? playerData.teamId : currentTeam?.id;
      if (!teamId) return;

      if (isPlayer() && playerData) {
        const [itemsRes, roundsRes] = await Promise.all([
          fetch(`/api/evaluations/items?teamId=${teamId}`, { credentials: 'include' }),
          fetch(`/api/evaluations/rounds?teamId=${teamId}`, { credentials: 'include' }),
        ]);

        const itemsData = await itemsRes.json();
        const roundsData = await roundsRes.json();

        setItems(Array.isArray(itemsData) ? itemsData : []);
        setRounds(Array.isArray(roundsData) ? roundsData : []);
        setSelectedPlayer(playerData.id);

        if (roundsData.length > 0) {
          setSelectedRound(roundsData[0].id);
        }
      } else {
        const [playersRes, itemsRes, roundsRes, categoriesRes] = await Promise.all([
          fetch(`/api/players?teamId=${teamId}&includeChildren=true`, { credentials: 'include' }),
          fetch(`/api/evaluations/items?teamId=${teamId}`, { credentials: 'include' }),
          fetch(`/api/evaluations/rounds?teamId=${teamId}`, { credentials: 'include' }),
          fetch(`/api/team-categories?teamId=${teamId}`, { credentials: 'include' }),
        ]);

        const playersData = await playersRes.json();
        const itemsData = await itemsRes.json();
        const roundsData = await roundsRes.json();

        setPlayers(Array.isArray(playersData) ? playersData : []);
        setItems(Array.isArray(itemsData) ? itemsData : []);
        setRounds(Array.isArray(roundsData) ? roundsData : []);

        if (categoriesRes.ok) {
          const catData = await categoriesRes.json();
          setTeamCategories(Array.isArray(catData) ? catData : []);
        }

        if (roundsData.length > 0) {
          setSelectedRound(roundsData[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  };

  const handleScoreChange = (itemId, value) => {
    setScores(prev => ({ ...prev, [itemId]: parseInt(value) || 0 }));
  };

  const handleSubmit = async () => {
    if (!selectedPlayer || !selectedRound) {
      alert(isPlayer() ? '評価期間を選択してください' : '選手と評価ラウンドを選択してください');
      return;
    }

    setLoading(true);
    setSuccess(false);

    try {
      const evaluations = Object.entries(scores).map(([itemId, score]) => ({
        itemId,
        score,
      }));

      const res = await fetch('/api/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          playerId: selectedPlayer,
          roundId: selectedRound,
          evaluations,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || '評価の保存に失敗しました');
        return;
      }

      setSuccess(true);
      setHasExistingEvaluations(true);
      setIsEditing(false);
      await fetchExistingEvaluations();
    } catch (error) {
      console.error('Failed to save evaluations:', error);
      alert('評価の保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedPlayer || !selectedRound) return;
    if (!confirm('この評価を削除してもよろしいですか？この操作は取り消せません。')) return;

    setDeleting(true);
    try {
      const raterType = isPlayer() ? 'SELF' : 'COACH';
      const res = await fetch('/api/evaluations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          playerId: selectedPlayer,
          roundId: selectedRound,
          raterType,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || '削除に失敗しました');
        return;
      }

      setScores({});
      setExistingEvaluations([]);
      setHasExistingEvaluations(false);
      setIsEditing(false);
      setSuccess(false);
    } catch (error) {
      console.error('Failed to delete evaluations:', error);
      alert('削除に失敗しました');
    } finally {
      setDeleting(false);
    }
  };

  const handleStartEditing = () => {
    setIsEditing(true);
    setSuccess(false);
  };

  const handleCancelEditing = () => {
    setIsEditing(false);
    const existingScores = {};
    existingEvaluations.forEach(ev => {
      existingScores[ev.itemId] = ev.score;
    });
    setScores(existingScores);
  };

  const handleAddRound = async () => {
    if (!currentTeam) return;
    setAddingRound(true);

    try {
      const startDate = new Date(newRoundYear, newRoundMonth - 1, 1);
      const endDate = new Date(newRoundYear, newRoundMonth, 0);
      const name = `${newRoundYear}年${newRoundMonth}月`;

      const res = await fetch('/api/evaluations/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          teamId: currentTeam.id,
          name,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        }),
      });

      if (res.ok) {
        const round = await res.json();
        setRounds(prev => [round, ...prev]);
        setSelectedRound(round.id);
        setShowAddRound(false);
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

  const [openTooltip, setOpenTooltip] = useState(null);
  const tooltipRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target)) {
        setOpenTooltip(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const TooltipButton = ({ id, description }) => {
    if (!description) return null;
    return (
      <div className="relative inline-flex" ref={openTooltip === id ? tooltipRef : null}>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpenTooltip(openTooltip === id ? null : id); }}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
        {openTooltip === id && (
          <div className="absolute z-50 left-0 top-6 w-60 p-2.5 bg-gray-800 text-white text-xs rounded-lg shadow-lg whitespace-normal">
            {description}
            <div className="absolute -top-1 left-2 w-2 h-2 bg-gray-800 rotate-45" />
          </div>
        )}
      </div>
    );
  };

  const collectLeaves = (item) => {
    if (!item.children || item.children.length === 0) return [item];
    return item.children.flatMap(c => collectLeaves(c));
  };

  const canEdit = !hasExistingEvaluations || isEditing;

  const renderItems = (itemList) => {
    return itemList.map((topItem) => {
      const leaves = collectLeaves(topItem);
      if (leaves.length === 0) return null;

      return (
        <div key={topItem.id} className="flex border-b border-gray-200 last:border-b-0">
          <div className="w-28 md:w-36 flex-shrink-0 bg-gray-50 px-3 py-2 flex items-start gap-1 border-r border-gray-200">
            <span className="text-xs font-semibold text-gray-800 leading-tight">{topItem.name}</span>
            <TooltipButton id={topItem.id} description={topItem.description} />
          </div>
          <div className="flex-1 min-w-0">
            {leaves.map((leaf, idx) => (
              <div
                key={leaf.id}
                className={`flex items-center justify-between px-2 py-1 ${idx < leaves.length - 1 ? 'border-b border-gray-50' : ''} hover:bg-gray-50`}
              >
                <div className="flex items-center gap-1 min-w-0 flex-1">
                  <span className="text-xs text-gray-600 truncate">{leaf.name}</span>
                  <TooltipButton id={leaf.id} description={leaf.description} />
                </div>
                {canEdit ? (
                  <select
                    value={scores[leaf.id] || ''}
                    onChange={(e) => handleScoreChange(leaf.id, e.target.value)}
                    className="w-14 px-1 py-0.5 border border-gray-300 rounded text-xs text-center flex-shrink-0"
                  >
                    <option value="">-</option>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                ) : (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className={`inline-flex items-center justify-center w-8 h-6 rounded text-xs font-bold ${
                      scores[leaf.id] ? getScoreColor(scores[leaf.id]) : 'bg-gray-100 text-gray-400'
                    }`}>
                      {scores[leaf.id] || '-'}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    });
  };

  const getScoreColor = (score) => {
    if (score >= 5) return 'bg-blue-100 text-blue-700';
    if (score >= 4) return 'bg-green-100 text-green-700';
    if (score >= 3) return 'bg-yellow-100 text-yellow-700';
    if (score >= 2) return 'bg-orange-100 text-orange-700';
    return 'bg-red-100 text-red-700';
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {isPlayer() ? '自己評価' : '評価入力'}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {isPlayer() ? '自分の評価を入力してください' : '選手の評価を入力してください'}
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className={`grid grid-cols-1 ${isPlayer() ? 'md:grid-cols-1' : teamCategories.length > 0 ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4 mb-6`}>
          {!isPlayer() && (
            <>
              {teamCategories.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">カテゴリー</label>
                  <select
                    value={filterCategory}
                    onChange={(e) => { setFilterCategory(e.target.value); setSelectedPlayer(''); }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">全カテゴリー</option>
                    {teamCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">選手</label>
                <select
                  value={selectedPlayer}
                  onChange={(e) => setSelectedPlayer(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">選択してください</option>
                  {players
                    .filter(p => !filterCategory || p.teamCategoryId === filterCategory)
                    .map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.name}
                        {player.teamCategory ? ` (${player.teamCategory.name})` : ''}
                      </option>
                    ))}
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">評価期間</label>
            <div className="flex gap-2">
              <select
                value={selectedRound}
                onChange={(e) => setSelectedRound(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">選択してください</option>
                {rounds.map((round) => (
                  <option key={round.id} value={round.id}>{round.name}</option>
                ))}
              </select>
              {!isPlayer() && (
                <button
                  onClick={() => setShowAddRound(true)}
                  className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  title="新しい期間を追加"
                >
                  <Plus className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {hasExistingEvaluations && selectedPlayer && selectedRound && !isEditing && (
          <div className="mb-4 p-3 rounded-lg text-sm bg-green-50 text-green-700 border border-green-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              この期間の評価は入力済みです。
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleStartEditing}
                className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-xs font-medium transition-colors"
              >
                <Edit3 className="w-3 h-3" />
                編集
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1 px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 text-xs font-medium transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3 h-3" />
                {deleting ? '削除中...' : '削除'}
              </button>
            </div>
          </div>
        )}

        {isEditing && (
          <div className="mb-4 p-3 rounded-lg text-sm bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-2">
            <Edit3 className="w-4 h-4" />
            編集モード：点数を変更して保存してください。
          </div>
        )}

        {showAddRound && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                新しい評価期間を追加
              </h3>
              <button
                onClick={() => setShowAddRound(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-end gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">年</label>
                <select
                  value={newRoundYear}
                  onChange={(e) => setNewRoundYear(parseInt(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  {years.map((year) => (
                    <option key={year} value={year}>{year}年</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">月</label>
                <select
                  value={newRoundMonth}
                  onChange={(e) => setNewRoundMonth(parseInt(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  {monthOptions.map((month) => (
                    <option key={month} value={month}>{month}月</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleAddRound}
                disabled={addingRound}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm font-medium"
              >
                {addingRound ? '追加中...' : '追加'}
              </button>
            </div>
          </div>
        )}

        {items.length > 0 ? (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">評価項目</h3>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {renderItems(items)}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">評価項目が設定されていません</p>
        )}

        {success && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
            評価を保存しました
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          {isEditing && (
            <button
              onClick={handleCancelEditing}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <X className="w-4 h-4" />
              キャンセル
            </button>
          )}
          {canEdit && (
            <button
              onClick={handleSubmit}
              disabled={loading || !selectedPlayer || !selectedRound}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {loading ? '保存中...' : hasExistingEvaluations ? '更新' : '保存'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
