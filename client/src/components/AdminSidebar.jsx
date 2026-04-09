import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  LayoutDashboard, Building2, Users, UserCog, Settings, 
  Database, Shield, LogOut, Bell, X
} from 'lucide-react';
import clsx from 'clsx';

export default function AdminSidebar({ isOpen, onClose }) {
  const { user, logout } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (isOpen) {
      onClose?.();
    }
  }, [location.pathname]);

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
          'flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150',
          isActive
            ? 'bg-white/15 text-white'
            : 'text-slate-300 hover:bg-white/10 hover:text-white'
        )}
      >
        <Icon className="w-[18px] h-[18px] flex-shrink-0" />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  };

  return (
    <aside
      className={clsx(
        'fixed left-0 top-0 h-screen w-64 bg-sidebar flex flex-col z-50 transition-transform duration-300',
        'lg:translate-x-0',
        isOpen ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      <div className="px-4 pt-5 pb-4 border-b border-white/10">
        <div className="flex items-center justify-between lg:hidden mb-3">
          <span className="text-sm font-medium text-slate-400">メニュー</span>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-500 flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-white text-sm">システム管理</h2>
            <p className="text-[11px] text-slate-400">管理者コンソール</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto scrollbar-hide">
        {menuItems.main.map((item) => (
          <NavLink key={item.path} item={item} />
        ))}
      </nav>

      <div className="px-3 pb-3 pt-1 border-t border-white/10">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2 px-4 pt-3">
          設定
        </p>
        <div className="space-y-0.5">
          {menuItems.settings.map((item) => (
            <NavLink key={item.path} item={item} />
          ))}
        </div>
      </div>

      <div className="px-4 py-3 border-t border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-semibold text-white">
              {user?.name?.charAt(0) || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
          </div>
          <button
            onClick={logout}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            title="ログアウト"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
