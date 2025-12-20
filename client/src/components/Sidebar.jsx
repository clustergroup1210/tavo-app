import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  LayoutDashboard, Users, UserCircle, ClipboardList, Video, 
  Bell, Settings, Building2, UserCog, ListChecks, Database,
  Link2, FileText, TrendingUp, LogOut, Megaphone, ArrowLeft, Shield, Trophy
} from 'lucide-react';
import clsx from 'clsx';

export default function Sidebar() {
  const { user, currentTeam, teams, setCurrentTeam, logout, isOperator, isTeamAdmin, isCoach, isPlayer, isParent } = useAuth();
  const location = useLocation();
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState(null);

  useEffect(() => {
    if (isOperator()) {
      fetchOrganizations();
    }
  }, []);

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
          { path: '/announcements', label: 'お知らせ', icon: Megaphone },
        ],
        admin: [
          { path: '/users', label: 'ユーザー管理', icon: UserCog },
          { path: '/permissions', label: '権限管理', icon: UserCog },
          { path: '/evaluations/items', label: '評価項目管理', icon: ListChecks },
          { path: '/master', label: 'マスタ設定', icon: Database },
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
          { path: '/ranking', label: 'ランキング', icon: Trophy },
          { path: '/videos', label: '動画・資料', icon: Video },
          { path: '/announcements', label: 'お知らせ', icon: Megaphone },
        ],
        admin: [
          { path: '/users', label: 'ユーザー管理', icon: UserCog },
          { path: '/permissions', label: '権限管理', icon: Shield },
          { path: '/evaluations/items', label: '評価項目管理', icon: ListChecks },
          { path: '/master', label: 'マスタ設定', icon: Database },
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
          { path: '/ranking', label: 'ランキング', icon: Trophy },
          { path: '/videos', label: '動画・資料', icon: Video },
          { path: '/announcements', label: 'お知らせ', icon: Megaphone },
        ],
        admin: [],
      };

      if (isTeamAdmin(currentTeam.id)) {
        items.admin = [
          { path: '/users', label: 'ユーザー管理', icon: UserCog },
          { path: '/invitations', label: '招待URL管理', icon: Link2 },
        ];
      }

      return items;
    }

    if (isPlayer()) {
      return {
        main: [
          { path: '/mypage', label: 'マイページ', icon: UserCircle },
          { path: '/evaluations/entry', label: '評価', icon: ClipboardList },
          { path: '/dashboard', label: '上達状況', icon: TrendingUp },
          { path: '/videos', label: '動画', icon: Video },
        ],
        admin: [],
      };
    }

    if (isParent()) {
      return {
        main: [
          { path: '/mypage', label: 'マイページ', icon: UserCircle },
          { path: '/dashboard', label: '評価（閲覧）', icon: ClipboardList },
          { path: '/videos', label: '動画投稿', icon: Video },
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
          'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
          isActive
            ? 'bg-primary-50 text-primary-700'
            : 'text-gray-600 hover:bg-gray-100'
        )}
      >
        <Icon className="w-5 h-5" />
        {item.label}
      </Link>
    );
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        {isOperator() && (
          <Link
            to="/admin"
            className="flex items-center gap-2 px-3 py-2 mb-3 text-sm text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            管理画面に戻る
          </Link>
        )}
        <div className="flex items-center gap-3">
          {currentTeam?.logoUrl ? (
            <img
              src={currentTeam.logoUrl}
              alt=""
              className="w-10 h-10 rounded-lg object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-gray-500" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-gray-900 truncate">
              {currentTeam?.name || 'チーム未選択'}
            </h2>
          </div>
        </div>

        {isOperator() && organizations.length > 1 && (
          <select
            value={selectedOrg?.id || ''}
            onChange={(e) => {
              const org = organizations.find(o => o.id === e.target.value);
              if (org) setSelectedOrg(org);
            }}
            className="mt-3 w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
          >
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
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
            className="mt-3 w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
          >
            {teams.map(({ team }) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {menuItems.main.map((item) => (
          <NavLink key={item.path} item={item} />
        ))}
      </nav>

      {menuItems.admin.length > 0 && (
        <div className="p-4 border-t border-gray-200">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 px-4">
            管理
          </p>
          <div className="space-y-1">
            {menuItems.admin.map((item) => (
              <NavLink key={item.path} item={item} />
            ))}
          </div>
        </div>
      )}

      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-3 px-4 py-2">
          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
            <span className="text-sm font-medium text-primary-700">
              {user?.name?.charAt(0) || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
