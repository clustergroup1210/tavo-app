import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Settings, Save, Building2, Upload, Image, Users, Shield,
  CheckCircle, RefreshCw, Trash2, AlertTriangle, Info,
  ClipboardList, Target, Link2, UserPlus, Bell
} from 'lucide-react';
import clsx from 'clsx';

export default function TeamSettings() {
  const { user, currentTeam, isTeamAdmin, isOperator } = useAuth();
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [logoPreview, setLogoPreview] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef(null);

  const [stats, setStats] = useState(null);
  const [staffList, setStaffList] = useState([]);
  const [subTeams, setSubTeams] = useState([]);

  const teamId = currentTeam?.id || user?.teams?.[0]?.teamId;
  const canManage = isTeamAdmin(teamId) || isOperator();

  useEffect(() => {
    if (teamId) {
      fetchTeamData();
    }
  }, [teamId]);

  const fetchTeamData = async () => {
    try {
      const [teamRes, statsRes, staffRes] = await Promise.all([
        fetch(`/api/teams/${teamId}`, { credentials: 'include' }),
        fetch(`/api/teams/${teamId}/stats`, { credentials: 'include' }).catch(() => null),
        fetch(`/api/teams/${teamId}/staff`, { credentials: 'include' }).catch(() => null),
      ]);

      if (teamRes.ok) {
        const teamData = await teamRes.json();
        setTeam(teamData);
        setName(teamData.name || '');
        setDescription(teamData.description || '');
        setLogoPreview(teamData.logoUrl);
        if (teamData.children) {
          setSubTeams(teamData.children);
        }
      }

      if (statsRes?.ok) {
        setStats(await statsRes.json());
      }

      if (staffRes?.ok) {
        setStaffList(await staffRes.json());
      }
    } catch (err) {
      console.error('Failed to fetch team data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      setError('チーム名を入力してください');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/teams/${teamId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTeam(prev => ({ ...prev, ...updated }));
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        const data = await res.json();
        setError(data.error || '保存に失敗しました');
      }
    } catch (err) {
      setError('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('画像ファイルを選択してください');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('ファイルサイズは5MB以下にしてください');
      return;
    }

    setUploadingLogo(true);
    setError('');
    const formData = new FormData();
    formData.append('logo', file);

    try {
      const res = await fetch(`/api/teams/${teamId}/logo`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (res.ok) {
        const updated = await res.json();
        setLogoPreview(updated.logoUrl);
        setTeam(prev => ({ ...prev, logoUrl: updated.logoUrl }));
      } else {
        setError('ロゴのアップロードに失敗しました');
      }
    } catch (err) {
      setError('ロゴのアップロードに失敗しました');
    } finally {
      setUploadingLogo(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'チーム情報', icon: Building2 },
    { id: 'members', label: 'メンバー概要', icon: Users },
    { id: 'stats', label: 'チーム統計', icon: ClipboardList },
  ];

  if (!teamId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">チームが選択されていません</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">システム設定へのアクセス権限がありません</p>
        </div>
      </div>
    );
  }

  const ROLE_LABELS = {
    TEAM_MANAGER: 'チーム管理者',
    COACH: 'コーチ',
    GUEST_COACH: '外部コーチ',
    PLAYER: '選手',
    PARENT: '保護者',
  };

  const ROLE_COLORS = {
    TEAM_MANAGER: 'bg-red-100 text-red-700',
    COACH: 'bg-blue-100 text-blue-700',
    GUEST_COACH: 'bg-purple-100 text-purple-700',
    PLAYER: 'bg-green-100 text-green-700',
    PARENT: 'bg-orange-100 text-orange-700',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">システム設定</h1>
          <p className="mt-1 text-sm text-gray-500">{team?.name} の設定を管理します</p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap',
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {activeTab === 'profile' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Image className="w-4 h-4 text-primary-600" />
                チームロゴ
              </h2>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 rounded-xl bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Team logo" className="w-full h-full object-cover" />
                  ) : (
                    <Building2 className="w-10 h-10 text-gray-400" />
                  )}
                </div>
                <div>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploadingLogo}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm disabled:opacity-50"
                  >
                    {uploadingLogo ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    {uploadingLogo ? 'アップロード中...' : 'ロゴを変更'}
                  </button>
                  <p className="text-xs text-gray-500 mt-2">推奨: 200x200px以上、5MB以下の画像</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary-600" />
                基本情報
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">チーム名 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setSaved(false); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="チーム名を入力"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">チーム説明</label>
                <textarea
                  value={description}
                  onChange={(e) => { setDescription(e.target.value); setSaved(false); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  rows={4}
                  placeholder="チームの説明を入力（任意）"
                />
              </div>
              <div className="flex items-center justify-between pt-2">
                <div>
                  {saved && (
                    <span className="text-sm text-green-600 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" />
                      保存しました
                    </span>
                  )}
                </div>
                <button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
                >
                  {saving ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {saving ? '保存中...' : '基本情報を保存'}
                </button>
              </div>
            </div>
          </div>

          {subTeams.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary-600" />
                  サブチーム
                </h2>
              </div>
              <div className="divide-y divide-gray-100">
                {subTeams.map(sub => (
                  <div key={sub.id} className="px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary-50 rounded-lg flex items-center justify-center">
                        <Building2 className="w-4 h-4 text-primary-600" />
                      </div>
                      <span className="text-sm font-medium text-gray-900">{sub.name}</span>
                    </div>
                    <span className="text-xs text-gray-500">{sub._count?.players || 0}人</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700">
              <p className="font-medium mb-1">チーム設定のヒント</p>
              <ul className="space-y-1 text-blue-600">
                <li>・ロゴは選手一覧やアピールページに表示されます</li>
                <li>・チーム名の変更は全ての関連ページに反映されます</li>
                <li>・カテゴリー管理は「マスタ設定」から行えます</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'members' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary-600" />
                スタッフ一覧
              </h2>
            </div>
            {staffList.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p>スタッフが登録されていません</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {staffList.map((staff) => (
                  <div key={staff.id} className="px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                        <Users className="w-5 h-5 text-gray-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{staff.user?.name || '未設定'}</p>
                        <p className="text-xs text-gray-500">{staff.user?.email}</p>
                      </div>
                    </div>
                    <span className={clsx(
                      'text-xs px-2.5 py-1 rounded-full font-medium',
                      ROLE_COLORS[staff.role] || 'bg-gray-100 text-gray-600'
                    )}>
                      {ROLE_LABELS[staff.role] || staff.role}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Link2 className="w-4 h-4 text-primary-600" />
                クイックリンク
              </h2>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { path: '/users', label: 'ユーザー管理', icon: Users, desc: 'メンバーの追加・編集' },
                { path: '/staff', label: 'スタッフ管理', icon: Shield, desc: 'スタッフの役割管理' },
                { path: '/invitations', label: '招待URL管理', icon: Link2, desc: '招待リンクの発行' },
                { path: '/join-requests', label: '参加申請', icon: UserPlus, desc: '参加リクエストの確認' },
                { path: '/coach-assignments', label: '指導者体制', icon: Users, desc: 'コーチの担当設定' },
                { path: '/notification-settings', label: '通知設定', icon: Bell, desc: '通知の設定管理' },
              ].map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
                  >
                    <div className="p-2 bg-primary-50 rounded-lg flex-shrink-0">
                      <Icon className="w-4 h-4 text-primary-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{link.label}</p>
                      <p className="text-xs text-gray-500">{link.desc}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: '選手数', value: stats?.playerCount ?? team?._count?.players ?? 0, icon: Users, color: 'bg-blue-50 text-blue-600' },
              { label: 'スタッフ数', value: staffList.length, icon: Shield, color: 'bg-green-50 text-green-600' },
              { label: 'サブチーム', value: subTeams.length, icon: Building2, color: 'bg-purple-50 text-purple-600' },
              { label: '評価項目数', value: stats?.evaluationItemCount ?? 0, icon: ClipboardList, color: 'bg-orange-50 text-orange-600' },
            ].map((item, idx) => {
              const Icon = item.icon;
              return (
                <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center gap-3">
                    <div className={clsx('p-2.5 rounded-lg', item.color)}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">{item.label}</p>
                      <p className="text-xl font-bold text-gray-900">{item.value}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-primary-600" />
                データ概要
              </h2>
            </div>
            <div className="divide-y divide-gray-100">
              {[
                { label: '評価ラウンド数', value: stats?.roundCount ?? 0 },
                { label: '評価データ数', value: stats?.evaluationCount ?? 0 },
                { label: '動画数', value: stats?.videoCount ?? 0 },
                { label: 'カレンダーイベント数', value: stats?.calendarEventCount ?? 0 },
                { label: 'お知らせ数', value: stats?.announcementCount ?? 0 },
                { label: '目標カテゴリー数', value: stats?.goalCategoryCount ?? 0 },
              ].map((item, idx) => (
                <div key={idx} className="px-6 py-3 flex items-center justify-between">
                  <span className="text-sm text-gray-600">{item.label}</span>
                  <span className="text-sm font-semibold text-gray-900">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Info className="w-4 h-4 text-gray-500" />
                チーム情報
              </h2>
            </div>
            <div className="divide-y divide-gray-100">
              <div className="px-6 py-3 flex items-center justify-between">
                <span className="text-sm text-gray-600">チームID</span>
                <span className="text-xs font-mono text-gray-500">{teamId}</span>
              </div>
              <div className="px-6 py-3 flex items-center justify-between">
                <span className="text-sm text-gray-600">作成日</span>
                <span className="text-sm text-gray-900">
                  {team?.createdAt ? new Date(team.createdAt).toLocaleDateString('ja-JP') : '-'}
                </span>
              </div>
              <div className="px-6 py-3 flex items-center justify-between">
                <span className="text-sm text-gray-600">所属組織</span>
                <span className="text-sm text-gray-900">{team?.organization?.name || '-'}</span>
              </div>
              {team?.headCoach && (
                <div className="px-6 py-3 flex items-center justify-between">
                  <span className="text-sm text-gray-600">ヘッドコーチ</span>
                  <span className="text-sm text-gray-900">{team.headCoach.name}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
