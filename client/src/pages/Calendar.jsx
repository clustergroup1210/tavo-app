import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  ChevronLeft, ChevronRight, Plus, X, Calendar as CalendarIcon, 
  Clock, MapPin, Edit2, Trash2, Save, Tag
} from 'lucide-react';

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
  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

  const eventTypeColors = {
    event: 'bg-blue-500',
    practice: 'bg-green-500',
    match: 'bg-red-500',
    meeting: 'bg-purple-500',
    other: 'bg-gray-500'
  };

  const eventTypeLabels = {
    event: 'イベント',
    practice: '練習',
    match: '試合',
    meeting: 'ミーティング',
    other: 'その他'
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
          <CalendarIcon className="w-6 h-6 text-primary-600" />
          <h1 className="text-2xl font-bold text-gray-900">カレンダー</h1>
        </div>
        {canCreate && (
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus className="w-4 h-4" />
            予定を追加
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <button onClick={handlePrevMonth} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-semibold">
            {currentDate.getFullYear()}年 {monthNames[currentDate.getMonth()]}
          </h2>
          <button onClick={handleNextMonth} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-7">
          {weekDays.map((day, i) => (
            <div key={day} className={`p-2 text-center text-sm font-medium border-b border-gray-200 ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-700'}`}>
              {day}
            </div>
          ))}
          {days.map(({ date, isCurrentMonth }, index) => {
            const dayEvents = getEventsForDate(date);
            const isToday = date.toDateString() === new Date().toDateString();
            const isSelected = selectedDate?.toDateString() === date.toDateString();
            const dayOfWeek = date.getDay();

            return (
              <div
                key={index}
                onClick={() => handleDateClick(date)}
                className={`min-h-24 p-1 border-b border-r border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors
                  ${!isCurrentMonth ? 'bg-gray-50' : ''}
                  ${isSelected ? 'bg-primary-50 ring-2 ring-primary-500 ring-inset' : ''}
                `}
              >
                <div className={`text-sm font-medium mb-1 w-7 h-7 flex items-center justify-center rounded-full
                  ${isToday ? 'bg-primary-600 text-white' : ''}
                  ${!isToday && dayOfWeek === 0 ? 'text-red-500' : ''}
                  ${!isToday && dayOfWeek === 6 ? 'text-blue-500' : ''}
                  ${!isCurrentMonth ? 'text-gray-400' : ''}
                `}>
                  {date.getDate()}
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 2).map(event => (
                    <div
                      key={event.id}
                      className={`text-xs px-1.5 py-0.5 rounded truncate text-white ${eventTypeColors[event.eventType] || 'bg-blue-500'}`}
                    >
                      {event.title}
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <div className="text-xs text-gray-500 px-1">+{dayEvents.length - 2}件</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedDate && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {selectedDate.getMonth() + 1}月{selectedDate.getDate()}日の予定
          </h3>
          {getEventsForDate(selectedDate).length > 0 ? (
            <div className="space-y-3">
              {getEventsForDate(selectedDate).map(event => (
                <div key={event.id} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className={`w-1 h-full min-h-12 rounded-full ${eventTypeColors[event.eventType] || 'bg-blue-500'}`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`px-2 py-0.5 text-xs rounded text-white ${eventTypeColors[event.eventType] || 'bg-blue-500'}`}>
                        {eventTypeLabels[event.eventType] || event.eventType}
                      </span>
                      {event.categoryTargets?.length > 0 ? (
                        event.categoryTargets.map(ct => (
                          <span key={ct.id} className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-800 flex items-center gap-1">
                            <Tag className="w-3 h-3" />
                            {ct.teamCategory?.name}
                          </span>
                        ))
                      ) : (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800">
                          全員
                        </span>
                      )}
                      <h4 className="font-medium text-gray-900">{event.title}</h4>
                    </div>
                    {!event.allDay && (
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <Clock className="w-4 h-4" />
                        {new Date(event.startDate).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                        {event.endDate && ` - ${new Date(event.endDate).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}`}
                      </div>
                    )}
                    {event.location && (
                      <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                        <MapPin className="w-4 h-4" />
                        {event.location}
                      </div>
                    )}
                    {event.description && (
                      <p className="text-sm text-gray-600 mt-2">{event.description}</p>
                    )}
                    {event.team && (
                      <p className="text-xs text-gray-400 mt-2">{event.team.name}</p>
                    )}
                  </div>
                  {canCreate && (
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEditModal(event)} className="p-2 text-gray-400 hover:text-primary-600">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(event.id)} className="p-2 text-gray-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">この日の予定はありません</p>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingEvent ? '予定を編集' : '新しい予定'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">タイトル</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="予定のタイトル"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">種別</label>
                <select
                  value={form.eventType}
                  onChange={(e) => setForm({ ...form, eventType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
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
                  className="rounded border-gray-300 text-primary-600"
                />
                <label htmlFor="allDay" className="text-sm text-gray-700">終日</label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">開始日</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                {!form.allDay && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">開始時間</label>
                    <input
                      type="time"
                      value={form.startTime}
                      onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">終了日</label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                {!form.allDay && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">終了時間</label>
                    <input
                      type="time"
                      value={form.endTime}
                      onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">場所</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="場所（任意）"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="詳細説明（任意）"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Tag className="w-4 h-4 inline mr-1" />
                  対象カテゴリー
                </label>
                {teamCategories.length > 0 ? (
                  <>
                    <p className="text-xs text-gray-500 mb-2">選択しない場合は全員に表示されます</p>
                    <div className="flex flex-wrap gap-2">
                      {teamCategories.map(category => (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => handleCategoryToggle(category.id)}
                          className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                            form.categoryIds.includes(category.id)
                              ? 'bg-purple-100 border-purple-300 text-purple-800'
                              : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          {category.name}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
                    カテゴリーが未設定のため全員に表示されます。
                    <br />
                    カテゴリーを追加するには「マスタ設定」から設定してください。
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!form.title || !form.startDate}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
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
