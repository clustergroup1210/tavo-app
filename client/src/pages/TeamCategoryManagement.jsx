import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Plus, X, Edit2, Trash2, Users, Tag, Save, ArrowRightLeft, Search, CheckCircle } from 'lucide-react';

export default function TeamCategoryManagement() {
  const { currentTeam } = useAuth();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [form, setForm] = useState({ name: '', sortOrder: 0 });
  const [error, setError] = useState('');

  // ---- Player assignment modal state ----
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignFocusCategory, setAssignFocusCategory] = useState(''); // '', 'unassigned', or categoryId
  const [players, setPlayers] = useState([]);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [pending, setPending] = useState({}); // { playerId: newCategoryId | '' }
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (currentTeam?.id) {
      fetchCategories();
    } else {
      setLoading(false);
    }
  }, [currentTeam]);

  const fetchCategories = async () => {
    try {
      const res = await fetch(`/api/team-categories?teamId=${currentTeam.id}`, { credentials: 'include' });
      const data = await res.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingCategory(null);
    setForm({ name: '', sortOrder: categories.length });
    setShowModal(true);
  };

  const openEditModal = (category) => {
    setEditingCategory(category);
    setForm({ name: category.name, sortOrder: category.sortOrder });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError('カテゴリー名を入力してください');
      return;
    }
    setError('');
    
    try {
      const payload = {
        teamId: currentTeam.id,
        name: form.name.trim(),
        sortOrder: form.sortOrder
      };

      let res;
      if (editingCategory) {
        res = await fetch(`/api/team-categories/${editingCategory.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch('/api/team-categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        });
      }
      
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || '保存に失敗しました');
        return;
      }
      
      setShowModal(false);
      fetchCategories();
    } catch (error) {
      console.error('Failed to save category:', error);
      setError('保存に失敗しました');
    }
  };

  const openAssignModal = async (focusCategoryId = '') => {
    setAssignFocusCategory(focusCategoryId);
    setAssignOpen(true);
    setPending({});
    setSaveMessage('');
    setSearch('');
    setPlayersLoading(true);
    try {
      const res = await fetch(`/api/players?teamId=${currentTeam.id}&includeChildren=true`, { credentials: 'include' });
      const data = await res.json();
      setPlayers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch players:', err);
      setPlayers([]);
    } finally {
      setPlayersLoading(false);
    }
  };

  const setPlayerCategory = (playerId, newCategoryId, originalCategoryId) => {
    setPending(prev => {
      const next = { ...prev };
      const normalizedNew = newCategoryId || '';
      const normalizedOrig = originalCategoryId || '';
      if (normalizedNew === normalizedOrig) {
        delete next[playerId];
      } else {
        next[playerId] = normalizedNew;
      }
      return next;
    });
  };

  const bulkSetForFiltered = (filteredIds, newCategoryId) => {
    setPending(prev => {
      const next = { ...prev };
      filteredIds.forEach(({ id, originalCat }) => {
        const normalizedNew = newCategoryId || '';
        const normalizedOrig = originalCat || '';
        // Compare against ORIGINAL DB value, not effective (which may include other pending changes),
        // so an explicit bulk-set that happens to equal the player's saved DB value clears its pending entry,
        // while a bulk-set that overrides a prior pending value is preserved.
        if (normalizedNew === normalizedOrig) delete next[id];
        else next[id] = normalizedNew;
      });
      return next;
    });
  };

  const savePending = async () => {
    const entries = Object.entries(pending);
    if (entries.length === 0) return;
    setSaving(true);
    setSaveMessage('');
    let success = 0;
    let failed = 0;
    for (const [playerId, newCategoryId] of entries) {
      try {
        const res = await fetch(`/api/players/${playerId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ teamCategoryId: newCategoryId || null })
        });
        if (res.ok) success++;
        else failed++;
      } catch {
        failed++;
      }
    }
    // Refresh local players to reflect new category
    try {
      const res = await fetch(`/api/players?teamId=${currentTeam.id}&includeChildren=true`, { credentials: 'include' });
      const data = await res.json();
      setPlayers(Array.isArray(data) ? data : []);
    } catch {}
    setPending({});
    setSaving(false);
    setSaveMessage(failed > 0 ? `${success}件保存・${failed}件失敗` : `${success}件を保存しました`);
    fetchCategories();
    setTimeout(() => setSaveMessage(''), 3000);
  };

  const handleDelete = async (id) => {
    if (!confirm('このカテゴリーを削除しますか？所属する選手の設定も解除されます。')) return;
    try {
      await fetch(`/api/team-categories/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      fetchCategories();
    } catch (error) {
      console.error('Failed to delete category:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag className="w-6 h-6 text-primary-600" />
          <h1 className="text-2xl font-bold text-gray-900">チームカテゴリー管理</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => openAssignModal('')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            <ArrowRightLeft className="w-4 h-4" />
            選手の振り分け
          </button>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus className="w-4 h-4" />
            カテゴリーを追加
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <p className="text-sm text-gray-600 mb-4">
          カテゴリーを作成し、選手を分類することで、お知らせを特定のカテゴリーの選手にのみ配信できます。
          例: カテゴリーA、カテゴリーB、U-15、U-18など
        </p>
        
        {categories.length > 0 ? (
          <div className="space-y-3">
            {categories.map(category => (
              <div key={category.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                    <Tag className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{category.name}</h3>
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {category._count?.players || 0}人の選手
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openAssignModal(category.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg"
                    title="このカテゴリーに選手を振り分け"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    振り分け
                  </button>
                  <button
                    onClick={() => openEditModal(category)}
                    className="p-2 text-gray-400 hover:text-primary-600"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(category.id)}
                    className="p-2 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Tag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">カテゴリーがまだありません</p>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              <Plus className="w-4 h-4" />
              最初のカテゴリーを作成
            </button>
          </div>
        )}
      </div>

      {assignOpen && (
        <AssignModal
          categories={categories}
          players={players}
          loading={playersLoading}
          focusCategory={assignFocusCategory}
          search={search}
          setSearch={setSearch}
          pending={pending}
          saving={saving}
          saveMessage={saveMessage}
          onChange={setPlayerCategory}
          onBulkSet={bulkSetForFiltered}
          onSave={savePending}
          onClose={() => setAssignOpen(false)}
        />
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingCategory ? 'カテゴリーを編集' : '新しいカテゴリー'}
              </h3>
              <button onClick={() => { setShowModal(false); setError(''); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">カテゴリー名</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => { setForm({ ...form, name: e.target.value }); setError(''); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="例: カテゴリーA、U-15など"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">表示順</label>
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => { setShowModal(false); setError(''); }}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!form.name}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {editingCategory ? '更新' : '作成'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AssignModal({ categories, players, loading, focusCategory: initialFocus, search, setSearch, pending, saving, saveMessage, onChange, onBulkSet, onSave, onClose }) {
  const [focusCategory, setFocusCategory] = useState(initialFocus);
  useEffect(() => { setFocusCategory(initialFocus); }, [initialFocus]);
  // Compute current category for each player (pending overrides original)
  const rows = useMemo(() => {
    return players
      .slice()
      .sort((a, b) => {
        const an = a.number != null && a.number !== '' ? Number(a.number) : Number.POSITIVE_INFINITY;
        const bn = b.number != null && b.number !== '' ? Number(b.number) : Number.POSITIVE_INFINITY;
        if (an !== bn) return an - bn;
        return (a.name || '').localeCompare(b.name || '', 'ja');
      })
      .map(p => {
        const orig = p.teamCategoryId || '';
        const eff = pending[p.id] !== undefined ? pending[p.id] : orig;
        return { player: p, originalCat: orig, effectiveCat: eff, dirty: pending[p.id] !== undefined };
      });
  }, [players, pending]);

  const filtered = useMemo(() => {
    let r = rows;
    if (focusCategory === 'unassigned') {
      r = r.filter(x => !x.effectiveCat);
    } else if (focusCategory) {
      r = r.filter(x => x.effectiveCat === focusCategory || x.originalCat === focusCategory);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      r = r.filter(x =>
        (x.player.name || '').toLowerCase().includes(q) ||
        String(x.player.number || '').includes(q)
      );
    }
    return r;
  }, [rows, focusCategory, search]);

  const dirtyCount = Object.keys(pending).length;
  const unassignedCount = rows.filter(x => !x.effectiveCat).length;
  const focusedCategoryName = focusCategory && focusCategory !== 'unassigned'
    ? (categories.find(c => c.id === focusCategory)?.name || '')
    : '';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-primary-600" />
            <h3 className="text-lg font-semibold text-gray-900">選手のカテゴリー振り分け</h3>
            {dirtyCount > 0 && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800">
                {dirtyCount}件 未保存
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-gray-100 bg-gray-50 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFocusCategory('')}
              className={`px-3 py-1 rounded-full text-xs ${focusCategory === '' ? 'bg-primary-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'}`}
            >
              すべて（{rows.length}人）
            </button>
            <button
              type="button"
              onClick={() => setFocusCategory('unassigned')}
              className={`px-3 py-1 rounded-full text-xs ${focusCategory === 'unassigned' ? 'bg-amber-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'}`}
            >
              未分類（{unassignedCount}人）
            </button>
            {categories.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => setFocusCategory(c.id)}
                className={`px-3 py-1 rounded-full text-xs ${focusCategory === c.id ? 'bg-primary-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'}`}
              >
                {c.name}（{rows.filter(x => x.effectiveCat === c.id).length}人）
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="名前・背番号で検索"
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
            />
          </div>
          {filtered.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-gray-500">表示中の{filtered.length}人をまとめて：</span>
              {categories.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onBulkSet(filtered.map(x => ({ id: x.player.id, originalCat: x.originalCat })), c.id)}
                  className="px-2 py-1 rounded bg-primary-50 text-primary-700 hover:bg-primary-100"
                >
                  「{c.name}」に設定
                </button>
              ))}
              <button
                type="button"
                onClick={() => onBulkSet(filtered.map(x => ({ id: x.player.id, originalCat: x.originalCat })), '')}
                className="px-2 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                未分類に戻す
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">対象選手がいません</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {filtered.map(({ player, effectiveCat, dirty }) => (
                <div key={player.id} className={`flex items-center gap-3 py-2 ${dirty ? 'bg-amber-50' : ''}`}>
                  <div className="w-10 text-center text-sm font-mono text-gray-500">
                    {player.number != null && player.number !== '' ? `#${player.number}` : '—'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{player.name}</p>
                    {player.team?.name && (
                      <p className="text-[11px] text-gray-500 truncate">{player.team.name}</p>
                    )}
                  </div>
                  <select
                    value={effectiveCat || ''}
                    onChange={(e) => onChange(player.id, e.target.value, player.teamCategoryId)}
                    className={`px-2 py-1 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 ${dirty ? 'border-amber-400 bg-white' : 'border-gray-300'}`}
                  >
                    <option value="">未分類</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-500 flex items-center gap-2">
            {saveMessage && (
              <span className="inline-flex items-center gap-1 text-green-700">
                <CheckCircle className="w-4 h-4" />
                {saveMessage}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              閉じる
            </button>
            <button
              onClick={onSave}
              disabled={dirtyCount === 0 || saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? '保存中…' : `${dirtyCount}件を保存`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
