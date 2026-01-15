import React from 'react';
import Sidebar from './Sidebar';
import NotificationBell from './NotificationBell';
import { useAuth } from '../contexts/AuthContext';

export default function Layout({ children }) {
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col">
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-end px-6 sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <NotificationBell />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-medium text-sm">
                {user?.name?.charAt(0) || 'U'}
              </div>
              <span className="text-sm text-gray-700 hidden sm:block">{user?.name}</span>
            </div>
          </div>
        </header>
        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
