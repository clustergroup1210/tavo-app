import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Building2, Upload, Edit2, Users, ClipboardList, Video, Calendar, ChevronRight } from 'lucide-react';
import EvaluationMatrixTable from '../components/EvaluationMatrixTable';

export default function Dashboard() {
  const navigate = useNavigate();
  const { currentTeam, isOperator, isTeamAdmin } = useAuth();
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [stats, setStats] = useState({ playerCount: 0, evaluationCount: 0, videoCount: 0, eventCount: 0 });

  useEffect(() => {
    if (currentTeam) {
      fetchTeamData();
    } else {
      setLoading(false);
    }
  }, [currentTeam]);

  const fetchTeamData = async () => {
    try {
      const teamRes = await fetch(`/api/teams/${currentTeam.id}`, { credentials: 'include' });
      if (teamRes.ok) {
        const teamData = await teamRes.json();
        setTeam(teamData);
        setName(teamData.name);
        setDescription(teamData.description || '');
        setStats(prev => ({
          ...prev,
          playerCount: teamData.players?.length || 0,
        }));
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

  const quickLinks = [
    { path: '/players', label: '選手一覧', icon: Users, count: stats.playerCount, countLabel: '名' },
    { path: '/evaluations/entry', label: '評価入力', icon: ClipboardList },
    { path: '/videos', label: '動画・資料', icon: Video },
    { path: '/calendar', label: 'カレンダー', icon: Calendar },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>
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
          <div className="relative flex-shrink-0">
            {team.logoUrl ? (
              <img
                src={team.logoUrl}
                alt=""
                className="w-16 h-16 sm:w-24 sm:h-24 rounded-xl object-cover"
              />
            ) : (
              <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-xl bg-gray-100 flex items-center justify-center">
                <Building2 className="w-8 h-8 sm:w-10 sm:h-10 text-gray-400" />
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

          <div className="flex-1 min-w-0 space-y-4">
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
                <h2 className="text-xl font-bold text-gray-900 truncate">{team.name}</h2>
                <p className="text-gray-600 text-sm line-clamp-2">{team.description || '説明はありません'}</p>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {quickLinks.map((link) => {
          const Icon = link.icon;
          return (
            <button
              key={link.path}
              onClick={() => navigate(link.path)}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:border-primary-300 hover:shadow-md transition-all text-left group"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-lg bg-primary-50 text-primary-600 group-hover:bg-primary-100 transition-colors">
                  <Icon className="w-5 h-5" />
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary-400 transition-colors" />
              </div>
              {link.count !== undefined ? (
                <p className="text-2xl font-bold text-gray-900">{link.count}<span className="text-sm font-normal text-gray-500 ml-0.5">{link.countLabel}</span></p>
              ) : null}
              <p className="text-sm font-medium text-gray-700 mt-1">{link.label}</p>
            </button>
          );
        })}
      </div>

      <EvaluationMatrixTable />
    </div>
  );
}
