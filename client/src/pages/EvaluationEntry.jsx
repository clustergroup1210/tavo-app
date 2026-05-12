import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { X, CheckCircle, Info, Trash2, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
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

const getScoreButtonSelectedClass = (score) => {
  if (score >= 5) return 'bg-blue-500 text-white border border-blue-600';
  if (score >= 4) return 'bg-green-500 text-white border border-green-600';
  if (score >= 3) return 'bg-yellow-500 text-white border border-yellow-600';
  if (score >= 2) return 'bg-orange-500 text-white border border-orange-600';
  return 'bg-red-500 text-white border border-red-600';
};

export default function EvaluationEntry() {
  const { currentTeam, user, isCoach, isPlayer, isParent, playerData } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [players, setPlayers] = useState([]);
  const [evaluableInfo, setEvaluableInfo] = useState({ all: true, playerIds: [] });
  const [teamCategories, setTeamCategories] = useState([]);
  const [filterCategory, setFilterCategory] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [forcedPlayer, setForcedPlayer] = useState(null);
  const [items, setItems] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [scoreMap, setScoreMap] = useState({});
  const [selectedRound, setSelectedRound] = useState('');
  const [editScores, setEditScores] = useState({});
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState('');
  const tableRef = useRef(null);
  const dirtyRef = useRef(false);
  const autoSaveTimerRef = useRef(null);
  const autoSaveVersionRef = useRef(0);

  const isSelfEval = isPlayer();
  const evaluatorType = isSelfEval ? 'SELF' : 'COACH';
  const lsKey = `evalEntry.${user?.id || 'anon'}.${evaluatorType}`;

  useEffect(() => {
    if (isPlayer() && playerData) {
      setSelectedPlayer(playerData.id);
    }
  }, [playerData]);

  useEffect(() => {
    const pid = searchParams.get('playerId');
    if (!pid || isPlayer()) return;
    setSelectedPlayer(pid);
    setFilterCategory('');
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/players/${pid}`, { credentials: 'include' });
        if (res.ok && !cancelled) {
          const data = await res.json();
          setForcedPlayer(data);
        }
      } catch (e) {
        console.error('Failed to fetch forced player:', e);
      }
    })();
    return () => { cancelled = true; };
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
    }
  }, [selectedPlayer]);

  useEffect(() => {
    if (selectedRound && scoreMap) {
      const existing = {};
      leaves.forEach(leaf => {
        const key = `${selectedRound}_${leaf.id}_${evaluatorType}`;
        if (scoreMap[key]) existing[leaf.id] = scoreMap[key];
      });
      dirtyRef.current = false;
      setEditScores(existing);
    }
  }, [selectedRound]);

  useEffect(() => { dirtyRef.current = false; }, [selectedPlayer]);

  useEffect(() => {
    if (!dirtyRef.current) return;
    if (!selectedPlayer || !selectedRound) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    const playerSnap = selectedPlayer;
    const roundSnap = selectedRound;
    const raterSnap = evaluatorType;
    const version = ++autoSaveVersionRef.current;
    autoSaveTimerRef.current = setTimeout(async () => {
      if (version !== autoSaveVersionRef.current) return;
      const ctrl = new AbortController();
      try {
        setAutoSaveStatus('saving');
        const evaluations = Object.entries(editScores)
          .filter(([_, s]) => s > 0)
          .map(([itemId, score]) => ({ itemId, score }));
        const res = await fetch('/api/evaluations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ playerId: playerSnap, roundId: roundSnap, evaluations }),
          signal: ctrl.signal,
        });
        if (version !== autoSaveVersionRef.current) return;
        if (playerSnap !== selectedPlayer || roundSnap !== selectedRound) return;
        if (res.ok) {
          setScoreMap(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(k => {
              if (k.startsWith(`${roundSnap}_`) && k.endsWith(`_${raterSnap}`)) delete next[k];
            });
            evaluations.forEach(({ itemId, score }) => {
              next[`${roundSnap}_${itemId}_${raterSnap}`] = score;
            });
            return next;
          });
          dirtyRef.current = false;
          setAutoSaveStatus('saved');
          setTimeout(() => {
            if (version === autoSaveVersionRef.current) {
              setAutoSaveStatus(s => (s === 'saved' ? '' : s));
            }
          }, 1500);
        } else {
          setAutoSaveStatus('error');
        }
      } catch {
        if (version === autoSaveVersionRef.current) setAutoSaveStatus('error');
      }
    }, 700);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [editScores, selectedPlayer, selectedRound, evaluatorType]);

  useEffect(() => {
    if (!selectedPlayer) return;
    try { localStorage.setItem(`${lsKey}.player`, selectedPlayer); } catch {}
  }, [selectedPlayer, lsKey]);

  useEffect(() => {
    if (!selectedRound) return;
    try { localStorage.setItem(`${lsKey}.round`, selectedRound); } catch {}
  }, [selectedRound, lsKey]);

  useEffect(() => {
    if (isSelfEval) return;
    if (selectedPlayer) return;
    if (searchParams.get('playerId')) return;
    try {
      const saved = localStorage.getItem(`${lsKey}.player`);
      if (saved && players.some(p => p.id === saved)) {
        setSelectedPlayer(saved);
      }
    } catch {}
  }, [players, isSelfEval]);

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

        let savedRound = '';
        try { savedRound = localStorage.getItem(`${lsKey}.round`) || ''; } catch {}
        if (preserveRound && newRounds.some(r => r.id === preserveRound)) {
          setSelectedRound(preserveRound);
        } else if (savedRound && newRounds.some(r => r.id === savedRound)) {
          setSelectedRound(savedRound);
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

  const canEdit = true;

  const handleScoreChange = (itemId, value) => {
    dirtyRef.current = true;
    setEditScores(prev => ({ ...prev, [itemId]: parseInt(value) || 0 }));
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
      await fetchHistory(selectedRound);
    } catch (error) {
      alert('削除に失敗しました');
    } finally {
      setDeleting(false);
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

  useEffect(() => {
    setCollapsedParents(new Set(items.map(i => i.id)));
  }, [items]);
  const [openInfoId, setOpenInfoId] = useState(null);
  const [infoAnchor, setInfoAnchor] = useState({ top: 0, left: 0 });
  const [infoText, setInfoText] = useState('');
  const [openScoreId, setOpenScoreId] = useState(null);
  const [scoreAnchor, setScoreAnchor] = useState({ top: 0, left: 0 });

  const openScorePicker = (leafId, e) => {
    e.stopPropagation();
    if (openScoreId === leafId) {
      setOpenScoreId(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const pickerWidth = 56;
    const pickerHeight = 6 * 44 + 12;
    let left = rect.left + rect.width / 2 - pickerWidth / 2;
    if (left < 8) left = 8;
    if (left + pickerWidth > window.innerWidth - 8) left = window.innerWidth - pickerWidth - 8;
    let top = rect.bottom + 4;
    if (top + pickerHeight > window.innerHeight - 8) {
      top = Math.max(8, rect.top - pickerHeight - 4);
    }
    setScoreAnchor({ top, left });
    setOpenScoreId(leafId);
  };

  useEffect(() => {
    if (!openScoreId) return;
    const onDocClick = (e) => {
      if (!e.target.closest('[data-score-picker]')) setOpenScoreId(null);
    };
    const onScrollOrResize = () => setOpenScoreId(null);
    document.addEventListener('click', onDocClick);
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      document.removeEventListener('click', onDocClick);
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [openScoreId]);

  const openInfoPopover = (id, text, e) => {
    e.stopPropagation();
    if (openInfoId === id) {
      setOpenInfoId(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const popoverWidth = Math.min(288, window.innerWidth - 24);
    let left = rect.left;
    if (left + popoverWidth > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - popoverWidth - 12);
    }
    setInfoAnchor({ top: rect.bottom + 6, left });
    setInfoText(text);
    setOpenInfoId(id);
  };

  useEffect(() => {
    if (!openInfoId) return;
    const onDocClick = (e) => {
      if (!e.target.closest('[data-info-popover]')) setOpenInfoId(null);
    };
    const onScrollOrResize = () => setOpenInfoId(null);
    document.addEventListener('click', onDocClick);
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      document.removeEventListener('click', onDocClick);
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [openInfoId]);

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

  const canEvaluatePlayerId = (pid) => {
    if (evaluableInfo.all) return true;
    if (forcedPlayer && forcedPlayer.id === pid) return true;
    return evaluableInfo.playerIds.includes(pid);
  };

  const mergedPlayers = useMemo(() => {
    if (!forcedPlayer) return players;
    return players.some(p => p.id === forcedPlayer.id) ? players : [forcedPlayer, ...players];
  }, [players, forcedPlayer]);

  const filteredPlayers = mergedPlayers.filter(p => !filterCategory || p.teamCategoryId === filterCategory);

  const evaluablePlayers = useMemo(
    () => filteredPlayers
      .filter(p => canEvaluatePlayerId(p.id))
      .slice()
      .sort((a, b) => {
        const an = a.number != null && a.number !== '' ? Number(a.number) : Number.POSITIVE_INFINITY;
        const bn = b.number != null && b.number !== '' ? Number(b.number) : Number.POSITIVE_INFINITY;
        if (an !== bn) return an - bn;
        return (a.name || '').localeCompare(b.name || '', 'ja');
      }),
    [filteredPlayers, evaluableInfo, forcedPlayer]
  );

  const playerIdx = evaluablePlayers.findIndex(p => p.id === selectedPlayer);
  const goPrevPlayer = () => { if (playerIdx > 0) setSelectedPlayer(evaluablePlayers[playerIdx - 1].id); };
  const goNextPlayer = () => { if (playerIdx >= 0 && playerIdx < evaluablePlayers.length - 1) setSelectedPlayer(evaluablePlayers[playerIdx + 1].id); };

  const roundIdx = rounds.findIndex(r => r.id === selectedRound);
  const goPrevRound = () => { if (roundIdx > 0) setSelectedRound(rounds[roundIdx - 1].id); };
  const goNextRound = () => { if (roundIdx >= 0 && roundIdx < rounds.length - 1) setSelectedRound(rounds[roundIdx + 1].id); };

  const selectedPlayerObj = mergedPlayers.find(p => p.id === selectedPlayer) || (isSelfEval && playerData ? playerData : null);

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
                <label className="block text-xs font-medium text-gray-600 mb-1">選手（背番号順）</label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={goPrevPlayer}
                    disabled={playerIdx <= 0}
                    className="px-2 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="前の選手"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <select
                    value={selectedPlayer}
                    onChange={(e) => setSelectedPlayer(e.target.value)}
                    className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">選択してください</option>
                    {evaluablePlayers.map(player => (
                      <option key={player.id} value={player.id}>
                        {player.number ? `#${player.number} ` : ''}{player.name}
                        {player.teamCategory ? ` (${player.teamCategory.name})` : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={goNextPlayer}
                    disabled={playerIdx < 0 || playerIdx >= evaluablePlayers.length - 1}
                    className="px-2 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="次の選手"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
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
            <label className="block text-xs font-medium text-gray-600 mb-1">評価期間（毎月自動）</label>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={goPrevRound}
                disabled={roundIdx <= 0}
                className="px-2 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
                title="前月"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <select
                value={selectedRound}
                onChange={(e) => setSelectedRound(e.target.value)}
                className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">選択してください</option>
                {rounds.map(round => (
                  <option key={round.id} value={round.id}>{round.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={goNextRound}
                disabled={roundIdx < 0 || roundIdx >= rounds.length - 1}
                className="px-2 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
                title="次月"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

      </div>

      {loading && (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      )}

      {!loading && selectedPlayer && selectedRound && items.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] flex items-center gap-1.5">
              {autoSaveStatus === 'saving' && (
                <span className="text-gray-500 inline-flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                  保存中…
                </span>
              )}
              {autoSaveStatus === 'saved' && (
                <span className="text-green-600 inline-flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  保存しました
                </span>
              )}
              {autoSaveStatus === 'error' && (
                <span className="text-red-600">保存に失敗しました</span>
              )}
              {!autoSaveStatus && (
                <span className="text-gray-400">入力すると自動保存されます</span>
              )}
            </div>
            {hasExistingEvals && (
              <button onClick={handleDelete} disabled={deleting} className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-600 border border-red-200 rounded text-xs font-medium hover:bg-red-100 disabled:opacity-50">
                <Trash2 className="w-3 h-3" />
                {deleting ? '...' : 'この期間の評価を削除'}
              </button>
            )}
          </div>

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
                    <th className="sticky left-0 z-10 bg-gray-50 border-b border-r border-gray-200 px-1 py-2 text-center font-semibold text-gray-700 min-w-[34px] w-[34px]">
                      <span style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }} className="inline-block tracking-wider">中分類</span>
                    </th>
                    <th className="sticky left-[34px] z-10 bg-gray-50 border-b border-r border-gray-200 px-2 py-2 text-left font-semibold text-gray-700 min-w-[120px] w-[120px]">評価項目</th>
                    {visibleHistoryRounds.map(r => (
                      <th key={r.id} className="border-b border-r border-gray-200 px-1 py-2 text-center font-medium text-gray-400 min-w-[52px] w-[52px] whitespace-nowrap">
                        {r.name.replace(/年/, '/').replace(/月/, '')}
                      </th>
                    ))}
                    <th className="border-b border-gray-200 px-1 py-2 text-center font-semibold text-primary-700 min-w-[64px] w-[64px] sm:min-w-[230px] sm:w-[230px] bg-primary-50 whitespace-nowrap">
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
                              <span className={clsx(
                                'text-[11px] ml-auto font-semibold',
                                totalLeaves > 0 && filledCount === totalLeaves ? 'text-gray-500' : 'text-red-600'
                              )}>
                                {totalLeaves > 0 && filledCount === totalLeaves
                                  ? '完了'
                                  : `${filledCount}/${totalLeaves} 入力`}
                              </span>
                            </div>
                          </td>
                        </tr>
                        {!isCollapsed && group.rows.map((row, ri) => (
                          <tr key={`${group.parent.id}_${ri}`} className="hover:bg-gray-50/50">
                            {row.isFirstChild && row.childName && (
                              <td
                                rowSpan={row.childRowSpan}
                                className="sticky left-0 z-10 bg-white border-b border-r border-gray-200 px-1 py-1.5 text-center align-middle text-gray-700 text-[11px] min-w-[34px] w-[34px]"
                              >
                                <span style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }} className="inline-block leading-tight tracking-wider">
                                  {row.childName}
                                </span>
                              </td>
                            )}
                            {row.isFirstChild && !row.childName && (
                              <td
                                rowSpan={row.childRowSpan || 1}
                                className="sticky left-0 z-10 bg-white border-b border-r border-gray-200 px-1 py-1.5 text-center align-middle text-gray-400 text-[11px] min-w-[34px] w-[34px]"
                              >
                                -
                              </td>
                            )}
                            <td className="sticky left-[34px] z-10 bg-white border-b border-r border-gray-200 px-2 py-1.5 text-gray-700 text-[11px]">
                              <div className="flex items-center gap-1">
                                <span className="truncate">{row.leaf.name}</span>
                                {row.leaf.description && (
                                  <button
                                    type="button"
                                    data-info-popover
                                    onClick={(e) => openInfoPopover(row.leaf.id, row.leaf.description, e)}
                                    className="text-gray-400 hover:text-primary-600 flex-shrink-0"
                                    aria-label="キーファクターを表示"
                                    title="キーファクターを表示"
                                  >
                                    <Info className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
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
                                <>
                                  <div className="hidden sm:flex items-center justify-center gap-0.5">
                                    {[1, 2, 3, 4, 5].map(n => {
                                      const selected = editScores[row.leaf.id] === n;
                                      return (
                                        <button
                                          key={n}
                                          type="button"
                                          onClick={() => handleScoreChange(row.leaf.id, selected ? '' : n)}
                                          className={clsx(
                                            'w-8 h-8 rounded text-[11px] font-bold transition-colors',
                                            selected
                                              ? getScoreButtonSelectedClass(n)
                                              : 'bg-white border border-gray-300 text-gray-500 hover:border-primary-400 hover:text-primary-600 active:bg-primary-50'
                                          )}
                                          aria-label={selected ? `${n}点 (タップで解除)` : `${n}点`}
                                          aria-pressed={selected}
                                        >
                                          {n}
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <button
                                    type="button"
                                    data-score-picker
                                    onClick={(e) => openScorePicker(row.leaf.id, e)}
                                    className={clsx(
                                      'sm:hidden inline-flex items-center justify-center w-12 h-9 rounded text-sm font-bold transition-colors',
                                      editScores[row.leaf.id]
                                        ? getScoreButtonSelectedClass(editScores[row.leaf.id])
                                        : 'bg-white border border-dashed border-gray-300 text-gray-400 active:bg-primary-50'
                                    )}
                                    aria-label="点数を選択"
                                  >
                                    {editScores[row.leaf.id] || '−'}
                                  </button>
                                </>
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

        </>
      )}

      {!loading && selectedPlayer && items.length === 0 && !selectedRound && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500">評価項目が設定されていません</p>
        </div>
      )}

      {openScoreId && createPortal(
        <div
          data-score-picker
          className="fixed z-[1000] flex flex-col gap-1 p-1.5 bg-white rounded-lg shadow-2xl border border-gray-200"
          style={{ top: scoreAnchor.top, left: scoreAnchor.left, width: 56 }}
          onClick={(e) => e.stopPropagation()}
        >
          {[5, 4, 3, 2, 1].map(n => {
            const selected = editScores[openScoreId] === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => { handleScoreChange(openScoreId, selected ? '' : n); setOpenScoreId(null); }}
                className={clsx(
                  'w-full h-10 rounded text-base font-bold transition-colors',
                  selected
                    ? getScoreButtonSelectedClass(n)
                    : 'bg-white border border-gray-300 text-gray-700 active:bg-primary-50'
                )}
                aria-label={`${n}点`}
                aria-pressed={selected}
              >
                {n}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => { handleScoreChange(openScoreId, ''); setOpenScoreId(null); }}
            className="w-full h-8 rounded text-xs text-gray-500 border border-gray-200 hover:bg-gray-50"
          >
            −
          </button>
        </div>,
        document.body
      )}

      {openInfoId && createPortal(
        <div
          data-info-popover
          className="fixed z-[1000] w-72 max-w-[calc(100vw-24px)] p-3 bg-white rounded-lg shadow-xl border border-gray-200 text-xs text-gray-700 leading-relaxed whitespace-pre-wrap"
          style={{ top: infoAnchor.top, left: infoAnchor.left }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="font-semibold text-gray-900 mb-1.5 flex items-center justify-between gap-2">
            <span>キーファクター</span>
            <button
              type="button"
              onClick={() => setOpenInfoId(null)}
              className="text-gray-400 hover:text-gray-600 flex-shrink-0"
              aria-label="閉じる"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="break-words">{infoText}</div>
        </div>,
        document.body
      )}
    </div>
  );
}
