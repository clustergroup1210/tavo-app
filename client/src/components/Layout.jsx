import React, { useState } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import PostLoginPushPrompt from './PostLoginPushPrompt';
import NotificationBell from './NotificationBell';
import { useAuth } from '../contexts/AuthContext';

export default function Layout({ children }) {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:ml-60 flex flex-col min-w-0">
        <header className="h-12 bg-white border-b border-gray-200/80 flex items-center justify-between px-3 lg:px-5 fixed top-0 left-0 lg:left-60 right-0 z-[45] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-2 min-w-0" />

          <div className="flex items-center gap-2 ml-auto flex-shrink-0">
            <NotificationBell />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-sidebar flex items-center justify-center text-white text-[10px] font-medium">
                {user?.name?.charAt(0) || 'U'}
              </div>
              <span className="hidden sm:inline text-[12.5px] font-medium text-gray-600">{user?.name}</span>
            </div>
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 -mr-1 text-gray-700 hover:bg-gray-100 rounded transition-colors"
              aria-label="メニューを開く"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-5 min-w-0 mt-12">
          {children}
        </main>
      </div>

      <PostLoginPushPrompt />
    </div>
  );
}
