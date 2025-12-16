import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Edit2, ChevronDown, ChevronRight } from 'lucide-react';

export default function EvaluationItems() {
  const { currentTeam } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [expandedItems, setExpandedItems] = useState({});
  const [newItem, setNewItem] = useState({
    name: '',
    description: '',
    parentId: null,
    position: '',
    sortOrder: 0,
  });

  useEffect(() => {
    if (currentTeam) {
      fetchItems();
    }
  }, [currentTeam]);

  const fetchItems = async () => {
    try {
      const res = await fetch(`/api/evaluations/items?teamId=${currentTeam.id}`, {
        credentials: 'include',
      });
      const data = await res.json();
      setItems(data);
    } catch (error) {
      console.error('Failed to fetch items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await fetch(`/api/evaluations/items/${editingItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(newItem),
        });
      } else {
        await fetch('/api/evaluations/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ ...newItem, teamId: currentTeam.id }),
        });
      }
      setShowModal(false);
      setNewItem({ name: '', description: '', parentId: null, position: '', sortOrder: 0 });
      setEditingItem(null);
      fetchItems();
    } catch (error) {
      console.error('Failed to save item:', error);
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setNewItem({
      name: item.name,
      description: item.description || '',
      parentId: item.parentId,
      position: item.position || '',
      sortOrder: item.sortOrder,
    });
    setShowModal(true);
  };

  const handleDeactivate = async (item) => {
    if (!confirm('この項目を非活性化しますか？')) return;
    try {
      await fetch(`/api/evaluations/items/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive: false }),
      });
      fetchItems();
    } catch (error) {
      console.error('Failed to deactivate item:', error);
    }
  };

  const toggleExpand = (id) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const renderItems = (itemList, level = 0) => {
    return itemList.map((item) => {
      const hasChildren = item.children && item.children.length > 0;
      const isExpanded = expandedItems[item.id];

      return (
        <div key={item.id}>
          <div
            className="flex items-center justify-between py-3 px-4 hover:bg-gray-50 border-b border-gray-100"
            style={{ paddingLeft: 16 + level * 24 }}
          >
            <div className="flex items-center gap-2">
              {hasChildren ? (
                <button onClick={() => toggleExpand(item.id)} className="p-1">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              ) : (
                <div className="w-6" />
              )}
              <div>
                <p className="text-sm font-medium text-gray-900">{item.name}</p>
                {item.description && (
                  <p className="text-xs text-gray-500">{item.description}</p>
                )}
                {item.position && (
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                    {item.position}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleEdit(item)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setNewItem({ ...newItem, parentId: item.id });
                  setShowModal(true);
                }}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
          {hasChildren && isExpanded && renderItems(item.children, level + 1)}
        </div>
      );
    });
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
          <h1 className="text-2xl font-bold text-gray-900">評価項目管理</h1>
          <p className="mt-1 text-sm text-gray-500">評価項目の追加・編集ができます</p>
        </div>
        <button
          onClick={() => {
            setEditingItem(null);
            setNewItem({ name: '', description: '', parentId: null, position: '', sortOrder: 0 });
            setShowModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Plus className="w-4 h-4" />
          項目追加
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {items.length > 0 ? (
          renderItems(items)
        ) : (
          <div className="p-8 text-center text-gray-500">
            評価項目がありません。「項目追加」から作成してください。
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {editingItem ? '項目編集' : '項目追加'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">項目名</label>
                <input
                  type="text"
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
                <textarea
                  value={newItem.description}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ポジション（任意）</label>
                <select
                  value={newItem.position}
                  onChange={(e) => setNewItem({ ...newItem, position: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">全ポジション</option>
                  <option value="GK">GK</option>
                  <option value="DF">DF</option>
                  <option value="MF">MF</option>
                  <option value="FW">FW</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">表示順</label>
                <input
                  type="number"
                  value={newItem.sortOrder}
                  onChange={(e) => setNewItem({ ...newItem, sortOrder: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingItem(null);
                  }}
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
