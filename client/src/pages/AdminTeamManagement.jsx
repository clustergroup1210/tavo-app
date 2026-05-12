import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Users, ExternalLink, Search, Plus, X, MoreVertical, Pencil, Trash2, Upload, FileText, CheckCircle, AlertCircle, Download, Filter } from 'lucide-react';

export default function AdminTeamManagement() {
  const navigate = useNavigate();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [leagueFilter, setLeagueFilter] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamLeague, setNewTeamLeague] = useState('');
  const [newTeamRegion, setNewTeamRegion] = useState('');
  const [newTeamCode, setNewTeamCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);
  const [invitingTeamId, setInvitingTeamId] = useState(null);
  const [invitationModal, setInvitationModal] = useState(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [editTeamName, setEditTeamName] = useState('');
  const [editTeamLeague, setEditTeamLeague] = useState('');
  const [editTeamRegion, setEditTeamRegion] = useState('');
  const [editTeamCode, setEditTeamCode] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleteConfirmPassword, setDeleteConfirmPassword] = useState('');
  const menuRef = useRef(null);

  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult, setCsvResult] = useState(null);
  const [csvAnalyzing, setCsvAnalyzing] = useState(false);
  const [csvAnalysis, setCsvAnalysis] = useState(null);
  const [csvDecisions, setCsvDecisions] = useState({});
  const csvInputRef = useRef(null);

  const [suggestedParents, setSuggestedParents] = useState([]);
  const [selectedParentId, setSelectedParentId] = useState('');
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const [duplicateGroups, setDuplicateGroups] = useState([]);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeSelections, setMergeSelections] = useState({});
  const [mergeProcessing, setMergeProcessing] = useState(false);
  const [mergeResultMessage, setMergeResultMessage] = useState('');

  useEffect(() => {
    fetchTeams();
    fetchDuplicateGroups();
  }, []);

  const fetchDuplicateGroups = async () => {
    try {
      const res = await fetch('/api/admin/teams/duplicate-groups', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setDuplicateGroups(data.groups || []);
      }
    } catch (err) {
      console.error('Failed to fetch duplicate groups:', err);
    }
  };

  const openMergeModal = () => {
    const initial = {};
    for (const g of duplicateGroups) {
      initial[g.baseName] = { parentId: '', childIds: new Set() };
    }
    setMergeSelections(initial);
    setMergeResultMessage('');
    setShowMergeModal(true);
  };

  const getMergePlanSummary = () => {
    const items = [];
    for (const g of duplicateGroups) {
      const sel = mergeSelections[g.baseName];
      if (!sel || !sel.parentId || sel.childIds.size === 0) continue;
      const parent = g.teams.find(t => t.id === sel.parentId);
      const children = g.teams.filter(t => sel.childIds.has(t.id));
      if (parent && children.length) items.push({ parent, children });
    }
    return items;
  };

  const handleMergeExecute = async () => {
    const plan = getMergePlanSummary();
    if (plan.length === 0) {
      setMergeResultMessage('統合対象を選択してください（親と統合先のサブチームの両方）');
      return;
    }
    const totalChildren = plan.reduce((s, p) => s + p.children.length, 0);
    const summary = plan.map(p => `・${p.parent.name} に「${p.children.map(c => c.name).join('」「')}」を統合`).join('\n');
    if (!window.confirm(`${plan.length}グループ・${totalChildren}件のサブチーム統合を実行します。よろしいですか？\n\n${summary}`)) {
      return;
    }
    setMergeProcessing(true);
    setMergeResultMessage('');
    let totalMerged = 0;
    const errors = [];
    try {
      for (const g of duplicateGroups) {
        const sel = mergeSelections[g.baseName];
        if (!sel || !sel.parentId || sel.childIds.size === 0) continue;
        const res = await fetch('/api/admin/teams/merge-as-children', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ parentId: sel.parentId, childIds: Array.from(sel.childIds) }),
        });
        if (res.ok) {
          const data = await res.json();
          totalMerged += data.merged || 0;
          if (data.errors?.length > 0) errors.push(...data.errors);
        } else {
          const data = await res.json().catch(() => ({}));
          errors.push({ group: g.baseName, reason: data.error || '統合に失敗しました' });
        }
      }
      setMergeResultMessage(
        `${totalMerged}件のチームをサブチームとして統合しました${errors.length > 0 ? `（${errors.length}件のエラー）` : ''}`
      );
      await fetchTeams();
      await fetchDuplicateGroups();
    } catch (err) {
      setMergeResultMessage('統合処理中にエラーが発生しました');
    } finally {
      setMergeProcessing(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!showCreateModal) return;
    const name = newTeamName.trim();
    if (name.length < 2) {
      setSuggestedParents([]);
      return;
    }
    setLoadingSuggestions(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/teams/suggestions?name=${encodeURIComponent(name)}`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setSuggestedParents(data.candidates || []);
          if (selectedParentId && !(data.candidates || []).some(c => c.id === selectedParentId)) {
            setSelectedParentId('');
          }
        }
      } catch (err) {
        console.error('Failed to fetch suggestions:', err);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [newTeamName, showCreateModal]);

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setError('');
    setNewTeamName('');
    setNewTeamLeague('');
    setNewTeamRegion('');
    setNewTeamCode('');
    setSuggestedParents([]);
    setSelectedParentId('');
  };

  const handleAuthError = () => {
    setError('セッションの有効期限が切れました。再度ログインしてください。');
    setTimeout(() => {
      navigate('/login');
    }, 1500);
  };

  const fetchTeams = async () => {
    try {
      const res = await fetch('/api/admin/teams', { credentials: 'include' });
      if (res.status === 401) {
        handleAuthError();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setTeams(data);
      }
    } catch (error) {
      console.error('Failed to fetch teams:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: newTeamName,
          league: newTeamLeague || undefined,
          region: newTeamRegion || undefined,
          parentId: selectedParentId || undefined,
          teamCode: newTeamCode.trim() || undefined,
        }),
      });
      if (res.status === 401) {
        handleAuthError();
        return;
      }
      if (res.ok) {
        setNewTeamName('');
        setNewTeamLeague('');
        setNewTeamRegion('');
        setShowCreateModal(false);
        fetchTeams();
      } else {
        const data = await res.json();
        setError(data.error || 'チームの作成に失敗しました');
      }
    } catch (error) {
      setError('チームの作成に失敗しました');
    } finally {
      setCreating(false);
    }
  };

  const handleViewTeamDashboard = (teamId) => {
    navigate(`/admin/teams/${teamId}/dashboard`);
  };

  const handleEditClick = (team) => {
    setSelectedTeam(team);
    setEditTeamName(team.name);
    setEditTeamLeague(team.league || '');
    setEditTeamRegion(team.region || '');
    setEditTeamCode(team.teamCode || '');
    setShowEditModal(true);
    setOpenMenuId(null);
  };

  const handleDeleteClick = (team) => {
    setSelectedTeam(team);
    setShowDeleteModal(true);
    setOpenMenuId(null);
    setError('');
    setDeleteConfirmPassword('');
  };

  const handleEditTeam = async (e) => {
    e.preventDefault();
    setError('');
    setEditing(true);
    try {
      const res = await fetch(`/api/admin/teams/${selectedTeam.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: editTeamName, league: editTeamLeague, region: editTeamRegion, ...(editTeamCode.trim() ? { teamCode: editTeamCode.trim() } : {}) }),
      });
      if (res.status === 401) {
        handleAuthError();
        return;
      }
      if (res.ok) {
        setShowEditModal(false);
        setSelectedTeam(null);
        fetchTeams();
      } else {
        const data = await res.json();
        setError(data.error || 'チームの更新に失敗しました');
      }
    } catch (error) {
      setError('チームの更新に失敗しました');
    } finally {
      setEditing(false);
    }
  };

  const handleDeleteTeam = async () => {
    setError('');
    if (!deleteConfirmPassword) {
      setError('パスワードを入力してください');
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/teams/${selectedTeam.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ confirmPassword: deleteConfirmPassword }),
      });
      if (res.status === 401) {
        handleAuthError();
        return;
      }
      if (res.ok) {
        setShowDeleteModal(false);
        setSelectedTeam(null);
        setDeleteConfirmPassword('');
        fetchTeams();
      } else {
        const data = await res.json();
        setError(data.error || 'チームの削除に失敗しました');
      }
    } catch (error) {
      setError('チームの削除に失敗しました');
    } finally {
      setDeleting(false);
    }
  };

  const handleCreateInvitation = async (team) => {
    setOpenMenuId(null);
    setInvitingTeamId(team.id);
    try {
      const res = await fetch(`/api/admin/teams/${team.id}/invitation`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.status === 401) {
        handleAuthError();
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '招待リンクの作成に失敗しました');
      const fullUrl = `${window.location.origin}${data.url}`;
      setInvitationModal({ team, url: fullUrl, expiresAt: data.expiresAt });
      setCopiedUrl(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setInvitingTeamId(null);
    }
  };

  const handleCopyInvitationUrl = async () => {
    if (!invitationModal) return;
    try {
      await navigator.clipboard.writeText(invitationModal.url);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const handleCsvAnalyze = async (file) => {
    if (!file) return;
    setCsvAnalyzing(true);
    setCsvAnalysis(null);
    setCsvResult(null);
    setCsvDecisions({});
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/admin/teams/import-csv/analyze', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (res.status === 401) {
        handleAuthError();
        return;
      }
      const data = await res.json();
      if (res.ok) {
        setCsvAnalysis(data);
        const initial = {};
        for (const r of data.rows || []) {
          if (r.status === 'merge_candidate' && r.candidates?.length > 0) {
            initial[r.rowNumber] = r.candidates[0].id;
          }
        }
        setCsvDecisions(initial);
      } else {
        setCsvResult({ type: 'error', message: data.error || 'CSV解析に失敗しました', details: data.details });
      }
    } catch (err) {
      setCsvResult({ type: 'error', message: 'CSV解析に失敗しました' });
    } finally {
      setCsvAnalyzing(false);
    }
  };

  const handleCsvImport = async () => {
    if (!csvFile) return;
    setCsvImporting(true);
    setCsvResult(null);
    try {
      const formData = new FormData();
      formData.append('file', csvFile);
      formData.append('mergeDecisions', JSON.stringify(csvDecisions));
      const res = await fetch('/api/admin/teams/import-csv', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (res.status === 401) {
        handleAuthError();
        return;
      }
      const data = await res.json();
      if (res.ok) {
        setCsvResult({ type: 'success', ...data });
        setCsvAnalysis(null);
        if (data.success > 0 || data.updated > 0) {
          fetchTeams();
        }
      } else {
        setCsvResult({ type: 'error', message: data.error || 'インポートに失敗しました', details: data.details });
      }
    } catch (err) {
      setCsvResult({ type: 'error', message: 'インポートに失敗しました' });
    } finally {
      setCsvImporting(false);
    }
  };

  const closeCsvModal = () => {
    setShowCsvModal(false);
    setCsvFile(null);
    setCsvResult(null);
    setCsvAnalysis(null);
    setCsvDecisions({});
  };

  const handleDownloadTemplate = () => {
    const bom = '\uFEFF';
    const csv = bom + 'name,region,teamCode\nサンプルチームA,東京都,FCV-U15\nサンプルチームB,大阪府,\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'teams_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const uniqueLeagues = useMemo(() => {
    const set = new Set(teams.map(t => t.league).filter(Boolean));
    return [...set].sort();
  }, [teams]);

  const uniqueRegions = useMemo(() => {
    const set = new Set(teams.map(t => t.region).filter(Boolean));
    return [...set].sort();
  }, [teams]);

  const filteredTeams = teams.filter(team => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = team.name.toLowerCase().includes(q) ||
      team.teamCode?.toLowerCase().includes(q) ||
      team.representativeName?.toLowerCase().includes(q) ||
      team.league?.toLowerCase().includes(q) ||
      team.region?.toLowerCase().includes(q);
    const matchesLeague = !leagueFilter || team.league === leagueFilter;
    const matchesRegion = !regionFilter || team.region === regionFilter;
    return matchesSearch && matchesLeague && matchesRegion;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">チーム管理</h1>
          <p className="mt-1 text-sm text-gray-500">全チームの管理と監視</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {duplicateGroups.length > 0 && (
            <button
              onClick={openMergeModal}
              className="relative flex items-center gap-2 px-3 sm:px-4 py-2 bg-amber-50 border border-amber-300 text-amber-800 rounded-lg hover:bg-amber-100 transition-colors text-sm whitespace-nowrap"
              title="登録済みチームから類似名のものを統合"
            >
              <AlertCircle className="w-4 h-4" />
              <span className="hidden sm:inline">重複候補を統合</span>
              <span className="sm:hidden">統合</span>
              <span className="ml-1 px-1.5 py-0.5 bg-amber-600 text-white text-xs rounded-full">{duplicateGroups.length}</span>
            </button>
          )}
          <button
            onClick={() => { setShowCsvModal(true); setCsvFile(null); setCsvResult(null); }}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm whitespace-nowrap"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">CSV一括登録</span>
            <span className="sm:hidden">CSV</span>
          </button>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm sm:text-base whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">新規チーム作成</span>
            <span className="sm:hidden">新規</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900">チーム一覧</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="チーム名・ID・代表者・リーグ・地域で検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full sm:w-auto pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
            {(uniqueLeagues.length > 0 || uniqueRegions.length > 0) && (
              <div className="flex flex-wrap items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                {uniqueLeagues.length > 0 && (
                  <select
                    value={leagueFilter}
                    onChange={(e) => setLeagueFilter(e.target.value)}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">すべてのリーグ</option>
                    {uniqueLeagues.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                )}
                {uniqueRegions.length > 0 && (
                  <select
                    value={regionFilter}
                    onChange={(e) => setRegionFilter(e.target.value)}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">すべての地域</option>
                    {uniqueRegions.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                )}
                {(leagueFilter || regionFilter) && (
                  <button
                    onClick={() => { setLeagueFilter(''); setRegionFilter(''); }}
                    className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                  >
                    フィルター解除
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                  チーム名
                </th>
                <th className="px-2 py-2 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider w-20">
                  状態
                </th>
                <th className="px-2 py-2 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                  リーグ
                </th>
                <th className="px-2 py-2 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                  拠点
                </th>
                <th className="px-2 py-2 text-right text-[11px] font-medium text-gray-500 uppercase tracking-wider w-16">
                  選手
                </th>
                <th className="px-2 py-2 text-right text-[11px] font-medium text-gray-500 uppercase tracking-wider w-20">
                  カテゴリ
                </th>
                <th className="px-3 py-2 text-right text-[11px] font-medium text-gray-500 uppercase tracking-wider w-32">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredTeams.length > 0 ? (
                filteredTeams.map((team) => (
                  <tr key={team.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {team.logoUrl ? (
                          <img
                            src={team.logoUrl}
                            alt=""
                            className="w-7 h-7 rounded object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-4 h-4 text-gray-400" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 text-sm truncate">{team.name}</p>
                          <div className="flex items-center gap-1.5 text-[10px]">
                            {team.teamCode && (
                              <span className="font-mono text-gray-700 bg-gray-100 px-1 py-px rounded">{team.teamCode}</span>
                            )}
                            <span className="text-gray-500 truncate">{team.organization?.name}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      {team.status === 'PENDING' ? (
                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px] font-medium">仮登録</span>
                      ) : (
                        <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-medium">本登録</span>
                      )}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap text-gray-600">
                      {team.league ? (
                        <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px]">{team.league}</span>
                      ) : <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap text-gray-600">
                      {team.region ? (
                        <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-[10px]">{team.region}</span>
                      ) : <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap text-right text-gray-600 tabular-nums">
                      {team.playerCount || 0}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap text-right text-gray-600 tabular-nums">
                      {team.categoryCount || 0}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleViewTeamDashboard(team.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-primary-50 text-primary-700 rounded hover:bg-primary-100 transition-colors text-[11px] font-medium"
                          title="管理画面を開く"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          管理
                        </button>
                        <div className="relative" ref={openMenuId === team.id ? menuRef : null}>
                          <button
                            onClick={() => setOpenMenuId(openMenuId === team.id ? null : team.id)}
                            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {openMenuId === team.id && (
                            <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                              {team.status === 'PENDING' && (
                                <button
                                  onClick={() => handleCreateInvitation(team)}
                                  disabled={invitingTeamId === team.id}
                                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                  招待リンク発行
                                </button>
                              )}
                              <button
                                onClick={() => handleEditClick(team)}
                                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                              >
                                <Pencil className="w-4 h-4" />
                                編集
                              </button>
                              <button
                                onClick={() => handleDeleteClick(team)}
                                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                                削除
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    チームが見つかりません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="md:hidden divide-y divide-gray-200">
          {filteredTeams.length > 0 ? (
            filteredTeams.map((team) => (
              <div key={team.id} className="p-4">
                <div className="flex items-start gap-3">
                  {team.logoUrl ? (
                    <img src={team.logoUrl} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{team.name}</p>
                    <div className="flex items-center gap-2 text-xs">
                      {team.teamCode && (
                        <span className="font-mono text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">{team.teamCode}</span>
                      )}
                      <span className="text-gray-500 truncate">{team.organization?.name}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {team.status === 'PENDING' ? (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-xs font-medium">仮登録</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-xs font-medium">本登録</span>
                      )}
                      {team.league && (
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">{team.league}</span>
                      )}
                      {team.region && (
                        <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs">{team.region}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-gray-500">
                      <span>選手: {team.playerCount || 0}人</span>
                      <span>カテゴリー: {team.categoryCount || 0}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3 pl-[52px]">
                  <button
                    onClick={() => handleViewTeamDashboard(team.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 text-xs font-medium"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    管理画面
                  </button>
                  <button
                    onClick={() => handleEditClick(team)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 text-xs font-medium"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    編集
                  </button>
                  <button
                    onClick={() => handleDeleteClick(team)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-xs font-medium"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    削除
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="px-4 py-12 text-center text-gray-500">
              チームが見つかりません
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">新規チーム作成</h2>
              <button
                onClick={closeCreateModal}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
            <form onSubmit={handleCreateTeam}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">チーム名 *</label>
                  <input
                    type="text"
                    placeholder="チーム名を入力"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">チームID</label>
                  <input
                    type="text"
                    placeholder="例: FCV-U15（未入力の場合は自動採番）"
                    value={newTeamCode}
                    onChange={(e) => setNewTeamCode(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono text-sm"
                    maxLength={32}
                  />
                  <p className="mt-1 text-xs text-gray-500">半角英数・ハイフン・アンダースコアで2〜32文字。空欄なら自動採番（T-XXXXXX）。</p>
                </div>

                {suggestedParents.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <div className="flex items-start gap-2 mb-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-amber-900">
                        似た名前のチームが見つかりました。<br />
                        <span className="text-xs text-amber-800">同じチームの別カテゴリとして登録すると、サブチームとしてまとめて管理できます。</span>
                      </div>
                    </div>
                    <div className="space-y-1.5 mt-2">
                      <label className="flex items-start gap-2 text-sm cursor-pointer">
                        <input
                          type="radio"
                          name="parentChoice"
                          value=""
                          checked={selectedParentId === ''}
                          onChange={() => setSelectedParentId('')}
                          className="mt-0.5"
                        />
                        <span className="text-gray-800">別チームとして登録（既定）</span>
                      </label>
                      {suggestedParents.map(c => (
                        <label key={c.id} className="flex items-start gap-2 text-sm cursor-pointer">
                          <input
                            type="radio"
                            name="parentChoice"
                            value={c.id}
                            checked={selectedParentId === c.id}
                            onChange={() => setSelectedParentId(c.id)}
                            className="mt-0.5"
                          />
                          <span className="text-gray-800">
                            <span className="font-medium">{c.name}</span> の別カテゴリ
                            {c.suggestedCategoryName && (
                              <span className="ml-1 inline-block px-1.5 py-0.5 text-xs bg-amber-100 text-amber-800 rounded">
                                {c.suggestedCategoryName}
                              </span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {loadingSuggestions && newTeamName.trim().length >= 2 && suggestedParents.length === 0 && (
                  <p className="text-xs text-gray-400">類似チームを確認中...</p>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">リーグ</label>
                  <input
                    type="text"
                    placeholder="例: 関東リーグ"
                    value={newTeamLeague}
                    onChange={(e) => setNewTeamLeague(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">拠点地域</label>
                  <input
                    type="text"
                    placeholder="例: 東京都"
                    value={newTeamRegion}
                    onChange={(e) => setNewTeamRegion(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {creating ? '作成中...' : (selectedParentId ? 'サブチームとして作成' : '作成')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && selectedTeam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">チーム情報を編集</h2>
              <button 
                onClick={() => { setShowEditModal(false); setError(''); setSelectedTeam(null); }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
            <form onSubmit={handleEditTeam}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">チーム名 *</label>
                  <input
                    type="text"
                    value={editTeamName}
                    onChange={(e) => setEditTeamName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">チームID</label>
                  <input
                    type="text"
                    value={editTeamCode}
                    onChange={(e) => setEditTeamCode(e.target.value)}
                    placeholder="例: FCV-U15"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono text-sm"
                    maxLength={32}
                  />
                  <p className="mt-1 text-xs text-gray-500">半角英数・ハイフン・アンダースコアで2〜32文字。</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">リーグ</label>
                  <input
                    type="text"
                    value={editTeamLeague}
                    onChange={(e) => setEditTeamLeague(e.target.value)}
                    placeholder="例: 関東リーグ"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">拠点地域</label>
                  <input
                    type="text"
                    value={editTeamRegion}
                    onChange={(e) => setEditTeamRegion(e.target.value)}
                    placeholder="例: 東京都"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setError(''); setSelectedTeam(null); }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={editing}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {editing ? '保存中...' : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && selectedTeam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-red-600">チームを削除</h2>
              <button 
                onClick={() => { setShowDeleteModal(false); setError(''); setSelectedTeam(null); setDeleteConfirmPassword(''); }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 mb-4">{error}</p>}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-amber-800">
                <span className="font-semibold">{selectedTeam.name}</span> を削除しようとしています。この操作は取り消せません。関連する全てのデータ（評価項目、カレンダー、お知らせ等）も削除されます。
              </p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                削除を確認するため、ログイン中のアカウントのパスワードを入力してください
              </label>
              <input
                type="password"
                value={deleteConfirmPassword}
                onChange={(e) => setDeleteConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                placeholder="パスワード"
                autoComplete="off"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setShowDeleteModal(false); setError(''); setSelectedTeam(null); setDeleteConfirmPassword(''); }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                キャンセル
              </button>
              <button
                onClick={handleDeleteTeam}
                disabled={deleting || !deleteConfirmPassword}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? '削除中...' : '削除する'}
              </button>
            </div>
          </div>
        </div>
      )}
      {invitationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <ExternalLink className="w-5 h-5 text-amber-600" />
                チーム招待リンク
              </h3>
              <button onClick={() => setInvitationModal(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-800">
              <p className="font-medium mb-1">{invitationModal.team.name}</p>
              <p className="text-xs">このリンクをチーム代表者にお渡しください。代表者がアカウントを作成すると、チームが本登録状態になり、選手登録などが可能になります。</p>
            </div>

            <label className="block text-sm font-medium text-gray-700 mb-1">招待URL</label>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={invitationModal.url}
                readOnly
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono bg-gray-50"
                onFocus={(e) => e.target.select()}
              />
              <button
                onClick={handleCopyInvitationUrl}
                className={`px-4 py-2 rounded-lg font-medium text-sm ${copiedUrl ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
              >
                {copiedUrl ? 'コピー済み' : 'コピー'}
              </button>
            </div>
            <p className="text-xs text-gray-500">
              有効期限: {new Date(invitationModal.expiresAt).toLocaleString('ja-JP')}
            </p>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setInvitationModal(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
      {showCsvModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Upload className="w-5 h-5 text-primary-600" />
                CSV一括登録
              </h3>
              <button onClick={() => setShowCsvModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-700">
              <p className="font-medium mb-1">CSVフォーマット</p>
              <p>以下のヘッダー形式でCSVファイルを作成してください：</p>
              <code className="block mt-1 bg-blue-100 px-2 py-1 rounded text-xs font-mono">name,region,teamCode</code>
              <p className="mt-1 text-xs text-blue-600">※「name/team/チーム名」「region/拠点地域/地域」「teamCode/チームID/コード」ヘッダーに対応。teamCode列は省略可（空欄なら自動採番）。文字コードはUTF-8で保存してください。</p>
            </div>

            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 mb-4"
            >
              <Download className="w-4 h-4" />
              テンプレートCSVをダウンロード
            </button>

            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50/30 transition mb-4"
              onClick={() => csvInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
                  setCsvFile(file);
                  setCsvResult(null);
                  handleCsvAnalyze(file);
                }
              }}
            >
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setCsvFile(file);
                  setCsvResult(null);
                  if (file) handleCsvAnalyze(file);
                }}
              />
              {csvFile ? (
                <div className="flex items-center justify-center gap-2">
                  <FileText className="w-6 h-6 text-primary-600" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-900">{csvFile.name}</p>
                    <p className="text-xs text-gray-500">{(csvFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setCsvFile(null); setCsvResult(null); setCsvAnalysis(null); setCsvDecisions({}); }}
                    className="ml-2 p-1 hover:bg-gray-100 rounded"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              ) : (
                <div>
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">クリックまたはドラッグ＆ドロップでCSVファイルを選択</p>
                  <p className="text-xs text-gray-400 mt-1">.csv形式のファイルのみ</p>
                </div>
              )}
            </div>

            {csvAnalyzing && (
              <div className="rounded-lg p-3 mb-4 bg-gray-50 border border-gray-200 flex items-center gap-2 text-sm text-gray-600">
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                CSVを解析しています...
              </div>
            )}

            {csvAnalysis && csvAnalysis.rows && csvAnalysis.rows.length > 0 && !csvResult && (
              <div className="rounded-lg border border-gray-200 mb-4 overflow-hidden">
                <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-sm font-medium text-gray-700">
                  プレビュー（全{csvAnalysis.rows.length}件）
                  {(() => {
                    const mc = csvAnalysis.rows.filter(r => r.status === 'merge_candidate').length;
                    return mc > 0 ? (
                      <span className="ml-2 text-xs text-amber-700">類似チームの候補: {mc}件</span>
                    ) : null;
                  })()}
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
                  {csvAnalysis.rows.map(row => {
                    const decision = csvDecisions[row.rowNumber];
                    const isMerge = decision && decision !== 'new' && decision !== 'skip';
                    return (
                      <div key={row.rowNumber} className="p-3 text-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-gray-900 truncate">{row.name}</p>
                              {row.teamCode && (
                                <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${row.codeConflict ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                                  {row.teamCode}
                                </span>
                              )}
                              {row.status === 'update' && row.existingTeamCode && !row.teamCode && (
                                <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-gray-50 text-gray-500">{row.existingTeamCode}</span>
                              )}
                            </div>
                            {row.codeConflict && (
                              <p className="text-xs text-red-600 mt-0.5">
                                {row.codeConflict.duplicateInCsv
                                  ? `※ チームID「${row.teamCode}」がCSV内で重複しています`
                                  : `※ チームID「${row.teamCode}」は既に${row.codeConflict.sameOrg === false ? '別の組織の' : ''}「${row.codeConflict.teamName}」が使用中です`}
                              </p>
                            )}
                            <p className="text-xs text-gray-500">
                              {row.status === 'update' && '既存チームを更新'}
                              {row.status === 'new' && !isMerge && '新規チームとして登録'}
                              {row.status === 'merge_candidate' && !isMerge && '新規チームとして登録'}
                              {isMerge && (() => {
                                const c = row.candidates.find(x => x.id === decision);
                                return c ? `「${c.name}」のサブチームとして登録` : 'サブチームとして登録';
                              })()}
                              {decision === 'skip' && 'スキップ'}
                            </p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded flex-shrink-0 ${
                            row.status === 'update' ? 'bg-blue-100 text-blue-700' :
                            isMerge ? 'bg-amber-100 text-amber-700' :
                            decision === 'skip' ? 'bg-gray-100 text-gray-600' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {row.status === 'update' ? '更新' :
                              isMerge ? 'サブチーム' :
                              decision === 'skip' ? 'スキップ' : '新規'}
                          </span>
                        </div>
                        {row.status === 'merge_candidate' && row.candidates?.length > 0 && (
                          <div className="mt-2 ml-1 space-y-1">
                            <p className="text-xs text-amber-700">類似チームが見つかりました：</p>
                            <label className="flex items-center gap-2 text-xs cursor-pointer">
                              <input
                                type="radio"
                                name={`row-${row.rowNumber}`}
                                checked={decision === 'new'}
                                onChange={() => setCsvDecisions(d => ({ ...d, [row.rowNumber]: 'new' }))}
                              />
                              <span>別チームとして登録</span>
                            </label>
                            {row.candidates.map(c => (
                              <label key={c.id} className="flex items-center gap-2 text-xs cursor-pointer">
                                <input
                                  type="radio"
                                  name={`row-${row.rowNumber}`}
                                  checked={decision === c.id}
                                  onChange={() => setCsvDecisions(d => ({ ...d, [row.rowNumber]: c.id }))}
                                />
                                <span>
                                  <span className="font-medium">{c.name}</span> の別カテゴリ
                                  {c.suggestedCategoryName && (
                                    <span className="ml-1 px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded">{c.suggestedCategoryName}</span>
                                  )}
                                </span>
                              </label>
                            ))}
                            <label className="flex items-center gap-2 text-xs cursor-pointer text-gray-500">
                              <input
                                type="radio"
                                name={`row-${row.rowNumber}`}
                                checked={decision === 'skip'}
                                onChange={() => setCsvDecisions(d => ({ ...d, [row.rowNumber]: 'skip' }))}
                              />
                              <span>この行をスキップ</span>
                            </label>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {csvAnalysis.skipped?.length > 0 && (
                  <div className="px-3 py-2 bg-amber-50 border-t border-amber-200 text-xs text-amber-700">
                    スキップ: {csvAnalysis.skipped.length}件（{csvAnalysis.skipped.slice(0, 3).map(s => `行${s.row}: ${s.reason}`).join(', ')}{csvAnalysis.skipped.length > 3 ? '...' : ''}）
                  </div>
                )}
              </div>
            )}

            {csvResult && (
              <div className={`rounded-lg p-4 mb-4 ${csvResult.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                {csvResult.type === 'success' ? (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <p className="font-medium text-green-800">{csvResult.message}</p>
                    </div>
                    <div className="text-sm text-green-700 space-y-0.5">
                      <p>全{csvResult.total}行中: 新規登録 {csvResult.success}件 / 更新 {csvResult.updated || 0}件 / スキップ {csvResult.skipped}件</p>
                    </div>
                    {csvResult.errors?.length > 0 && (
                      <div className="mt-2 text-xs text-amber-700 bg-amber-50 rounded p-2 max-h-32 overflow-y-auto">
                        {csvResult.errors.map((err, idx) => (
                          <p key={idx}>{err.row > 0 ? `行${err.row}: ` : ''}{err.reason}</p>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <AlertCircle className="w-5 h-5 text-red-600" />
                      <p className="font-medium text-red-800">{csvResult.message}</p>
                    </div>
                    {csvResult.details && (
                      <div className="text-xs text-red-600 mt-1">
                        {csvResult.details.map((d, idx) => <p key={idx}>{d}</p>)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={closeCsvModal}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                閉じる
              </button>
              <button
                onClick={handleCsvImport}
                disabled={!csvFile || csvImporting || csvAnalyzing || !!csvResult}
                className="flex items-center gap-2 px-5 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition"
              >
                {csvImporting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    インポート中...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    インポート実行
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showMergeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                重複候補を統合
              </h3>
              <button onClick={() => setShowMergeModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-800">
              名前が似ているチームが見つかりました。親チームを選び、サブチームとして統合したいチームにチェックを入れてください。
              <p className="text-xs mt-1 text-amber-700">※ サブチームを既に持つチームや、別組織のチームは統合できません。</p>
            </div>

            {duplicateGroups.length === 0 ? (
              <p className="text-sm text-gray-500">統合候補は見つかりませんでした。</p>
            ) : (
              <div className="space-y-4">
                {duplicateGroups.map(g => {
                  const sel = mergeSelections[g.baseName] || { parentId: '', childIds: new Set() };
                  return (
                    <div key={g.baseName} className="border border-gray-200 rounded-lg p-3">
                      <p className="text-sm font-medium text-gray-900 mb-2">
                        ベース名: <span className="text-amber-700">{g.baseName}</span>
                        <span className="ml-2 text-xs text-gray-500">{g.teams.length}件</span>
                      </p>
                      <div className="space-y-2">
                        {g.teams.map(t => {
                          const isParent = sel.parentId === t.id;
                          const isChild = sel.childIds.has(t.id);
                          const cannotBeChild = t.childCount > 0;
                          return (
                            <div key={t.id} className="flex items-center justify-between gap-3 py-1.5 border-b last:border-b-0 border-gray-100">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {t.name}
                                  {t.suggestedCategoryName && (
                                    <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-100 text-gray-700 rounded">{t.suggestedCategoryName}</span>
                                  )}
                                </p>
                                <p className="text-xs text-gray-500">
                                  選手 {t.playerCount}名 / サブチーム {t.childCount}件
                                  {t.region && ` / ${t.region}`}
                                </p>
                              </div>
                              <div className="flex items-center gap-3 flex-shrink-0">
                                <label className="flex items-center gap-1 text-xs cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`parent-${g.baseName}`}
                                    checked={isParent}
                                    onChange={() => setMergeSelections(prev => {
                                      const next = { ...prev };
                                      const newChildIds = new Set(prev[g.baseName]?.childIds || []);
                                      newChildIds.delete(t.id);
                                      next[g.baseName] = { parentId: t.id, childIds: newChildIds };
                                      return next;
                                    })}
                                  />
                                  <span>親</span>
                                </label>
                                <label className={`flex items-center gap-1 text-xs ${cannotBeChild || isParent ? 'text-gray-300 cursor-not-allowed' : 'cursor-pointer'}`}>
                                  <input
                                    type="checkbox"
                                    disabled={cannotBeChild || isParent}
                                    checked={isChild}
                                    onChange={(e) => setMergeSelections(prev => {
                                      const next = { ...prev };
                                      const newChildIds = new Set(prev[g.baseName]?.childIds || []);
                                      if (e.target.checked) newChildIds.add(t.id);
                                      else newChildIds.delete(t.id);
                                      next[g.baseName] = { parentId: prev[g.baseName]?.parentId || '', childIds: newChildIds };
                                      return next;
                                    })}
                                  />
                                  <span>サブチームとして統合</span>
                                </label>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {mergeResultMessage && (
              <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
                {mergeResultMessage}
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowMergeModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                閉じる
              </button>
              <button
                onClick={handleMergeExecute}
                disabled={mergeProcessing || duplicateGroups.length === 0}
                className="px-5 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
              >
                {mergeProcessing ? '統合中...' : '統合実行'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
