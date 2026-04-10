import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard, Users, UserCircle, ClipboardList, Video,
  Calendar, Megaphone, Building2, Trophy, Grid3X3
} from 'lucide-react';
import clsx from 'clsx';

export default function MobileBottomNav() {
  const { currentTeam, isOperator, isTeamAdmin, isCoach, isPlayer, isParent } = useAuth();
  const location = useLocation();

  const getNavItems = () => {
    if (isPlayer()) {
      return [
        { path: '/player-dashboard', label: 'ホーム', icon: LayoutDashboard },
        { path: '/mypage', label: 'マイページ', icon: UserCircle },
        { path: '/evaluations/entry', label: '評価', icon: ClipboardList },
        { path: '/videos', label: '動画', icon: Video },
        { path: '/calendar', label: 'カレンダー', icon: Calendar },
      ];
    }

    if (isParent()) {
      return [
        { path: '/player-dashboard', label: 'ホーム', icon: LayoutDashboard },
        { path: '/mypage', label: 'マイページ', icon: UserCircle },
        { path: '/videos', label: '動画', icon: Video },
        { path: '/calendar', label: 'カレンダー', icon: Calendar },
        { path: '/announcements', label: 'お知らせ', icon: Megaphone },
      ];
    }

    if (currentTeam && (isTeamAdmin(currentTeam.id) || isCoach(currentTeam.id))) {
      return [
        { path: '/dashboard', label: 'ホーム', icon: LayoutDashboard },
        { path: '/players', label: '選手', icon: Users },
        { path: '/evaluations/entry', label: '評価', icon: ClipboardList },
        { path: '/videos', label: '動画', icon: Video },
        { path: '/calendar', label: 'カレンダー', icon: Calendar },
      ];
    }

    if (isOperator() && !currentTeam) {
      return [
        { path: '/dashboard', label: 'ホーム', icon: LayoutDashboard },
        { path: '/teams', label: 'チーム', icon: Building2 },
        { path: '/players', label: '選手', icon: Users },
        { path: '/videos', label: '動画', icon: Video },
        { path: '/calendar', label: 'カレンダー', icon: Calendar },
      ];
    }

    if (isOperator() && currentTeam) {
      return [
        { path: '/dashboard', label: 'ホーム', icon: LayoutDashboard },
        { path: '/players', label: '選手', icon: Users },
        { path: '/evaluations/entry', label: '評価', icon: ClipboardList },
        { path: '/videos', label: '動画', icon: Video },
        { path: '/calendar', label: 'カレンダー', icon: Calendar },
      ];
    }

    return [
      { path: '/dashboard', label: 'ホーム', icon: LayoutDashboard },
      { path: '/calendar', label: 'カレンダー', icon: Calendar },
    ];
  };

  const navItems = getNavItems();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 lg:hidden safe-area-bottom">
      <div className="flex items-center justify-around h-14 px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={clsx(
                'flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors',
                isActive
                  ? 'text-primary-600'
                  : 'text-gray-400'
              )}
            >
              <div className="relative">
                <Icon className={clsx('w-5 h-5', isActive && 'stroke-[2.5]')} />
              </div>
              <span className={clsx(
                'text-[10px] leading-tight',
                isActive ? 'font-semibold' : 'font-normal'
              )}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
