import React, { useState } from 'react';
import AdminSidebar from './AdminSidebar';
import PostLoginPushPrompt from './PostLoginPushPrompt';
import { Menu } from 'lucide-react';

export default function AdminLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-gray-100">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-[55] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:ml-60 flex flex-col min-w-0">
        <header className="h-12 bg-white border-b border-gray-200/80 flex items-center justify-between px-3 fixed top-0 left-0 right-0 lg:left-60 z-[45] shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:hidden">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 -ml-1 text-gray-600 hover:bg-gray-100 rounded flex-shrink-0"
              aria-label="メニューを開く"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-sm font-bold text-gray-800 truncate">PDS<span className="text-primary-600">.</span></span>
            <span className="text-gray-300 flex-shrink-0">|</span>
            <span className="text-xs text-gray-600 truncate">システム管理</span>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-5 mt-12 lg:mt-0">
          {children}
        </main>
      </div>
      <PostLoginPushPrompt />
    </div>
  );
}
