import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Building2, Plus, Upload, Edit2, X, Users, Tag, Trash2 } from 'lucide-react';

export default function Dashboard() {
  const { currentTeam, isOperator, isTeamAdmin } = useAuth();
  const [team, setTeam] = useState(null);
  const [teamCategories, setTeamCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (currentTeam) {
      fetchTeamData();
    } else {
      setLoading(false);
    }
  }, [currentTeam]);

  const fetchTeamData = async () => {
    try {
      const [teamRes, categoriesRes] = await Promise.all([
        fetch(`/api/teams/${currentTeam.id}`, { credentials: 'include' }),
        fetch(`/api/team-categories?teamId=${currentTeam.id}`, { credentials: 'include' })
      ]);

      if (teamRes.ok) {
        const teamData = await teamRes.json();
        setTeam(teamData);
        setName(teamData.name);
        setDescription(teamData.description || '');
      }
      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json();
        setTeamCategories(Array.isArray(categoriesData) ? categoriesData : []);
      }
    } catch (error) {
      console.error('Failed to fetch team data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      await fetch(`/api/teams/${currentTeam.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, description }),
      });
      setEditing(false);
      fetchTeamData();
    } catch (error) {
      console.error('Failed to update team:', error);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('logo', file);

    try {
      await fetch(`/api/teams/${currentTeam.id}/logo`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      fetchTeamData();
    } catch (error) {
      console.error('Failed to upload logo:', error);
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/team-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          teamId: currentTeam.id, 
          name: newCategoryName, 
          sortOrder: teamCategories.length 
        }),
      });
      if (res.ok) {
        setNewCategoryName('');
        setShowCategoryModal(false);
        fetchTeamData();
      } else {
        const data = await res.json();
        setError(data.error || 'カテゴリーの作成に失敗しました');
      }
    } catch (error) {
      setError('カテゴリーの作成に失敗しました');
    }
  };

  const handleEditCategory = async (e) => {
    e.preventDefault();
    if (!editingCategory) return;
    setError('');
    try {
      const res = await fetch(`/api/team-categories/${editingCategory.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: editCategoryName }),
      });
      if (res.ok) {
        setEditingCategory(null);
        setEditCategoryName('');
        fetchTeamData();
      } else {
        const data = await res.json();
        setError(data.error || 'カテゴリーの更新に失敗しました');
      }
    } catch (error) {
      setError('カテゴリーの更新に失敗しました');
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    if (!confirm('このカテゴリーを削除しますか？')) return;
    try {
      const res = await fetch(`/api/team-categories/${categoryId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        fetchTeamData();
      }
    } catch (error) {
      console.error('Failed to delete category:', error);
    }
  };

  const startEditCategory = (category) => {
    setEditingCategory(category);
    setEditCategoryName(category.name);
  };

  const canEdit = currentTeam && (isTeamAdmin(currentTeam.id) || isOperator());

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!currentTeam || !team) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>
          <p className="mt-1 text-sm text-gray-500">ようこそ</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-gray-500">チームを選択してください</p>
        </div>
      </div>
    );
  }

  const categories = teamCategories;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">チーム設定</h1>
        {canEdit && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-primary-600 hover:bg-primary-50 rounded-lg"
          >
            <Edit2 className="w-4 h-4" />
            編集
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-start gap-6">
          <div className="relative">
            {team.logoUrl ? (
              <img
                src={team.logoUrl}
                alt=""
                className="w-24 h-24 rounded-xl object-cover"
              />
            ) : (
              <div className="w-24 h-24 rounded-xl bg-gray-100 flex items-center justify-center">
                <Building2 className="w-10 h-10 text-gray-400" />
              </div>
            )}
            {canEdit && (
              <label className="absolute -bottom-2 -right-2 p-2 bg-white rounded-full shadow-md cursor-pointer hover:bg-gray-50">
                <Upload className="w-4 h-4 text-gray-600" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <div className="flex-1 space-y-4">
            {editing ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">チーム名</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleSave}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                  >
                    保存
                  </button>
                  <button
                    onClick={() => {
                      setEditing(false);
                      setName(team.name);
                      setDescription(team.description || '');
                    }}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                  >
                    キャンセル
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-gray-900">{team.name}</h2>
                <p className="text-gray-600">{team.description || '説明はありません'}</p>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">カテゴリー</h3>
          {canEdit && (
            <button
              onClick={() => setShowCategoryModal(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              <Plus className="w-4 h-4" />
              カテゴリー追加
            </button>
          )}
        </div>
        {categories.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((category) => (
              <div
                key={category.id}
                className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Tag className="w-5 h-5 text-purple-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{category.name}</p>
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {category._count?.players || 0}名
                  </p>
                </div>
                {canEdit && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => startEditCategory(category)}
                      className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded"
                      title="編集"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(category.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                      title="削除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">カテゴリーはありません</p>
        )}
      </div>

      {showCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">カテゴリー追加</h2>
              <button onClick={() => { setShowCategoryModal(false); setError(''); }} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
            <form onSubmit={handleCreateCategory}>
              <input
                type="text"
                placeholder="カテゴリー名（例: Aチーム）"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4"
                required
              />
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setShowCategoryModal(false); setError(''); }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  作成
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingCategory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">カテゴリー編集</h2>
              <button onClick={() => { setEditingCategory(null); setError(''); }} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
            <form onSubmit={handleEditCategory}>
              <input
                type="text"
                placeholder="カテゴリー名"
                value={editCategoryName}
                onChange={(e) => setEditCategoryName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4"
                required
              />
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setEditingCategory(null); setError(''); }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
