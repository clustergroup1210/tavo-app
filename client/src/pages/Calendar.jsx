import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  ChevronLeft, ChevronRight, Plus, X, Calendar as CalendarIcon, 
  Clock, MapPin, Edit2, Trash2, Tag
} from 'lucide-react';

const eventTypeColors = {
  practice: { bg: 'bg-green-500', light: 'bg-green-100 text-green-800', border: 'border-green-500' },
  match: { bg: 'bg-red-500', light: 'bg-red-100 text-red-800', border: 'border-red-500' },
  meeting: { bg: 'bg-purple-500', light: 'bg-purple-100 text-purple-800', border: 'border-purple-500' },
  event: { bg: 'bg-blue-500', light: 'bg-blue-100 text-blue-800', border: 'border-blue-500' },
  other: { bg: 'bg-gray-400', light: 'bg-gray-100 text-gray-700', border: 'border-gray-400' }
};

const eventTypeLabels = {
  event: 'イベント',
  practice: '練習',
  match: '試合',
  meeting: 'ミーティング',
  other: 'その他'
};

function EventPill({ event, compact = false }) {
  const colors = eventTypeColors[event.eventType] || eventTypeColors.event;
  const startDate = new Date(event.startDate);
  const timeStr = event.allDay ? '' : `${startDate.getHours()}時`;
  const typeLabel = eventTypeLabels[event.eventType] || '';
  
  return (
    <div className={`${colors.bg} text-white text-[10px] sm:text-[11px] leading-tight px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-90 transition-opacity`}>
      {!compact && timeStr && <span className="font-medium">{timeStr} </span>}
      {!compact && typeLabel && <span className="opacity-80">{typeLabel}</span>}
      {!compact && ' '}
      <span>{event.title}</span>
    </div>
  );
}

export default function Calendar() {
  const { currentTeam, isCoach, isOperator } = useAuth();
  const [events, setEvents] = useState([]);
  const [teamCategories, setTeamCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    allDay: false,
    eventType: 'event',
    location: '',
    categoryIds: []
  });

  const currentTeamId = currentTeam?.id;
  const canCreate = isCoach(currentTeamId) || isOperator();

  useEffect(() => {
    fetchEvents();
  }, [currentDate, currentTeamId]);

  useEffect(() => {
    if (canCreate && currentTeamId) {
      fetchTeamCategories();
    }
  }, [currentTeamId, canCreate]);

  const fetchEvents = async () => {
    try {
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();
      let url = `/api/calendar/my?month=${month}&year=${year}`;
      if (currentTeamId) {
        url += `&teamId=${currentTeamId}`;
      }
      const res = await fetch(url, { credentials: 'include' });
      const data = await res.json();
      setEvents(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch events:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamCategories = async () => {
    try {
      const res = await fetch(`/api/team-categories?teamId=${currentTeamId}`, { credentials: 'include' });
      const data = await res.json();
      setTeamCategories(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch team categories:', error);
    }
  };

  const handleCategoryToggle = (categoryId) => {
    setForm(prev => ({
      ...prev,
      categoryIds: prev.categoryIds.includes(categoryId)
        ? prev.categoryIds.filter(id => id !== categoryId)
        : [...prev.categoryIds, categoryId]
    }));
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    
    const days = [];
    for (let i = 0; i < startingDay; i++) {
      const prevDate = new Date(year, month, -startingDay + i + 1);
      days.push({ date: prevDate, isCurrentMonth: false });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }
    return days;
  };

  const getEventsForDate = (date) => {
    return events.filter(event => {
      const eventDate = new Date(event.startDate);
      return eventDate.toDateString() === date.toDateString();
    });
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleDateClick = (date) => {
    setSelectedDate(date);
    if (canCreate) {
      const dateStr = date.toISOString().split('T')[0];
      setForm({
        ...form,
        startDate: dateStr,
        endDate: dateStr
      });
    }
  };

  const openCreateModal = () => {
    setEditingEvent(null);
    const today = selectedDate || new Date();
    const dateStr = today.toISOString().split('T')[0];
    setForm({
      title: '',
      description: '',
      startDate: dateStr,
      startTime: '09:00',
      endDate: dateStr,
      endTime: '10:00',
      allDay: false,
      eventType: 'event',
      location: '',
      categoryIds: []
    });
    setShowModal(true);
  };

  const openEditModal = (event) => {
    setEditingEvent(event);
    const startDate = new Date(event.startDate);
    const endDate = event.endDate ? new Date(event.endDate) : startDate;
    setForm({
      title: event.title,
      description: event.description || '',
      startDate: startDate.toISOString().split('T')[0],
      startTime: startDate.toTimeString().slice(0, 5),
      endDate: endDate.toISOString().split('T')[0],
      endTime: endDate.toTimeString().slice(0, 5),
      allDay: event.allDay,
      eventType: event.eventType,
      location: event.location || '',
      categoryIds: event.categoryTargets?.map(ct => ct.teamCategoryId) || []
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!currentTeamId && !isOperator()) {
      alert('チームが選択されていません。サイドバーからチームを選択してください。');
      return;
    }
    
    try {
      const startDateTime = form.allDay 
        ? new Date(form.startDate)
        : new Date(`${form.startDate}T${form.startTime}`);
      const endDateTime = form.allDay
        ? new Date(form.endDate)
        : new Date(`${form.endDate}T${form.endTime}`);

      const payload = {
        teamId: currentTeamId,
        title: form.title,
        description: form.description,
        startDate: startDateTime.toISOString(),
        endDate: endDateTime.toISOString(),
        allDay: form.allDay,
        eventType: form.eventType,
        location: form.location,
        categoryIds: form.categoryIds
      };

      let res;
      if (editingEvent) {
        res = await fetch(`/api/calendar/${editingEvent.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch('/api/calendar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        });
      }
      
      if (!res.ok) {
        const errorData = await res.json();
        alert(errorData.error || '予定の保存に失敗しました');
        return;
      }
      
      setShowModal(false);
      fetchEvents();
    } catch (error) {
      console.error('Failed to save event:', error);
      alert('予定の保存に失敗しました');
    }
  };

  const handleDelete = async (eventId) => {
    if (!confirm('このイベントを削除しますか？')) return;
    try {
      await fetch(`/api/calendar/${eventId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      fetchEvents();
      setSelectedDate(null);
    } catch (error) {
      console.error('Failed to delete event:', error);
    }
  };

  const days = getDaysInMonth(currentDate);
  const weekDays = ['日', '月', '火', '水', '木', '金', '土'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-800">カレンダー</h1>
        {canCreate && (
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            予定を追加
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <button
              onClick={handleToday}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              今日
            </button>
            <button
              onClick={handlePrevMonth}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              前へ
            </button>
            <button
              onClick={handleNextMonth}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              次へ
            </button>
          </div>
          <h2 className="text-base sm:text-lg font-semibold text-gray-800">
            {currentDate.getFullYear()}年{currentDate.getMonth() + 1}月
          </h2>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline px-3 py-1.5 text-sm text-gray-500 bg-white border border-gray-300 rounded-md">
              月
            </span>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
          {weekDays.map((day, i) => (
            <div
              key={day}
              className={`py-2 text-center text-xs font-semibold tracking-wider ${
                i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map(({ date, isCurrentMonth }, index) => {
            const dayEvents = getEventsForDate(date);
            const isToday = date.toDateString() === new Date().toDateString();
            const isSelected = selectedDate?.toDateString() === date.toDateString();
            const dayOfWeek = date.getDay();
            const maxVisible = 3;
            const overflow = dayEvents.length - maxVisible;

            return (
              <div
                key={index}
                onClick={() => handleDateClick(date)}
                className={`min-h-[5rem] sm:min-h-[6.5rem] border-b border-r border-gray-100 cursor-pointer transition-colors relative
                  ${!isCurrentMonth ? 'bg-gray-50/50' : 'bg-white'}
                  ${isSelected ? 'bg-primary-50 ring-1 ring-inset ring-primary-400' : 'hover:bg-gray-50'}
                `}
              >
                <div className="px-1.5 pt-1 pb-0.5">
                  <span className={`inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded-full
                    ${isToday ? 'bg-primary-600 text-white' : ''}
                    ${!isToday && !isCurrentMonth ? 'text-gray-300' : ''}
                    ${!isToday && isCurrentMonth && dayOfWeek === 0 ? 'text-red-500' : ''}
                    ${!isToday && isCurrentMonth && dayOfWeek === 6 ? 'text-blue-500' : ''}
                    ${!isToday && isCurrentMonth && dayOfWeek !== 0 && dayOfWeek !== 6 ? 'text-gray-700' : ''}
                  `}>
                    {date.getDate()}
                  </span>
                </div>
                <div className="px-0.5 space-y-0.5 sm:hidden">
                  {dayEvents.slice(0, 1).map((event) => (
                    <EventPill key={event.id} event={event} compact={true} />
                  ))}
                  {dayEvents.length > 1 && (
                    <div className="text-[10px] text-gray-400 px-1 font-medium">
                      +{dayEvents.length - 1}件
                    </div>
                  )}
                </div>
                <div className="px-0.5 space-y-0.5 hidden sm:block">
                  {dayEvents.slice(0, maxVisible).map((event) => (
                    <EventPill key={event.id} event={event} compact={false} />
                  ))}
                  {overflow > 0 && (
                    <div className="text-[10px] text-gray-400 px-1.5 font-medium">
                      +{overflow}件
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedDate && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
            <h3 className="text-sm font-semibold text-gray-800">
              {selectedDate.getFullYear()}年{selectedDate.getMonth() + 1}月{selectedDate.getDate()}日（{weekDays[selectedDate.getDay()]}）
            </h3>
          </div>
          {getEventsForDate(selectedDate).length > 0 ? (
            <div className="divide-y divide-gray-100">
              {getEventsForDate(selectedDate).map(event => {
                const colors = eventTypeColors[event.eventType] || eventTypeColors.event;
                return (
                  <div key={event.id} className={`flex items-start gap-3 px-5 py-3 hover:bg-gray-50 transition-colors border-l-[3px] ${colors.border}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`px-2 py-0.5 text-[10px] font-medium rounded ${colors.light}`}>
                          {eventTypeLabels[event.eventType] || event.eventType}
                        </span>
                        {event.categoryTargets?.length > 0 ? (
                          event.categoryTargets.map(ct => (
                            <span key={ct.id} className="px-1.5 py-0.5 text-[10px] rounded bg-purple-50 text-purple-700 font-medium">
                              {ct.teamCategory?.name}
                            </span>
                          ))
                        ) : (
                          <span className="px-1.5 py-0.5 text-[10px] rounded bg-green-50 text-green-700 font-medium">
                            全員
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-medium text-gray-900 truncate">{event.title}</h4>
                      {!event.allDay && (
                        <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                          <Clock className="w-3 h-3" />
                          {new Date(event.startDate).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                          {event.endDate && ` - ${new Date(event.endDate).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}`}
                        </div>
                      )}
                      {event.location && (
                        <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                          <MapPin className="w-3 h-3" />
                          {event.location}
                        </div>
                      )}
                      {event.description && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{event.description}</p>
                      )}
                      {event.team && (
                        <p className="text-[10px] text-gray-400 mt-1">{event.team.name}</p>
                      )}
                    </div>
                    {canCreate && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={(e) => { e.stopPropagation(); openEditModal(event); }} className="p-1.5 text-gray-400 hover:text-primary-600 rounded hover:bg-gray-100 transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(event.id); }} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-gray-100 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="px-5 py-6 text-center">
              <p className="text-sm text-gray-400">この日の予定はありません</p>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">
                {editingEvent ? '予定を編集' : '新しい予定'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">タイトル</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow"
                  placeholder="予定のタイトル"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">種別</label>
                <select
                  value={form.eventType}
                  onChange={(e) => setForm({ ...form, eventType: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                >
                  <option value="event">イベント</option>
                  <option value="practice">練習</option>
                  <option value="match">試合</option>
                  <option value="meeting">ミーティング</option>
                  <option value="other">その他</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="allDay"
                  checked={form.allDay}
                  onChange={(e) => setForm({ ...form, allDay: e.target.checked })}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor="allDay" className="text-sm text-gray-600">終日</label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">開始日</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
                {!form.allDay && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">開始時間</label>
                    <input
                      type="time"
                      value={form.startTime}
                      onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">終了日</label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
                {!form.allDay && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">終了時間</label>
                    <input
                      type="time"
                      value={form.endTime}
                      onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">場所</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  placeholder="場所（任意）"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">説明</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                  placeholder="詳細説明（任意）"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  対象カテゴリー
                </label>
                {teamCategories.length > 0 ? (
                  <>
                    <p className="text-[10px] text-gray-400 mb-2">選択しない場合は全員に表示されます</p>
                    <div className="flex flex-wrap gap-1.5">
                      {teamCategories.map(category => (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => handleCategoryToggle(category.id)}
                          className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                            form.categoryIds.includes(category.id)
                              ? 'bg-purple-100 border-purple-300 text-purple-800 font-medium'
                              : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {category.name}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-gray-400 bg-gray-50 p-3 rounded-lg">
                    カテゴリーが未設定のため全員に表示されます
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!form.title.trim() || !form.startDate}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {editingEvent ? '更新' : '作成'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
