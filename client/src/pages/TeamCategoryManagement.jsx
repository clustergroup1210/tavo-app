import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Plus, X, Edit2, Trash2, Users, Tag, Save } from 'lucide-react';

export default function TeamCategoryManagement() {
  const { currentTeam } = useAuth();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [form, setForm] = useState({ name: '', sortOrder: 0 });
  const [error, setError] = useState('');

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
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Plus className="w-4 h-4" />
          カテゴリーを追加
        </button>
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
