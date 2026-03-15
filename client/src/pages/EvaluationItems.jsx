import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Edit2, ChevronDown, ChevronRight, Download, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';

export default function EvaluationItems() {
  const { currentTeam, isOperator, isTeamAdmin } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [expandedItems, setExpandedItems] = useState({});
  const [templates, setTemplates] = useState([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [newItem, setNewItem] = useState({
    name: '',
    description: '',
    parentId: null,
    maxScore: 5,
    sortOrder: 0,
  });

  const canManage = isOperator() || (currentTeam && isTeamAdmin(currentTeam.id));

  useEffect(() => {
    if (currentTeam) {
      fetchItems();
    }
  }, [currentTeam]);

  useEffect(() => {
    if (currentTeam) {
      fetchItems();
    }
  }, [showInactive]);

  const fetchItems = async () => {
    try {
      const url = `/api/evaluations/items?teamId=${currentTeam.id}${showInactive ? '&includeInactive=true' : ''}`;
      const res = await fetch(url, {
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

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/evaluation-templates/templates', {
        credentials: 'include',
      });
      const data = await res.json();
      setTemplates(data);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    }
  };

  const handleImportTemplate = async (templateTeamId) => {
    if (!confirm('テンプレートの評価項目をインポートしますか？現在の項目が0件の場合のみ実行できます。')) return;
    setImporting(true);
    try {
      const res = await fetch('/api/evaluation-templates/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ templateTeamId, targetTeamId: currentTeam.id }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`${data.count}件の評価項目をインポートしました`);
        setShowTemplateModal(false);
        fetchItems();
      } else {
        alert(data.error || 'インポートに失敗しました');
      }
    } catch (error) {
      console.error('Failed to import template:', error);
      alert('インポートに失敗しました');
    } finally {
      setImporting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const body = {
        ...newItem,
        maxScore: parseInt(newItem.maxScore) || 5,
        sortOrder: parseInt(newItem.sortOrder) || 0,
      };

      if (editingItem) {
        await fetch(`/api/evaluations/items/${editingItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        });
      } else {
        await fetch('/api/evaluations/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ ...body, teamId: currentTeam.id }),
        });
      }
      setShowModal(false);
      resetForm();
      fetchItems();
    } catch (error) {
      console.error('Failed to save item:', error);
    }
  };

  const resetForm = () => {
    setNewItem({ name: '', description: '', parentId: null, maxScore: 5, sortOrder: 0 });
    setEditingItem(null);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setNewItem({
      name: item.name,
      description: item.description || '',
      parentId: item.parentId,
      maxScore: item.maxScore || 5,
      sortOrder: item.sortOrder,
    });
    setShowModal(true);
  };

  const handleToggleActive = async (item) => {
    const newActive = !item.isActive;
    const msg = newActive ? 'この項目を有効化しますか？' : 'この項目を無効化しますか？子項目も無効化されます。';
    if (!confirm(msg)) return;
    try {
      await fetch(`/api/evaluation-templates/items/${item.id}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive: newActive }),
      });
      fetchItems();
    } catch (error) {
      console.error('Failed to toggle item:', error);
    }
  };

  const toggleExpand = (id) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const displayItems = items;
  const totalActive = items.reduce((sum, cat) => {
    if (!cat.isActive) return sum;
    return sum + 1 + (cat.children?.filter(c => c.isActive)?.length || 0);
  }, 0);
  const totalAll = items.reduce((sum, cat) => sum + 1 + (cat.children?.length || 0), 0);

  const renderItems = (itemList, level = 0) => {
    return itemList.map((item) => {
      const hasChildren = item.children && item.children.length > 0;
      const isExpanded = expandedItems[item.id] !== false;

      return (
        <div key={item.id}>
          <div
            className={`flex items-center justify-between py-3 px-4 hover:bg-gray-50 border-b border-gray-100 ${!item.isActive ? 'opacity-50 bg-gray-50' : ''}`}
            style={{ paddingLeft: 16 + level * 24 }}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {hasChildren ? (
                <button onClick={() => toggleExpand(item.id)} className="p-1 shrink-0">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              ) : (
                <div className="w-6 shrink-0" />
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                  {!item.isActive && (
                    <span className="text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded shrink-0">無効</span>
                  )}
                  {level > 0 && item.maxScore && (
                    <span className="text-xs text-gray-400 shrink-0">MAX:{item.maxScore}</span>
                  )}
                </div>
                {item.description && (
                  <p className="text-xs text-gray-500 truncate">{item.description}</p>
                )}
              </div>
            </div>
            {canManage && (
              <div className="flex items-center gap-1 shrink-0 ml-2">
                <button
                  onClick={() => handleToggleActive(item)}
                  className={`p-1.5 rounded-lg hover:bg-gray-100 ${item.isActive ? 'text-green-500' : 'text-gray-300'}`}
                  title={item.isActive ? '無効化' : '有効化'}
                >
                  {item.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => handleEdit(item)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                  title="編集"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                {level === 0 && (
                  <button
                    onClick={() => {
                      resetForm();
                      setNewItem(prev => ({ ...prev, parentId: item.id }));
                      setShowModal(true);
                    }}
                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                    title="子項目追加"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">評価項目管理</h1>
          <p className="mt-1 text-sm text-gray-500">
            有効項目: {totalActive}件 / 全{totalAll}件
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="rounded"
              />
              無効項目も表示
            </label>
            <button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
            >
              <Plus className="w-4 h-4" />
              項目追加
            </button>
          </div>
        )}
      </div>

      {items.length === 0 && canManage && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-8 text-center">
          <Download className="w-12 h-12 text-blue-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-blue-900 mb-2">評価項目がまだ設定されていません</h3>
          <p className="text-sm text-blue-700 mb-4">
            基準テンプレートからインポートすると、標準的な評価項目を一括で追加できます。
            インポート後にカスタマイズすることも可能です。
          </p>
          <button
            onClick={() => {
              fetchTemplates();
              setShowTemplateModal(true);
            }}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            <Download className="w-5 h-5" />
            テンプレートからインポート
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {displayItems.length > 0 ? (
          renderItems(displayItems)
        ) : items.length > 0 ? (
          <div className="p-8 text-center text-gray-500">
            表示する項目がありません。「無効項目も表示」をオンにしてください。
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            評価項目がありません。テンプレートからインポートするか、手動で追加してください。
          </div>
        )}
      </div>

      {items.length > 0 && canManage && (
        <div className="text-right">
          <button
            onClick={() => {
              fetchTemplates();
              setShowTemplateModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
          >
            <Download className="w-4 h-4" />
            テンプレートを確認
          </button>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {editingItem ? '項目編集' : newItem.parentId ? '子項目追加' : 'カテゴリ追加'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">項目名</label>
                <input
                  type="text"
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
                <textarea
                  value={newItem.description}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              {newItem.parentId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">最大スコア</label>
                  <input
                    type="number"
                    value={newItem.maxScore}
                    onChange={(e) => setNewItem({ ...newItem, maxScore: parseInt(e.target.value) || 5 })}
                    min={1}
                    max={10}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">表示順</label>
                <input
                  type="number"
                  value={newItem.sortOrder}
                  onChange={(e) => setNewItem({ ...newItem, sortOrder: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
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

      {showTemplateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">評価項目テンプレート</h2>
            {templates.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                利用可能なテンプレートがありません
              </div>
            ) : (
              <div className="space-y-4">
                {templates.map(template => (
                  <div key={template.id} className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">{template.name}</h3>
                        {template.description && (
                          <p className="text-xs text-gray-500 mt-0.5">{template.description}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">{template.totalItems}項目</p>
                      </div>
                      <button
                        onClick={() => handleImportTemplate(template.id)}
                        disabled={importing || items.length > 0}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        <Download className="w-4 h-4" />
                        {importing ? 'インポート中...' : items.length > 0 ? 'インポート済み' : 'インポート'}
                      </button>
                    </div>
                    <div className="px-4 py-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {template.categories.map(cat => (
                          <div key={cat.id} className="text-sm">
                            <p className="font-medium text-gray-800">{cat.name}</p>
                            <ul className="mt-1 space-y-0.5">
                              {cat.children.map(child => (
                                <li key={child.id} className="text-xs text-gray-500 pl-3">
                                  {child.name}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowTemplateModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
