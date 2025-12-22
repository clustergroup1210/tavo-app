import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Target, Plus, Edit2, Trash2, Save, X, GripVertical } from 'lucide-react';

export default function GoalCategoryManagement() {
  const { currentTeam } = useAuth();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });

  useEffect(() => {
    if (currentTeam) {
      fetchCategories();
    }
  }, [currentTeam]);

  const fetchCategories = async () => {
    try {
      const teamId = currentTeam.parentId || currentTeam.id;
      const res = await fetch(`/api/goals/categories?teamId=${teamId}`, { credentials: 'include' });
      const data = await res.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    
    const teamId = currentTeam.parentId || currentTeam.id;
    
    try {
      if (editingCategory) {
        const res = await fetch(`/api/goals/categories/${editingCategory.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(form),
        });
        if (res.ok) {
          const updated = await res.json();
          setCategories(categories.map(c => c.id === updated.id ? updated : c));
        }
      } else {
        const res = await fetch('/api/goals/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ ...form, teamId }),
        });
        if (res.ok) {
          const newCat = await res.json();
          setCategories([...categories, newCat]);
        }
      }
      closeModal();
    } catch (error) {
      console.error('Failed to save category:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('このカテゴリーを削除しますか？')) return;
    try {
      await fetch(`/api/goals/categories/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      setCategories(categories.filter(c => c.id !== id));
    } catch (error) {
      console.error('Failed to delete category:', error);
    }
  };

  const openEditModal = (category) => {
    setEditingCategory(category);
    setForm({ name: category.name, description: category.description || '' });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCategory(null);
    setForm({ name: '', description: '' });
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
        <div>
          <h1 className="text-2xl font-bold text-gray-900">目標カテゴリー管理</h1>
          <p className="mt-1 text-sm text-gray-500">
            選手が設定できる目標のカテゴリーを管理します
            {currentTeam?.parentId && <span className="text-primary-600">（チーム全体に適用）</span>}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Plus className="w-4 h-4" />
          カテゴリー追加
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {categories.length === 0 ? (
          <div className="p-8 text-center">
            <Target className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">目標カテゴリーがまだありません</p>
            <p className="text-sm text-gray-400 mt-1">「カテゴリー追加」から作成してください</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {categories.map((category, index) => (
              <div key={category.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <GripVertical className="w-4 h-4 text-gray-300" />
                  <div>
                    <h3 className="font-medium text-gray-900">{category.name}</h3>
                    {category.description && (
                      <p className="text-sm text-gray-500">{category.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(category)}
                    className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(category.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-800 mb-2">目標カテゴリーの例</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>・短期目標（今月達成したいこと）</li>
          <li>・長期目標（シーズン中に達成したいこと）</li>
          <li>・技術目標（技術面での目標）</li>
          <li>・メンタル目標（精神面での目標）</li>
          <li>・フィジカル目標（体力面での目標）</li>
        </ul>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingCategory ? 'カテゴリーを編集' : 'カテゴリーを追加'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">カテゴリー名</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="例: 短期目標"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">説明（任意）</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="このカテゴリーの説明"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!form.name.trim()}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {editingCategory ? '保存' : '追加'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
