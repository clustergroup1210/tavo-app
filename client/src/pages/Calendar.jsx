import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  ChevronLeft, ChevronRight, Plus, X, Calendar as CalendarIcon, 
  Clock, MapPin, Edit2, Trash2, Tag, FileText, Users, ChevronDown, Check, List
} from 'lucide-react';

const eventTypeColors = {
  practice: { bg: 'bg-green-500', light: 'bg-green-100 text-green-800', border: 'border-green-500', dot: 'bg-green-500' },
  match: { bg: 'bg-red-500', light: 'bg-red-100 text-red-800', border: 'border-red-500', dot: 'bg-red-500' },
  meeting: { bg: 'bg-purple-500', light: 'bg-purple-100 text-purple-800', border: 'border-purple-500', dot: 'bg-purple-500' },
  event: { bg: 'bg-blue-500', light: 'bg-blue-100 text-blue-800', border: 'border-blue-500', dot: 'bg-blue-500' },
  personal: { bg: 'bg-amber-500', light: 'bg-amber-100 text-amber-800', border: 'border-amber-500', dot: 'bg-amber-500' },
  other: { bg: 'bg-gray-400', light: 'bg-gray-100 text-gray-700', border: 'border-gray-400', dot: 'bg-gray-400' }
};

const eventTypeLabels = {
  event: 'イベント',
  practice: '練習',
  match: '試合',
  meeting: 'ミーティング',
  personal: '個人予定',
  other: 'その他'
};

const viewModes = [
  { key: 'month', label: '月' },
  { key: 'week', label: '週' },
  { key: '3day', label: '3日' },
  { key: 'day', label: '日' },
  { key: 'list', label: '予定リスト' },
];

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}

function EventPill({ event, compact = false, onClick }) {
  const colors = eventTypeColors[event.eventType] || eventTypeColors.event;
  const startDate = new Date(event.startDate);
  const timeStr = event.allDay ? '' : `${startDate.getHours()}時`;
  const typeLabel = eventTypeLabels[event.eventType] || '';
  
  return (
    <div 
      onClick={(e) => { e.stopPropagation(); onClick?.(event); }}
      className={`${colors.bg} text-white text-[10px] sm:text-[11px] leading-tight px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-90 transition-opacity`}
    >
      {!compact && timeStr && <span className="font-medium">{timeStr} </span>}
      {!compact && typeLabel && <span className="opacity-80">{typeLabel}</span>}
      {!compact && ' '}
      <span>{event.title}</span>
    </div>
  );
}

function ViewModeDropdown({ viewMode, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const currentLabel = viewModes.find(v => v.key === viewMode)?.label || '月';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
      >
        {currentLabel}
        <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-40">
          {viewModes.map((mode) => (
            <button
              key={mode.key}
              onClick={() => { onChange(mode.key); setOpen(false); }}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors text-left"
            >
              <span className="w-4 flex-shrink-0">
                {viewMode === mode.key && <Check className="w-4 h-4 text-blue-600" />}
              </span>
              {mode.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EventDetailModal({ event, onClose, onEdit, onDelete, canEdit }) {
  if (!event) return null;
  const colors = eventTypeColors[event.eventType] || eventTypeColors.event;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-start justify-center z-50 pt-[10vh]" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md mx-4 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <h3 className="text-[15px] font-bold text-gray-900">予定の詳細</h3>
          <div className="flex items-center gap-2">
            {event.isPersonal ? (
              <span className="px-2.5 py-1 text-[11px] font-medium rounded bg-amber-500 text-white">
                個人予定
              </span>
            ) : event.categoryTargets?.length > 0 ? (
              event.categoryTargets.map(ct => (
                <span key={ct.id} className="px-2.5 py-1 text-[11px] font-medium rounded bg-blue-600 text-white">
                  {ct.teamCategory?.name}
                </span>
              ))
            ) : (
              <span className="px-2.5 py-1 text-[11px] font-medium rounded bg-green-600 text-white">
                全員
              </span>
            )}
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[65vh] overflow-y-auto">
          <div>
            <p className="text-[11px] font-medium text-gray-400 mb-0.5">タイトル</p>
            <p className="text-[13px] font-semibold text-blue-600">{event.title}</p>
          </div>

          <div className="flex items-center gap-2 mb-1">
            <span className={`px-2 py-0.5 text-[10px] font-medium rounded ${colors.light}`}>
              {eventTypeLabels[event.eventType] || event.eventType}
            </span>
            {event.allDay && (
              <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-gray-100 text-gray-600">
                終日
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] font-medium text-gray-400 mb-0.5">開始日</p>
              <p className="text-[13px] font-semibold text-gray-800">{formatDate(event.startDate)}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-gray-400 mb-0.5">終了日</p>
              <p className="text-[13px] font-semibold text-gray-800">
                {event.endDate ? formatDate(event.endDate) : '-'}
              </p>
            </div>
          </div>

          {!event.allDay && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] font-medium text-gray-400 mb-0.5">開始時間</p>
                <p className="text-[13px] font-semibold text-gray-800">{formatTime(event.startDate)}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-gray-400 mb-0.5">終了時間</p>
                <p className="text-[13px] font-semibold text-gray-800">
                  {event.endDate ? formatTime(event.endDate) : '-'}
                </p>
              </div>
            </div>
          )}

          {event.location && (
            <div>
              <p className="text-[11px] font-medium text-gray-400 mb-0.5">場所</p>
              <p className="text-[13px] font-semibold text-green-600">{event.location}</p>
            </div>
          )}

          {event.team && (
            <div>
              <p className="text-[11px] font-medium text-gray-400 mb-0.5">チーム</p>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-full bg-green-100 text-green-800">
                {event.team.name}
              </span>
            </div>
          )}

          {event.description && (
            <div>
              <p className="text-[11px] font-medium text-gray-400 mb-1">詳細内容</p>
              <div className="text-[12.5px] text-gray-700 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-lg p-3">
                {event.description}
              </div>
            </div>
          )}
        </div>

        {canEdit && (
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50/50">
            <button
              onClick={() => { onClose(); onEdit(event); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Edit2 className="w-3 h-3" />
              編集
            </button>
            <button
              onClick={() => { onClose(); onDelete(event.id); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              削除
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function EventListItem({ event, onClick }) {
  const colors = eventTypeColors[event.eventType] || eventTypeColors.event;
  return (
    <div
      onClick={() => onClick(event)}
      className={`flex items-start gap-3 px-5 py-3 hover:bg-gray-50 transition-colors border-l-[3px] ${colors.border} cursor-pointer`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className={`px-2 py-0.5 text-[10px] font-medium rounded ${colors.light}`}>
            {eventTypeLabels[event.eventType] || event.eventType}
          </span>
          {event.isPersonal ? null : event.categoryTargets?.length > 0 ? (
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
        <h4 className="text-[13px] font-medium text-gray-900 truncate">{event.title}</h4>
        {!event.allDay && (
          <div className="flex items-center gap-1 text-[11px] text-gray-500 mt-0.5">
            <Clock className="w-3 h-3" />
            {formatTime(event.startDate)}
            {event.endDate && ` - ${formatTime(event.endDate)}`}
          </div>
        )}
        {event.location && (
          <div className="flex items-center gap-1 text-[11px] text-gray-500 mt-0.5">
            <MapPin className="w-3 h-3" />
            {event.location}
          </div>
        )}
      </div>
      <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0 mt-1" />
    </div>
  );
}

export default function Calendar() {
  const { currentTeam, isCoach, isOperator, user } = useAuth();
  const [events, setEvents] = useState([]);
  const [teamCategories, setTeamCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('month');
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [detailEvent, setDetailEvent] = useState(null);
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

  const getWeekDays = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const start = new Date(d);
    start.setDate(d.getDate() - day);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const dd = new Date(start);
      dd.setDate(start.getDate() + i);
      days.push(dd);
    }
    return days;
  };

  const getMultiDays = (date, count) => {
    const days = [];
    for (let i = 0; i < count; i++) {
      const dd = new Date(date);
      dd.setDate(date.getDate() + i);
      days.push(dd);
    }
    return days;
  };

  const getEventsForDate = (date) => {
    return events.filter(event => {
      const eventDate = new Date(event.startDate);
      return eventDate.toDateString() === date.toDateString();
    });
  };

  const handlePrev = () => {
    const d = new Date(currentDate);
    if (viewMode === 'month') d.setMonth(d.getMonth() - 1);
    else if (viewMode === 'week') d.setDate(d.getDate() - 7);
    else if (viewMode === '3day') d.setDate(d.getDate() - 3);
    else if (viewMode === 'day') d.setDate(d.getDate() - 1);
    else d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (viewMode === 'month') d.setMonth(d.getMonth() + 1);
    else if (viewMode === 'week') d.setDate(d.getDate() + 7);
    else if (viewMode === '3day') d.setDate(d.getDate() + 3);
    else if (viewMode === 'day') d.setDate(d.getDate() + 1);
    else d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const getHeaderTitle = () => {
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth() + 1;
    const d = currentDate.getDate();
    const weekDayNames = ['日', '月', '火', '水', '木', '金', '土'];

    if (viewMode === 'month' || viewMode === 'list') {
      return `${y}年${m}月`;
    }
    if (viewMode === 'day') {
      return `${y}年${m}月${d}日（${weekDayNames[currentDate.getDay()]}）`;
    }
    if (viewMode === 'week') {
      const week = getWeekDays(currentDate);
      const s = week[0], e = week[6];
      if (s.getMonth() === e.getMonth()) {
        return `${s.getFullYear()}年${s.getMonth() + 1}月${s.getDate()}日 - ${e.getDate()}日`;
      }
      return `${s.getMonth() + 1}月${s.getDate()}日 - ${e.getMonth() + 1}月${e.getDate()}日`;
    }
    if (viewMode === '3day') {
      const days = getMultiDays(currentDate, 3);
      const s = days[0], e = days[2];
      if (s.getMonth() === e.getMonth()) {
        return `${s.getFullYear()}年${s.getMonth() + 1}月${s.getDate()}日 - ${e.getDate()}日`;
      }
      return `${s.getMonth() + 1}月${s.getDate()}日 - ${e.getMonth() + 1}月${e.getDate()}日`;
    }
    return `${y}年${m}月`;
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

  const handleEventClick = (event) => {
    setDetailEvent(event);
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
      eventType: canCreate ? 'event' : 'personal',
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
    const isPersonalEvent = form.eventType === 'personal';
    
    if (!isPersonalEvent && !currentTeamId && !isOperator()) {
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
        teamId: isPersonalEvent ? null : currentTeamId,
        title: form.title,
        description: form.description,
        startDate: startDateTime.toISOString(),
        endDate: endDateTime.toISOString(),
        allDay: form.allDay,
        eventType: form.eventType,
        location: form.location,
        categoryIds: isPersonalEvent ? [] : form.categoryIds,
        isPersonal: isPersonalEvent
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

  const renderMonthView = () => (
    <>
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
        {weekDays.map((day, i) => (
          <div
            key={day}
            className={`py-2 text-center text-[11px] font-semibold tracking-wider ${
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
                <span className={`inline-flex items-center justify-center w-6 h-6 text-[11px] font-medium rounded-full
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
                  <EventPill key={event.id} event={event} compact={true} onClick={handleEventClick} />
                ))}
                {dayEvents.length > 1 && (
                  <div className="text-[10px] text-gray-400 px-1 font-medium">
                    +{dayEvents.length - 1}件
                  </div>
                )}
              </div>
              <div className="px-0.5 space-y-0.5 hidden sm:block">
                {dayEvents.slice(0, maxVisible).map((event) => (
                  <EventPill key={event.id} event={event} compact={false} onClick={handleEventClick} />
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
    </>
  );

  const renderColumnView = (columnDays) => {
    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
      <>
        <div className={`grid border-b border-gray-200 bg-gray-50`} style={{ gridTemplateColumns: `3rem repeat(${columnDays.length}, 1fr)` }}>
          <div className="py-2" />
          {columnDays.map((d, i) => {
            const isToday = d.toDateString() === new Date().toDateString();
            const dayOfWeek = d.getDay();
            return (
              <div key={i} className={`py-2 text-center border-l border-gray-200 ${isToday ? 'bg-blue-50' : ''}`}>
                <span className={`text-[10px] font-semibold tracking-wider block ${
                  dayOfWeek === 0 ? 'text-red-500' : dayOfWeek === 6 ? 'text-blue-500' : 'text-gray-500'
                }`}>
                  {weekDays[dayOfWeek]}
                </span>
                <span className={`inline-flex items-center justify-center w-7 h-7 text-[13px] font-semibold rounded-full mt-0.5 ${
                  isToday ? 'bg-primary-600 text-white' : 'text-gray-700'
                }`}>
                  {d.getDate()}
                </span>
              </div>
            );
          })}
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: '70vh' }}>
          {(() => {
            const allDayEvents = columnDays.flatMap(d => getEventsForDate(d).filter(e => e.allDay));
            if (allDayEvents.length === 0) return null;
            return (
              <div className="border-b border-gray-200 bg-gray-50/50 px-2 py-1.5">
                <div className="flex flex-wrap gap-1">
                  {allDayEvents.map(event => (
                    <EventPill key={event.id} event={event} compact={false} onClick={handleEventClick} />
                  ))}
                </div>
              </div>
            );
          })()}

          <div className="relative">
            {hours.map(hour => (
              <div key={hour} className="grid border-b border-gray-100" style={{ gridTemplateColumns: `3rem repeat(${columnDays.length}, 1fr)`, minHeight: '3rem' }}>
                <div className="text-[10px] text-gray-400 text-right pr-1.5 pt-0.5 border-r border-gray-200">
                  {hour.toString().padStart(2, '0')}:00
                </div>
                {columnDays.map((d, ci) => {
                  const dayEvents = getEventsForDate(d).filter(e => {
                    if (e.allDay) return false;
                    const h = new Date(e.startDate).getHours();
                    return h === hour;
                  });
                  return (
                    <div key={ci} className="border-l border-gray-100 px-0.5 py-0.5 relative">
                      {dayEvents.map(event => (
                        <EventPill key={event.id} event={event} compact={columnDays.length > 3} onClick={handleEventClick} />
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </>
    );
  };

  const renderListView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const allDays = [];
    for (let i = 1; i <= daysInMonth; i++) {
      allDays.push(new Date(year, month, i));
    }

    const daysWithEvents = allDays
      .map(d => ({ date: d, events: getEventsForDate(d) }))
      .filter(d => d.events.length > 0);

    if (daysWithEvents.length === 0) {
      return (
        <div className="px-5 py-12 text-center">
          <List className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-[13px] text-gray-400">この月の予定はありません</p>
        </div>
      );
    }

    return (
      <div className="divide-y divide-gray-100">
        {daysWithEvents.map(({ date, events: dayEvents }) => {
          const isToday = date.toDateString() === new Date().toDateString();
          return (
            <div key={date.toDateString()}>
              <div className={`px-5 py-2 flex items-center gap-2 ${isToday ? 'bg-blue-50' : 'bg-gray-50/50'}`}>
                <span className={`inline-flex items-center justify-center w-7 h-7 text-[12px] font-semibold rounded-full ${
                  isToday ? 'bg-primary-600 text-white' : 'text-gray-700'
                }`}>
                  {date.getDate()}
                </span>
                <span className={`text-[12px] font-medium ${isToday ? 'text-primary-700' : 'text-gray-500'}`}>
                  {date.getMonth() + 1}月{date.getDate()}日（{weekDays[date.getDay()]}）
                </span>
                <span className="text-[10px] text-gray-400 ml-auto">{dayEvents.length}件</span>
              </div>
              <div className="divide-y divide-gray-50">
                {dayEvents.map(event => (
                  <EventListItem key={event.id} event={event} onClick={handleEventClick} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderView = () => {
    if (viewMode === 'month') return renderMonthView();
    if (viewMode === 'week') return renderColumnView(getWeekDays(currentDate));
    if (viewMode === '3day') return renderColumnView(getMultiDays(currentDate, 3));
    if (viewMode === 'day') return renderColumnView(getMultiDays(currentDate, 1));
    if (viewMode === 'list') return renderListView();
    return renderMonthView();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-800">カレンダー</h1>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          予定を追加
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <button
              onClick={handleToday}
              className="px-3 py-1.5 text-[12px] font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              今日
            </button>
            <button
              onClick={handlePrev}
              className="px-3 py-1.5 text-[12px] font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              前へ
            </button>
            <button
              onClick={handleNext}
              className="px-3 py-1.5 text-[12px] font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              次へ
            </button>
          </div>
          <h2 className="text-[14px] sm:text-[15px] font-semibold text-gray-800">
            {getHeaderTitle()}
          </h2>
          <ViewModeDropdown viewMode={viewMode} onChange={setViewMode} />
        </div>

        {renderView()}
      </div>

      {viewMode === 'month' && selectedDate && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
            <h3 className="text-[13px] font-semibold text-gray-800">
              {selectedDate.getFullYear()}年{selectedDate.getMonth() + 1}月{selectedDate.getDate()}日（{weekDays[selectedDate.getDay()]}）
            </h3>
          </div>
          {getEventsForDate(selectedDate).length > 0 ? (
            <div className="divide-y divide-gray-100">
              {getEventsForDate(selectedDate).map(event => (
                <EventListItem key={event.id} event={event} onClick={handleEventClick} />
              ))}
            </div>
          ) : (
            <div className="px-5 py-6 text-center">
              <p className="text-[12px] text-gray-400">この日の予定はありません</p>
            </div>
          )}
        </div>
      )}

      {detailEvent && (
        <EventDetailModal
          event={detailEvent}
          onClose={() => setDetailEvent(null)}
          onEdit={openEditModal}
          onDelete={handleDelete}
          canEdit={canCreate || (detailEvent.isPersonal && detailEvent.createdBy === user?.id)}
        />
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
              <h3 className="text-[14px] font-semibold text-gray-900">
                {editingEvent ? '予定を編集' : '新しい予定'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-1">タイトル</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow"
                  placeholder="予定のタイトル"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-1">種別</label>
                <select
                  value={form.eventType}
                  onChange={(e) => setForm({ ...form, eventType: e.target.value })}
                  className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                >
                  <option value="personal">個人予定</option>
                  {canCreate && <option value="event">イベント</option>}
                  {canCreate && <option value="practice">練習</option>}
                  {canCreate && <option value="match">試合</option>}
                  {canCreate && <option value="meeting">ミーティング</option>}
                  {canCreate && <option value="other">その他</option>}
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
                <label htmlFor="allDay" className="text-[13px] text-gray-600">終日</label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-gray-500 mb-1">開始日</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
                {!form.allDay && (
                  <div>
                    <label className="block text-[11px] font-medium text-gray-500 mb-1">開始時間</label>
                    <input
                      type="time"
                      value={form.startTime}
                      onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                      className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-gray-500 mb-1">終了日</label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
                {!form.allDay && (
                  <div>
                    <label className="block text-[11px] font-medium text-gray-500 mb-1">終了時間</label>
                    <input
                      type="time"
                      value={form.endTime}
                      onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                      className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-1">場所</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  placeholder="場所（任意）"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-1">説明</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                  placeholder="詳細説明（任意）"
                />
              </div>

              {form.eventType !== 'personal' && <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-1.5">
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
                          className={`px-3 py-1 text-[11px] rounded-full border transition-colors ${
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
                  <p className="text-[11px] text-gray-400 bg-gray-50 p-3 rounded-lg">
                    カテゴリーが未設定のため全員に表示されます
                  </p>
                )}
              </div>}

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-[12px] text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!form.title.trim() || !form.startDate}
                  className="px-4 py-2 text-[12px] font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
