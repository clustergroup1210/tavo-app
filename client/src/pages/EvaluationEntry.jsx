import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Save, Plus, Copy, X, Calendar, CheckCircle } from 'lucide-react';

export default function EvaluationEntry() {
  const { currentTeam, user, isCoach, isPlayer, playerData } = useAuth();
  const [players, setPlayers] = useState([]);
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
  const [copyingPrevious, setCopyingPrevious] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');
  const [existingEvaluations, setExistingEvaluations] = useState([]);
  const [hasExistingEvaluations, setHasExistingEvaluations] = useState(false);

  useEffect(() => {
    // For players, use playerData from context to set selectedPlayer immediately
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
    }
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
      // For players, use their team from playerData
      const teamId = isPlayer() && playerData ? playerData.teamId : currentTeam?.id;
      if (!teamId) return;

      // Players don't need to fetch the players list - they only evaluate themselves
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
        // Coaches/admins fetch players list too
        const [playersRes, itemsRes, roundsRes] = await Promise.all([
          fetch(`/api/players?teamId=${teamId}&includeChildren=true`, { credentials: 'include' }),
          fetch(`/api/evaluations/items?teamId=${teamId}`, { credentials: 'include' }),
          fetch(`/api/evaluations/rounds?teamId=${teamId}`, { credentials: 'include' }),
        ]);

        const playersData = await playersRes.json();
        const itemsData = await itemsRes.json();
        const roundsData = await roundsRes.json();

        setPlayers(Array.isArray(playersData) ? playersData : []);
        setItems(Array.isArray(itemsData) ? itemsData : []);
        setRounds(Array.isArray(roundsData) ? roundsData : []);

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

      await fetch('/api/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          playerId: selectedPlayer,
          roundId: selectedRound,
          evaluations,
        }),
      });

      setSuccess(true);
      setScores({});
    } catch (error) {
      console.error('Failed to save evaluations:', error);
      alert('評価の保存に失敗しました');
    } finally {
      setLoading(false);
    }
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
          endDate: endDate.toISOString(),
        }),
      });

      if (res.ok) {
        const newRound = await res.json();
        setRounds(prev => [newRound, ...prev]);
        setSelectedRound(newRound.id);
        setShowAddRound(false);
      } else {
        const error = await res.json();
        alert(error.error || '期間の追加に失敗しました');
      }
    } catch (error) {
      console.error('Failed to add round:', error);
      alert('期間の追加に失敗しました');
    } finally {
      setAddingRound(false);
    }
  };

  const handleCopyPrevious = async () => {
    if (!selectedRound) {
      alert('評価ラウンドを選択してください');
      return;
    }

    setCopyingPrevious(true);
    setCopyMessage('');

    try {
      const res = await fetch(`/api/evaluations/rounds/${selectedRound}/copy-previous`, {
        method: 'POST',
        credentials: 'include',
      });

      const data = await res.json();

      if (res.ok) {
        setCopyMessage(`${data.previousRoundName}から${data.copiedCount}件の評価をコピーしました`);
      } else {
        setCopyMessage(data.error || 'コピーに失敗しました');
      }
    } catch (error) {
      console.error('Failed to copy previous:', error);
      setCopyMessage('コピーに失敗しました');
    } finally {
      setCopyingPrevious(false);
    }
  };

  const renderItems = (itemList, level = 0) => {
    return itemList.map((item) => (
      <div key={item.id} style={{ marginLeft: level * 20 }}>
        <div className="flex items-center justify-between py-3 border-b border-gray-100">
          <div>
            <p className={`text-sm ${level === 0 ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
              {item.name}
            </p>
            {item.description && (
              <p className="text-xs text-gray-500">{item.description}</p>
            )}
          </div>
          {(!item.children || item.children.length === 0) && (
            <select
              value={scores[item.id] || ''}
              onChange={(e) => handleScoreChange(item.id, e.target.value)}
              className="w-20 px-2 py-1 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">-</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          )}
        </div>
        {item.children && renderItems(item.children, level + 1)}
      </div>
    ));
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

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
        <div className={`grid grid-cols-1 ${isPlayer() ? 'md:grid-cols-1' : 'md:grid-cols-3'} gap-4 mb-6`}>
          {!isPlayer() && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">選手</label>
              <select
                value={selectedPlayer}
                onChange={(e) => setSelectedPlayer(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">選択してください</option>
                {players.map((player) => (
                  <option key={player.id} value={player.id}>{player.name}</option>
                ))}
              </select>
            </div>
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

          {!isPlayer() && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">データ操作</label>
              <button
                onClick={handleCopyPrevious}
                disabled={copyingPrevious || !selectedRound}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                <Copy className="w-4 h-4" />
                {copyingPrevious ? 'コピー中...' : '前回のデータをコピー'}
              </button>
            </div>
          )}
        </div>

        {copyMessage && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${
            copyMessage.includes('失敗') || copyMessage.includes('エラー')
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-blue-50 text-blue-700 border border-blue-200'
          }`}>
            {copyMessage}
          </div>
        )}

        {hasExistingEvaluations && selectedPlayer && selectedRound && (
          <div className="mb-4 p-3 rounded-lg text-sm bg-green-50 text-green-700 border border-green-200 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            この期間の評価は入力済みです。点数を変更して再保存できます。
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
                  {months.map((month) => (
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
            <h3 className="text-lg font-semibold text-gray-900 mb-4">評価項目</h3>
            {renderItems(items)}
          </div>
        ) : (
          <p className="text-sm text-gray-500">評価項目が設定されていません</p>
        )}

        {success && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
            評価を保存しました
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={loading || !selectedPlayer || !selectedRound}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {loading ? '保存中...' : hasExistingEvaluations ? '更新' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
