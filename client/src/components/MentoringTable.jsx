import React, { useState, useEffect, useCallback } from 'react';
import { BookOpen, Star, Save, Check } from 'lucide-react';

function generateMonthRange(joinedAt, graduationDate) {
  const months = [];
  const start = joinedAt ? new Date(joinedAt) : new Date();
  start.setDate(1);

  const now = new Date();
  now.setDate(1);
  const endDate = graduationDate ? new Date(graduationDate) : now;
  endDate.setDate(1);
  const end = endDate > now ? endDate : now;

  const cursor = new Date(start);
  while (cursor <= end) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, '0');
    months.push(`${y}-${m}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

function formatMonth(ym) {
  const [y, m] = ym.split('-');
  return `${y}/${parseInt(m)}`;
}

export default function MentoringTable({ playerId, isSelf, isCoach }) {
  const [records, setRecords] = useState([]);
  const [joinedAt, setJoinedAt] = useState(null);
  const [graduationDate, setGraduationDate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(null);
  const [saved, setSaved] = useState(null);

  const fetchRecords = useCallback(async () => {
    try {
      const res = await fetch(`/api/mentoring/${playerId}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records || []);
        setJoinedAt(data.joinedAt);
        setGraduationDate(data.graduationDate);
      }
    } catch (error) {
      console.error('Failed to fetch mentoring records:', error);
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const months = joinedAt ? generateMonthRange(joinedAt, graduationDate) : [];
  const recordMap = {};
  records.forEach(r => { recordMap[r.targetMonth] = r; });

  const scores = records.filter(r => r.score != null).map(r => r.score);
  const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2) : null;

  const handleSave = async (targetMonth, field, value) => {
    setSaving(targetMonth + field);
    try {
      const body = { targetMonth };
      body[field] = value;
      const res = await fetch(`/api/mentoring/${playerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const updated = await res.json();
        setRecords(prev => {
          const existing = prev.findIndex(r => r.targetMonth === targetMonth);
          if (existing >= 0) {
            const copy = [...prev];
            copy[existing] = updated;
            return copy;
          }
          return [...prev, updated].sort((a, b) => a.targetMonth.localeCompare(b.targetMonth));
        });
        setSaved(targetMonth + field);
        setTimeout(() => setSaved(null), 1500);
      }
    } catch (error) {
      console.error('Failed to save mentoring record:', error);
    } finally {
      setSaving(null);
      setEditingCell(null);
    }
  };

  const canEditGoal = isSelf || isCoach;
  const canEditStaffFields = isCoach;

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="h-40 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="p-4 sm:p-6 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">メンタリング記録</h2>
          </div>
          {avgScore && (
            <div className="flex items-center gap-2 bg-primary-50 px-3 py-1.5 rounded-lg">
              <Star className="w-4 h-4 text-primary-600" />
              <span className="text-sm text-gray-600">平均スコア</span>
              <span className="text-lg font-bold text-primary-700">{avgScore}</span>
              <span className="text-xs text-gray-500">/ 5</span>
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase w-[90px]">月</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">目標</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">スタッフコメント</th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-600 uppercase w-[90px]">評価点</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {months.map((month) => {
              const rec = recordMap[month] || {};
              const isCurrentMonth = month === `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

              return (
                <tr key={month} className={isCurrentMonth ? 'bg-primary-50/30' : 'hover:bg-gray-50'}>
                  <td className="px-3 py-2 text-sm font-medium text-gray-700 whitespace-nowrap">
                    {formatMonth(month)}
                    {isCurrentMonth && <span className="ml-1 text-[10px] text-primary-600 font-semibold">今月</span>}
                  </td>

                  <td className="px-3 py-1.5">
                    <EditableCell
                      value={rec.goal || ''}
                      canEdit={canEditGoal}
                      cellKey={month + 'goal'}
                      editingCell={editingCell}
                      setEditingCell={setEditingCell}
                      editValue={editValue}
                      setEditValue={setEditValue}
                      onSave={(val) => handleSave(month, 'goal', val)}
                      saving={saving}
                      saved={saved}
                      placeholder={canEditGoal ? '目標を入力...' : ''}
                    />
                  </td>

                  <td className="px-3 py-1.5">
                    <EditableCell
                      value={rec.staffComment || ''}
                      canEdit={canEditStaffFields}
                      cellKey={month + 'staffComment'}
                      editingCell={editingCell}
                      setEditingCell={setEditingCell}
                      editValue={editValue}
                      setEditValue={setEditValue}
                      onSave={(val) => handleSave(month, 'staffComment', val)}
                      saving={saving}
                      saved={saved}
                      placeholder={canEditStaffFields ? 'コメントを入力...' : ''}
                    />
                  </td>

                  <td className="px-3 py-1.5">
                    <ScoreCell
                      value={rec.score}
                      canEdit={canEditStaffFields}
                      cellKey={month + 'score'}
                      onSave={(val) => handleSave(month, 'score', val)}
                      saving={saving}
                      saved={saved}
                    />
                  </td>
                </tr>
              );
            })}
            {months.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-gray-500 text-sm">
                  入団日が設定されていないため、メンタリング記録を表示できません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
        {isSelf && !isCoach && '※ 目標のみ編集できます。コメントと評価点はコーチが入力します。'}
        {isCoach && '※ 全ての項目を編集できます。'}
        {!isSelf && !isCoach && '※ 閲覧のみ可能です。'}
      </div>
    </div>
  );
}

function EditableCell({ value, canEdit, cellKey, editingCell, setEditingCell, editValue, setEditValue, onSave, saving, saved, placeholder }) {
  const isEditing = editingCell === cellKey;
  const isSaving = saving === cellKey;
  const isSaved = saved === cellKey;

  if (!canEdit) {
    return (
      <div className="text-sm text-gray-700 whitespace-pre-wrap min-h-[28px] py-1">
        {value || <span className="text-gray-300">-</span>}
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="flex items-start gap-1">
        <textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          className="w-full px-2 py-1 text-sm border border-primary-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500 resize-none"
          rows={2}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Escape') setEditingCell(null);
          }}
        />
        <button
          onClick={() => onSave(editValue)}
          disabled={isSaving}
          className="p-1 text-primary-600 hover:bg-primary-50 rounded flex-shrink-0"
        >
          <Save className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={() => {
        setEditingCell(cellKey);
        setEditValue(value);
      }}
      className="text-sm text-gray-700 whitespace-pre-wrap min-h-[28px] py-1 cursor-pointer hover:bg-gray-100 rounded px-1 -mx-1 relative"
    >
      {value || <span className="text-gray-300 italic">{placeholder}</span>}
      {isSaved && (
        <span className="absolute right-0 top-0 text-green-500">
          <Check className="w-3.5 h-3.5" />
        </span>
      )}
    </div>
  );
}

function ScoreCell({ value, canEdit, cellKey, onSave, saving, saved }) {
  const isSaving = saving === cellKey;
  const isSaved = saved === cellKey;

  const scoreColor = (s) => {
    if (s === null || s === undefined) return '';
    if (s <= 1) return 'text-red-600 bg-red-50';
    if (s <= 2) return 'text-orange-600 bg-orange-50';
    if (s <= 3) return 'text-yellow-600 bg-yellow-50';
    if (s <= 4) return 'text-blue-600 bg-blue-50';
    return 'text-green-600 bg-green-50';
  };

  if (!canEdit) {
    return (
      <div className="flex justify-center">
        {value != null ? (
          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${scoreColor(value)}`}>
            {value}
          </span>
        ) : (
          <span className="text-gray-300 text-sm">-</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex justify-center relative">
      <select
        value={value ?? ''}
        onChange={(e) => onSave(e.target.value === '' ? null : parseInt(e.target.value))}
        disabled={isSaving}
        className={`w-16 text-center text-sm py-1 border border-gray-200 rounded-lg cursor-pointer focus:ring-1 focus:ring-primary-500 ${value != null ? scoreColor(value) : ''}`}
      >
        <option value="">-</option>
        <option value="1">1</option>
        <option value="2">2</option>
        <option value="3">3</option>
        <option value="4">4</option>
        <option value="5">5</option>
      </select>
      {isSaved && (
        <span className="absolute -right-4 top-1 text-green-500">
          <Check className="w-3.5 h-3.5" />
        </span>
      )}
    </div>
  );
}
