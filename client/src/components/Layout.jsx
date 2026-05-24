import React from 'react';
import Sidebar from './Sidebar';
import PostLoginPushPrompt from './PostLoginPushPrompt';
import NotificationBell from './NotificationBell';
import { useAuth } from '../contexts/AuthContext';

export default function Layout({ children }) {
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />

      <div className="flex-1 ml-60 flex flex-col min-w-0">
        <header className="h-12 bg-white border-b border-gray-200/80 flex items-center justify-between px-3 lg:px-5 fixed top-0 left-60 right-0 z-[45] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-2 min-w-0" />

          <div className="flex items-center gap-2 ml-auto flex-shrink-0">
            <NotificationBell />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-sidebar flex items-center justify-center text-white text-[10px] font-medium">
                {user?.name?.charAt(0) || 'U'}
              </div>
              <span className="text-[12.5px] font-medium text-gray-600">{user?.name}</span>
            </div>
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
