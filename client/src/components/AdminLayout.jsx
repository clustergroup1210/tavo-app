import React, { useState } from 'react';
import { Menu } from 'lucide-react';
import AdminSidebar from './AdminSidebar';
import PostLoginPushPrompt from './PostLoginPushPrompt';

export default function AdminLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-gray-100">
      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:ml-60 flex flex-col min-w-0">
        <header className="lg:hidden h-12 bg-white border-b border-gray-200/80 flex items-center justify-end px-3 sticky top-0 z-[45]">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 -mr-1 text-gray-700 hover:bg-gray-100 rounded transition-colors"
            aria-label="メニューを開く"
          >
            <Menu className="w-5 h-5" />
          </button>
        </header>
        <main className="flex-1 p-4 lg:p-5">
          {children}
        </main>
      </div>
      <PostLoginPushPrompt />
    </div>
  );
}
