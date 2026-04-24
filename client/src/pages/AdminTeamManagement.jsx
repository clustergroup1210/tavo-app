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
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [editTeamName, setEditTeamName] = useState('');
  const [editTeamLeague, setEditTeamLeague] = useState('');
  const [editTeamRegion, setEditTeamRegion] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleteConfirmPassword, setDeleteConfirmPassword] = useState('');
  const menuRef = useRef(null);

  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult, setCsvResult] = useState(null);
  const csvInputRef = useRef(null);

  useEffect(() => {
    fetchTeams();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchTeams = async () => {
    try {
      const res = await fetch('/api/admin/teams', { credentials: 'include' });
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
        body: JSON.stringify({ name: newTeamName, league: newTeamLeague || undefined, region: newTeamRegion || undefined }),
      });
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
        body: JSON.stringify({ name: editTeamName, league: editTeamLeague, region: editTeamRegion }),
      });
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

  const handleCsvImport = async () => {
    if (!csvFile) return;
    setCsvImporting(true);
    setCsvResult(null);
    try {
      const formData = new FormData();
      formData.append('file', csvFile);
      const res = await fetch('/api/admin/teams/import-csv', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setCsvResult({ type: 'success', ...data });
        if (data.success > 0) {
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

  const handleDownloadTemplate = () => {
    const bom = '\uFEFF';
    const csv = bom + 'name,description,league,region\nサンプルチームA,U-12カテゴリー,関東リーグ,東京都\nサンプルチームB,U-15カテゴリー,関西リーグ,大阪府\n';
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
    const matchesSearch = team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      team.representativeName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      team.league?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      team.region?.toLowerCase().includes(searchQuery.toLowerCase());
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
                  placeholder="チームを検索..."
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
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  チーム名
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  リーグ
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  拠点地域
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  選手数
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  カテゴリー数
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredTeams.length > 0 ? (
                filteredTeams.map((team) => (
                  <tr key={team.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        {team.logoUrl ? (
                          <img
                            src={team.logoUrl}
                            alt=""
                            className="w-10 h-10 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-gray-400" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-900">{team.name}</p>
                          <p className="text-sm text-gray-500">{team.organization?.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {team.league ? (
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">{team.league}</span>
                      ) : <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {team.region ? (
                        <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs">{team.region}</span>
                      ) : <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {team.playerCount || 0}人
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {team.categoryCount || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleViewTeamDashboard(team.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 transition-colors text-sm font-medium"
                        >
                          <ExternalLink className="w-4 h-4" />
                          管理画面
                        </button>
                        <div className="relative" ref={openMenuId === team.id ? menuRef : null}>
                          <button
                            onClick={() => setOpenMenuId(openMenuId === team.id ? null : team.id)}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {openMenuId === team.id && (
                            <div className="absolute right-0 mt-1 w-36 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
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
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
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
                    <p className="text-xs text-gray-500">{team.organization?.name}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
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
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">新規チーム作成</h2>
              <button 
                onClick={() => { setShowCreateModal(false); setError(''); }}
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
                  onClick={() => { setShowCreateModal(false); setError(''); }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {creating ? '作成中...' : '作成'}
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
              <code className="block mt-1 bg-blue-100 px-2 py-1 rounded text-xs font-mono">name,description,league,region</code>
              <p className="mt-1 text-xs text-blue-600">※「name/team/チーム名」「league/リーグ」「region/拠点地域/地域」ヘッダーに対応。文字コードはUTF-8で保存してください。</p>
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
                }
              }}
            >
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  setCsvFile(e.target.files?.[0] || null);
                  setCsvResult(null);
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
                    onClick={(e) => { e.stopPropagation(); setCsvFile(null); setCsvResult(null); }}
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

            {csvResult && (
              <div className={`rounded-lg p-4 mb-4 ${csvResult.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                {csvResult.type === 'success' ? (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <p className="font-medium text-green-800">{csvResult.message}</p>
                    </div>
                    <div className="text-sm text-green-700 space-y-0.5">
                      <p>全{csvResult.total}行中: 成功 {csvResult.success}件 / スキップ {csvResult.skipped}件</p>
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
                onClick={() => setShowCsvModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                閉じる
              </button>
              <button
                onClick={handleCsvImport}
                disabled={!csvFile || csvImporting}
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
    </div>
  );
}
