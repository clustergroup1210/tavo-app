import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  LayoutDashboard, Building2, Users, UserCog, Settings, 
  Database, Shield, LogOut, Bell
} from 'lucide-react';
import clsx from 'clsx';

export default function AdminSidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const menuItems = {
    main: [
      { path: '/admin', label: 'ダッシュボード', icon: LayoutDashboard },
      { path: '/admin/teams', label: 'チーム管理', icon: Building2 },
      { path: '/admin/users', label: 'ユーザー管理', icon: Users },
    ],
    settings: [
      { path: '/admin/organizations', label: '組織管理', icon: Shield },
      { path: '/admin/master', label: 'マスタ設定', icon: Database },
      { path: '/admin/notifications', label: '通知管理', icon: Bell },
      { path: '/admin/settings', label: 'システム設定', icon: Settings },
    ],
  };

  const NavLink = ({ item }) => {
    const isActive = location.pathname === item.path || 
      (item.path !== '/admin' && location.pathname.startsWith(item.path));
    const Icon = item.icon;

    return (
      <Link
        to={item.path}
        className={clsx(
          'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
          isActive
            ? 'bg-indigo-50 text-indigo-700'
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
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-gray-900">システム管理</h2>
            <p className="text-xs text-gray-500">管理者コンソール</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {menuItems.main.map((item) => (
          <NavLink key={item.path} item={item} />
        ))}
      </nav>

      <div className="p-4 border-t border-gray-200">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 px-4">
          設定
        </p>
        <div className="space-y-1">
          {menuItems.settings.map((item) => (
            <NavLink key={item.path} item={item} />
          ))}
        </div>
      </div>

      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-3 px-4 py-2">
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
            <span className="text-sm font-medium text-indigo-700">
              {user?.name?.charAt(0) || 'A'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
            <p className="text-xs text-gray-500 truncate">システム管理者</p>
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
