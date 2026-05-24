import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  LayoutDashboard, Building2, Users, UserCog, Settings, 
  Shield, LogOut, Bell, X
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
      className="fixed top-0 h-screen w-60 bg-sidebar flex flex-col z-[60] left-0"
    >
      <div className="px-4 pt-4 pb-3 border-b border-white/[0.06]">
        <div className="flex items-center justify-between mb-3">
          <Link to="/admin" className="flex items-center group" aria-label="ホームへ">
            <img src="/tavo-logo-white.png" alt="TAVO" className="h-9 w-auto group-hover:opacity-80 transition-opacity" />
          </Link>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-blue-500 flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-medium text-white text-[13px]">システム管理</h2>
            <p className="text-[10px] text-slate-400">管理者コンソール</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-2.5 py-2.5 space-y-[2px] overflow-y-auto scrollbar-hide">
        {menuItems.main.map((item) => (
          <NavLink key={item.path} item={item} />
        ))}
      </nav>

      <div className="px-2.5 pb-2.5 border-t border-white/[0.06]">
        <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1.5 px-3 pt-2.5">
          設定
        </p>
        <div className="space-y-[2px]">
          {menuItems.settings.map((item) => (
            <NavLink key={item.path} item={item} />
          ))}
        </div>
      </div>

      <div className="px-3 py-2.5 border-t border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] font-medium text-white">{user?.name?.charAt(0) || 'U'}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-medium text-white truncate">{user?.name}</p>
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
    </aside>
  );
}
