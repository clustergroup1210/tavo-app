import React, { useState } from 'react';
import Sidebar from './Sidebar';
import MobileBottomNav from './MobileBottomNav';
import NotificationBell from './NotificationBell';
import { useAuth } from '../contexts/AuthContext';
import { Menu, Building2, UserCircle } from 'lucide-react';

export default function Layout({ children }) {
  const { user, currentTeam, isPlayer, isParent, playerData, childPlayerData } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const getHeaderInfo = () => {
    if (isPlayer() && playerData) {
      return { name: playerData.name, logoUrl: playerData.photoUrl, isRound: true };
    }
    if (isParent() && childPlayerData) {
      return { name: childPlayerData.name, logoUrl: childPlayerData.photoUrl, isRound: true };
    }
    return { name: currentTeam?.name || '', logoUrl: currentTeam?.logoUrl, isRound: false };
  };

  const headerInfo = getHeaderInfo();

  return (
    <div className="flex min-h-screen bg-gray-100">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-[55] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:ml-60 flex flex-col min-w-0">
        <header className="h-12 bg-white border-b border-gray-200/80 flex items-center justify-between px-4 lg:px-5 fixed top-0 left-0 right-0 lg:left-60 z-[45] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-2.5 lg:hidden min-w-0">
            {headerInfo.logoUrl ? (
              <img
                src={headerInfo.logoUrl}
                alt=""
                className={`w-7 h-7 object-cover flex-shrink-0 ${headerInfo.isRound ? 'rounded-full' : 'rounded'}`}
              />
            ) : (
              <div className={`w-7 h-7 bg-gray-100 flex items-center justify-center flex-shrink-0 ${headerInfo.isRound ? 'rounded-full' : 'rounded'}`}>
                {headerInfo.isRound ? (
                  <UserCircle className="w-4 h-4 text-gray-400" />
                ) : (
                  <Building2 className="w-4 h-4 text-gray-400" />
                )}
              </div>
            )}
            {headerInfo.name && (
              <span className="text-sm font-semibold text-gray-800 truncate">{headerInfo.name}</span>
            )}
          </div>

          <div className="hidden lg:flex items-center gap-2 min-w-0">
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <NotificationBell />
            <div className="hidden lg:flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-sidebar flex items-center justify-center text-white text-[10px] font-medium">
                {user?.name?.charAt(0) || 'U'}
              </div>
              <span className="text-[12.5px] font-medium text-gray-600">{user?.name}</span>
            </div>
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded lg:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-5 min-w-0 mt-12 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] lg:pb-5">
          {children}
        </main>
      </div>

      {!sidebarOpen && <MobileBottomNav />}
    </div>
  );
}
