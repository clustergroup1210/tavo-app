import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Edit2, ChevronDown, ChevronRight, Download, ToggleLeft, ToggleRight, Trash2, Upload, FileText, X } from 'lucide-react';

const LEVEL_LABELS = ['大項目', '中項目', '小項目'];
const LEVEL_COLORS = [
  'border-l-4 border-l-primary-500 bg-white',
  'border-l-4 border-l-blue-300 bg-gray-50/50',
  'bg-white',
];

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
  const [addLevel, setAddLevel] = useState(0);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [csvMode, setCsvMode] = useState('append');
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvResult, setCsvResult] = useState(null);
  const [csvError, setCsvError] = useState(null);
  const [newItem, setNewItem] = useState({
    name: '',
    description: '',
    parentId: null,
    maxScore: 5,
    sortOrder: 0,
    targetPositions: [],
  });

  const POSITIONS = ['GK', 'DF', 'MF', 'FW'];

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

  const downloadCsvTemplate = () => {
    const sample = [
      'category,subCategory,name,description',
      '心,プレーメンタル,執着心,ボールに最後まで足を止めずに食らいついている',
      '技,個人技術,ルックアップ,ボールを受ける前に周囲を確認している',
      '体,インテンシティ,球際の強さ,1対1で身体を当てて競り勝っている'
    ].join('\n');
    const blob = new Blob(['\uFEFF' + sample], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'evaluation_criteria_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCsvUpload = async () => {
    if (!csvFile || !currentTeam) return;
    if (csvMode === 'replace' && !confirm('既存の評価項目を全件削除して入れ替えます。よろしいですか？\n（既存評価データがある場合は失敗します）')) return;
    setCsvUploading(true);
    setCsvError(null);
    setCsvResult(null);
    try {
      const fd = new FormData();
      fd.append('file', csvFile);
      const res = await fetch(`/api/evaluations/items/import-csv?teamId=${currentTeam.id}&mode=${csvMode}`, {
        method: 'POST',
        credentials: 'include',
        body: fd
      });
      const data = await res.json();
      if (!res.ok) {
        setCsvError(data.error || 'インポートに失敗しました');
        return;
      }
      setCsvResult(data);
      fetchItems();
    } catch (err) {
      setCsvError(err.message);
    } finally {
      setCsvUploading(false);
    }
  };

  const closeCsvModal = () => {
    setShowCsvModal(false);
    setCsvFile(null);
    setCsvMode('append');
    setCsvResult(null);
    setCsvError(null);
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

  const getNextSortOrder = (parentId) => {
    const findSiblings = (itemList, pid) => {
      if (!pid) return itemList;
      for (const item of itemList) {
        if (item.id === pid) return item.children || [];
        if (item.children?.length) {
          const found = findSiblings(item.children, pid);
          if (found) return found;
        }
      }
      return [];
    };
    const siblings = findSiblings(items, parentId);
    if (siblings.length === 0) return 0;
    return Math.max(...siblings.map(s => s.sortOrder || 0)) + 1;
  };

  const getParentName = (parentId) => {
    const findItem = (itemList) => {
      for (const item of itemList) {
        if (item.id === parentId) return item.name;
        if (item.children?.length) {
          const found = findItem(item.children);
          if (found) return found;
        }
      }
      return null;
    };
    return findItem(items);
  };

  const getItemLevel = (item) => {
    if (!item.parentId) return 0;
    const findLevel = (itemList, targetId, level = 0) => {
      for (const i of itemList) {
        if (i.id === targetId) return level;
        if (i.children?.length) {
          const found = findLevel(i.children, targetId, level + 1);
          if (found !== -1) return found;
        }
      }
      return -1;
    };
    return findLevel(items, item.parentId) + 1;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const body = {
        ...newItem,
        maxScore: parseInt(newItem.maxScore) || 5,
        sortOrder: parseInt(newItem.sortOrder) || 0,
        targetPositions: newItem.targetPositions || [],
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
    setNewItem({ name: '', description: '', parentId: null, maxScore: 5, sortOrder: 0, targetPositions: [] });
    setEditingItem(null);
    setAddLevel(0);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    const level = getItemLevel(item);
    setAddLevel(level);
    setNewItem({
      name: item.name,
      description: item.description || '',
      parentId: item.parentId,
      maxScore: item.maxScore || 5,
      sortOrder: item.sortOrder,
      targetPositions: item.targetPositions || [],
    });
    setShowModal(true);
  };

  const handleAddChild = (parentItem, parentLevel) => {
    resetForm();
    const childLevel = parentLevel + 1;
    setAddLevel(childLevel);
    setNewItem(prev => ({
      ...prev,
      parentId: parentItem.id,
      sortOrder: getNextSortOrder(parentItem.id),
    }));
    setShowModal(true);
  };

  const handleAddTopLevel = () => {
    resetForm();
    setAddLevel(0);
    setNewItem(prev => ({
      ...prev,
      parentId: null,
      sortOrder: getNextSortOrder(null),
    }));
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

  const countItems = (itemList, depth = 0) => {
    let total = 0;
    let active = 0;
    for (const item of itemList) {
      total++;
      if (item.isActive) active++;
      if (item.children?.length) {
        const sub = countItems(item.children, depth + 1);
        total += sub.total;
        active += sub.active;
      }
    }
    return { total, active };
  };

  const { total: totalAll, active: totalActive } = countItems(items);

  const getAllParentOptions = () => {
    const options = [];
    const collect = (itemList, level, prefix = '') => {
      for (const item of itemList) {
        if (level < 2) {
          options.push({
            id: item.id,
            name: prefix ? `${prefix} > ${item.name}` : item.name,
            level,
          });
        }
        if (item.children?.length && level < 1) {
          collect(item.children, level + 1, item.name);
        }
      }
    };
    collect(items, 0);
    return options;
  };

  const renderItems = (itemList, level = 0) => {
    return itemList.map((item) => {
      const hasChildren = item.children && item.children.length > 0;
      const isExpanded = expandedItems[item.id] !== false;

      return (
        <div key={item.id}>
          <div
            className={`flex items-center justify-between py-3 px-4 hover:bg-gray-50/80 border-b border-gray-100 ${!item.isActive ? 'opacity-50 bg-gray-50' : ''} ${level === 0 ? 'border-l-4 border-l-primary-500' : level === 1 ? 'border-l-4 border-l-blue-300' : ''}`}
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
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
                    level === 0 ? 'bg-primary-100 text-primary-700' :
                    level === 1 ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {LEVEL_LABELS[level] || '項目'}
                  </span>
                  <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                  {!item.isActive && (
                    <span className="text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded shrink-0">無効</span>
                  )}
                  {item.targetPositions && item.targetPositions.length > 0 && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded shrink-0">
                      {item.targetPositions.join('/')}
                    </span>
                  )}
                  {level === 2 && item.maxScore && (
                    <span className="text-xs text-gray-400 shrink-0">MAX:{item.maxScore}</span>
                  )}
                </div>
                {item.description && (
                  <p className="text-xs text-gray-500 truncate mt-0.5">{item.description}</p>
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
                {level < 2 && (
                  <button
                    onClick={() => handleAddChild(item, level)}
                    className="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-primary-50"
                    title={`${LEVEL_LABELS[level + 1]}を追加`}
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

  const getModalTitle = () => {
    if (editingItem) {
      return `${LEVEL_LABELS[addLevel] || '項目'}を編集`;
    }
    return `${LEVEL_LABELS[addLevel] || '項目'}を追加`;
  };

  const isLeafLevel = () => {
    if (editingItem) {
      return addLevel >= 2;
    }
    return addLevel >= 2;
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
              onClick={() => setShowCsvModal(true)}
              className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
              title="CSVから一括登録"
            >
              <Upload className="w-4 h-4" />
              CSVインポート
            </button>
            <button
              onClick={handleAddTopLevel}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
            >
              <Plus className="w-4 h-4" />
              大項目を追加
            </button>
          </div>
        )}
      </div>

      {showCsvModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <Upload className="w-4 h-4 text-primary-600" />
                評価項目を CSV から一括登録
              </h3>
              <button onClick={closeCsvModal} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600 space-y-1">
                <p className="font-medium text-gray-700">CSVフォーマット (UTF-8)</p>
                <code className="block font-mono bg-white px-2 py-1 rounded border border-gray-200">category,subCategory,name,description</code>
                <p className="text-[11px]">日本語ヘッダーも可: <code>大項目,中項目,小項目,キーファクター</code></p>
                <p>例: 「心,プレーメンタル,執着心,ボールに最後まで足を止めずに食らいついている」</p>
                <p>同じ category / subCategory は自動的にまとめられます。description (キーファクター) は省略可。</p>
              </div>

              <button
                type="button"
                onClick={downloadCsvTemplate}
                className="inline-flex items-center gap-1.5 text-xs text-primary-600 hover:underline"
              >
                <FileText className="w-3.5 h-3.5" />
                テンプレートCSVをダウンロード
              </button>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CSVファイル</label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => { setCsvFile(e.target.files?.[0] || null); setCsvResult(null); setCsvError(null); }}
                  className="block w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">登録モード</label>
                <div className="space-y-1.5">
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <input type="radio" checked={csvMode === 'append'} onChange={() => setCsvMode('append')} className="mt-0.5" />
                    <span>
                      <span className="font-medium">追加 (推奨)</span>
                      <span className="block text-xs text-gray-500">既存の項目に追加し、同名の大/中項目は再利用します</span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <input type="radio" checked={csvMode === 'replace'} onChange={() => setCsvMode('replace')} className="mt-0.5" />
                    <span>
                      <span className="font-medium text-red-700">全件入れ替え</span>
                      <span className="block text-xs text-gray-500">既存の項目を全削除して入れ替え（既存評価がある場合は失敗）</span>
                    </span>
                  </label>
                </div>
              </div>

              {csvError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {csvError}
                </div>
              )}

              {csvResult && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                  <p className="font-medium">インポートが完了しました</p>
                  <p className="text-xs mt-1">処理行数: {csvResult.processedRows} / 新規評価項目: {csvResult.imported}</p>
                  {csvResult.rowErrors?.length > 0 && (
                    <details className="mt-2">
                      <summary className="text-xs cursor-pointer text-amber-700">スキップ {csvResult.rowErrors.length} 件</summary>
                      <ul className="mt-1 text-xs text-amber-700 list-disc pl-5">
                        {csvResult.rowErrors.slice(0, 10).map((e, i) => (
                          <li key={i}>L{e.line}: {e.error}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
              <button
                onClick={closeCsvModal}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
                disabled={csvUploading}
              >
                {csvResult ? '閉じる' : 'キャンセル'}
              </button>
              {!csvResult && (
                <button
                  onClick={handleCsvUpload}
                  disabled={!csvFile || csvUploading}
                  className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {csvUploading ? 'アップロード中...' : 'インポート実行'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {canManage && (
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-primary-100 border border-primary-300"></span>
            <span>大項目</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-blue-100 border border-blue-300"></span>
            <span>中項目</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-gray-100 border border-gray-300"></span>
            <span>小項目（評価対象）</span>
          </div>
        </div>
      )}

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
        {items.length > 0 ? (
          renderItems(items)
        ) : (
          <div className="p-8 text-center text-gray-500">
            {showInactive
              ? '評価項目がありません。テンプレートからインポートするか、手動で追加してください。'
              : '表示する項目がありません。「無効項目も表示」をオンにしてください。'}
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
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              {getModalTitle()}
            </h2>
            {!editingItem && newItem.parentId && (
              <p className="text-xs text-gray-500 mb-4">
                親項目: <span className="font-medium text-gray-700">{getParentName(newItem.parentId)}</span>
              </p>
            )}
            {!editingItem && !newItem.parentId && (
              <p className="text-xs text-gray-500 mb-4">
                最上位の評価カテゴリを作成します
              </p>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              {!editingItem && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">追加する階層</label>
                  <div className="flex gap-2">
                    {LEVEL_LABELS.map((label, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setAddLevel(idx);
                          if (idx === 0) {
                            setNewItem(prev => ({ ...prev, parentId: null, sortOrder: getNextSortOrder(null) }));
                          } else {
                            setNewItem(prev => ({ ...prev, parentId: null, sortOrder: 0 }));
                          }
                        }}
                        className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg border transition ${
                          addLevel === idx
                            ? 'bg-primary-50 border-primary-300 text-primary-700'
                            : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!editingItem && addLevel > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {addLevel === 1 ? '所属する大項目' : '所属する中項目'}
                  </label>
                  <select
                    value={newItem.parentId || ''}
                    onChange={(e) => {
                      const pid = e.target.value || null;
                      setNewItem(prev => ({
                        ...prev,
                        parentId: pid,
                        sortOrder: getNextSortOrder(pid),
                      }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                    required
                  >
                    <option value="">選択してください</option>
                    {addLevel === 1 && items.map(item => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                    {addLevel === 2 && items.flatMap(parent =>
                      (parent.children || []).map(child => (
                        <option key={child.id} value={child.id}>
                          {parent.name} &gt; {child.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {LEVEL_LABELS[addLevel] || '項目'}名
                </label>
                <input
                  type="text"
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder={`${LEVEL_LABELS[addLevel] || '項目'}の名前を入力`}
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
                  placeholder="任意"
                />
              </div>
              {isLeafLevel() && (
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  対象ポジション
                  <span className="text-xs text-gray-400 ml-1">（未選択＝全ポジション共通）</span>
                </label>
                <div className="flex gap-2">
                  {POSITIONS.map(pos => (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => {
                        const current = newItem.targetPositions || [];
                        const updated = current.includes(pos)
                          ? current.filter(p => p !== pos)
                          : [...current, pos];
                        setNewItem({ ...newItem, targetPositions: updated });
                      }}
                      className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg border transition ${
                        (newItem.targetPositions || []).includes(pos)
                          ? 'bg-amber-50 border-amber-300 text-amber-700'
                          : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
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
                  {editingItem ? '保存' : '追加'}
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
