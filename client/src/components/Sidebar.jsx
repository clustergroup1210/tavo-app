import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  LayoutDashboard, Users, UserCircle, ClipboardList, Video, 
  Bell, Settings, Building2, UserCog, ListChecks,
  Link2, FileText, TrendingUp, LogOut, Megaphone, ArrowLeft, Shield, Trophy, Target,
  Calendar, UserPlus, X, Grid3X3
} from 'lucide-react';
import clsx from 'clsx';

export default function Sidebar({ isOpen, onClose }) {
  const { user, currentTeam, teams, setCurrentTeam, logout, isOperator, isTeamAdmin, isCoach, isPlayer, isParent, playerData, childPlayerData } = useAuth();
  const location = useLocation();
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState(null);

  useEffect(() => {
    if (isOperator()) {
      fetchOrganizations();
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      onClose?.();
    }
  }, [location.pathname]);

  const fetchOrganizations = async () => {
    try {
      const res = await fetch('/api/organizations', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setOrganizations(data);
        if (data.length > 0) setSelectedOrg(data[0]);
      }
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
    }
  };

  const getMenuItems = () => {
    if (isOperator() && !currentTeam) {
      return {
        main: [
          { path: '/dashboard', label: 'ダッシュボード', icon: LayoutDashboard },
          { path: '/teams', label: 'チーム一覧', icon: Building2 },
          { path: '/players', label: '選手一覧', icon: Users },
          { path: '/evaluations/entry', label: '評価データ', icon: ClipboardList },
          { path: '/ranking', label: 'ランキング', icon: Trophy },
          { path: '/videos', label: '動画管理', icon: Video },
          { path: '/calendar', label: 'カレンダー', icon: Calendar },
          { path: '/announcements', label: 'お知らせ', icon: Megaphone },
        ],
        admin: [
          { path: '/users', label: 'ユーザー管理', icon: UserCog },
          { path: '/permissions', label: '権限管理', icon: UserCog },
          { path: '/evaluations/items', label: '評価項目管理', icon: ListChecks },
          { path: '/settings', label: 'システム設定', icon: Settings },
        ],
      };
    }

    if (currentTeam && isOperator()) {
      return {
        main: [
          { path: '/dashboard', label: 'ダッシュボード', icon: LayoutDashboard },
          { path: '/players', label: '選手一覧', icon: Users },
          { path: '/evaluations/entry', label: '評価入力', icon: ClipboardList },
          { path: '/evaluations/matrix', label: '評価マトリクス', icon: Grid3X3 },
          { path: '/ranking', label: 'ランキング', icon: Trophy },
          { path: '/videos', label: '動画・資料', icon: Video },
          { path: '/calendar', label: 'カレンダー', icon: Calendar },
          { path: '/announcements', label: 'お知らせ', icon: Megaphone },
        ],
        admin: [
          { path: '/users', label: 'ユーザー管理', icon: UserCog },
          { path: '/permissions', label: '権限管理', icon: Shield },
          { path: '/evaluations/items', label: '評価項目管理', icon: ListChecks },
          { path: '/settings', label: 'システム設定', icon: Settings },
        ],
      };
    }

    if (currentTeam && (isTeamAdmin(currentTeam.id) || isCoach(currentTeam.id))) {
      const items = {
        main: [
          { path: '/dashboard', label: 'ダッシュボード', icon: LayoutDashboard },
          { path: '/players', label: '選手一覧', icon: Users },
          { path: '/evaluations/entry', label: '評価入力', icon: ClipboardList },
          { path: '/evaluations/matrix', label: '評価マトリクス', icon: Grid3X3 },
          { path: '/ranking', label: 'ランキング', icon: Trophy },
          { path: '/videos', label: '動画・資料', icon: Video },
          { path: '/calendar', label: 'カレンダー', icon: Calendar },
          { path: '/announcements', label: 'お知らせ', icon: Megaphone },
        ],
        admin: [],
      };

      if (isTeamAdmin(currentTeam.id)) {
        items.admin = [
          { path: '/users', label: 'ユーザー管理', icon: UserCog },
          { path: '/staff', label: 'スタッフ管理', icon: Shield },
          { path: '/coach-assignments', label: '指導者体制', icon: Users },
          { path: '/invitations', label: '招待URL管理', icon: Link2 },
          { path: '/join-requests', label: '参加申請', icon: UserPlus },
          { path: '/team-categories', label: 'カテゴリー管理', icon: Users },
          { path: '/goal-categories', label: '目標カテゴリー管理', icon: Target },
        ];
      }

      return items;
    }

    if (isPlayer()) {
      return {
        main: [
          { path: '/player-dashboard', label: 'ダッシュボード', icon: LayoutDashboard },
          { path: '/mypage', label: 'マイページ', icon: UserCircle },
          { path: '/evaluations/entry', label: '評価', icon: ClipboardList },
          { path: '/videos', label: '動画', icon: Video },
          { path: '/calendar', label: 'カレンダー', icon: Calendar },
          { path: '/announcements', label: 'お知らせ', icon: Megaphone },
          { path: '/appeal-management', label: 'アピールページ', icon: Link2 },
          { path: '/account-settings', label: 'アカウント設定', icon: Settings },
        ],
        admin: [],
      };
    }

    if (isParent()) {
      return {
        main: [
          { path: '/player-dashboard', label: 'ダッシュボード', icon: LayoutDashboard },
          { path: '/mypage', label: 'マイページ', icon: UserCircle },
          { path: '/videos', label: '動画', icon: Video },
          { path: '/calendar', label: 'カレンダー', icon: Calendar },
          { path: '/announcements', label: 'お知らせ', icon: Megaphone },
          { path: '/account-settings', label: 'アカウント設定', icon: Settings },
        ],
        admin: [],
      };
    }

    return { main: [{ path: '/dashboard', label: 'ダッシュボード', icon: LayoutDashboard }], admin: [] };
  };

  const menuItems = getMenuItems();

  const NavLink = ({ item }) => {
    const isActive = location.pathname === item.path;
    const Icon = item.icon;

    return (
      <Link
        to={item.path}
        className={clsx(
          'flex items-center gap-2.5 px-3 py-[7px] rounded text-[12.5px] transition-all duration-150',
          isActive
            ? 'bg-blue-600 text-white font-medium'
            : 'text-slate-300/90 hover:bg-white/[0.08] hover:text-white font-normal'
        )}
      >
        <Icon className="w-4 h-4 flex-shrink-0" />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  };

  return (
    <aside
      className={clsx(
        'fixed top-0 h-screen w-60 bg-sidebar flex flex-col z-[60] transition-transform duration-300',
        'left-0 lg:translate-x-0',
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}
    >
      <div className="px-4 pt-4 pb-3 border-b border-white/[0.06]">
        <div className="flex items-center justify-between mb-3">
          <Link to={isOperator() ? '/admin' : (isPlayer() || isParent()) ? '/player-dashboard' : '/dashboard'} className="flex items-baseline gap-0.5 group">
            <span className="text-[20px] font-bold text-white tracking-tight leading-none group-hover:text-blue-300 transition-colors">PDS</span>
            <span className="text-[20px] font-bold text-blue-400 leading-none">.</span>
          </Link>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded lg:hidden">
            <X className="w-4 h-4" />
          </button>
        </div>

        {isOperator() && (
          <Link
            to="/admin"
            className="flex items-center gap-1.5 px-2.5 py-1.5 mb-2.5 text-[11px] text-blue-300 bg-white/[0.06] rounded hover:bg-white/[0.1] transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            管理画面に戻る
          </Link>
        )}
        <div className="flex items-center gap-2.5">
          {isPlayer() && playerData ? (
            <>
              {playerData.photoUrl ? (
                <img src={playerData.photoUrl} alt="" className="w-8 h-8 rounded-full object-cover ring-1 ring-white/20" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                  <UserCircle className="w-4 h-4 text-white/60" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h2 className="font-medium text-white text-[13px] truncate">{playerData.name}</h2>
                <p className="text-[10px] text-slate-400 truncate">{currentTeam?.name}</p>
              </div>
            </>
          ) : isParent() && childPlayerData ? (
            <>
              {childPlayerData.photoUrl ? (
                <img src={childPlayerData.photoUrl} alt="" className="w-8 h-8 rounded-full object-cover ring-1 ring-white/20" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                  <UserCircle className="w-4 h-4 text-white/60" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h2 className="font-medium text-white text-[13px] truncate">{childPlayerData.name}</h2>
                <p className="text-[10px] text-slate-400 truncate">{childPlayerData.team?.name || currentTeam?.name}</p>
                <p className="text-[9px] text-pink-400">保護者</p>
              </div>
            </>
          ) : (
            <>
              {currentTeam?.logoUrl ? (
                <img src={currentTeam.logoUrl} alt="" className="w-8 h-8 rounded object-cover ring-1 ring-white/20" />
              ) : (
                <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-white/60" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h2 className="font-medium text-white text-[13px] truncate">{currentTeam?.name || 'チーム未選択'}</h2>
              </div>
            </>
          )}
        </div>

        {isOperator() && organizations.length > 1 && (
          <select
            value={selectedOrg?.id || ''}
            onChange={(e) => {
              const org = organizations.find(o => o.id === e.target.value);
              if (org) setSelectedOrg(org);
            }}
            className="mt-2 w-full text-[11px] text-white/80 bg-white/[0.06] border border-white/[0.06] rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-white/20"
          >
            {organizations.map((org) => (
              <option key={org.id} value={org.id} className="bg-sidebar-dark text-white">{org.name}</option>
            ))}
          </select>
        )}

        {!isOperator() && teams.length > 1 && (
          <select
            value={currentTeam?.id || ''}
            onChange={(e) => {
              const team = teams.find(t => t.team.id === e.target.value)?.team;
              if (team) setCurrentTeam(team);
            }}
            className="mt-2 w-full text-[11px] text-white/80 bg-white/[0.06] border border-white/[0.06] rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-white/20"
          >
            {teams.map(({ team }) => (
              <option key={team.id} value={team.id} className="bg-sidebar-dark text-white">{team.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <nav className="px-2.5 py-2.5 space-y-[2px]">
          {menuItems.main.map((item) => (
            <NavLink key={item.path} item={item} />
          ))}
        </nav>

        {menuItems.admin.length > 0 && (
          <div className="px-2.5 pb-2.5">
            <div className="border-t border-white/[0.06] pt-2.5 mb-1">
              <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1.5 px-3">
                管理
              </p>
            </div>
            <div className="space-y-[2px]">
              {menuItems.admin.map((item) => (
                <NavLink key={item.path} item={item} />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-white/[0.06] flex-shrink-0">
        <div className="px-2.5 py-1.5">
          <Link
            to="/notification-settings"
            className={clsx(
              'flex items-center gap-2.5 px-3 py-[7px] rounded text-[12.5px] transition-all duration-150',
              location.pathname === '/notification-settings'
                ? 'bg-blue-600 text-white font-medium'
                : 'text-slate-300/90 hover:bg-white/[0.08] hover:text-white font-normal'
            )}
          >
            <Bell className="w-4 h-4" />
            通知設定
          </Link>
        </div>
        <div className="px-3 py-2.5 border-t border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
              <span className="text-[10px] font-medium text-white">{user?.name?.charAt(0) || 'U'}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-white truncate">{user?.name}</p>
              <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
            </div>
            <button
              onClick={logout}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/[0.08] transition-colors"
              title="ログアウト"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
