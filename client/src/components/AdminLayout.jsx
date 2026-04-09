import React, { useState } from 'react';
import AdminSidebar from './AdminSidebar';
import { Menu } from 'lucide-react';

export default function AdminLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-gray-100">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:ml-64 flex flex-col min-w-0">
        <header className="h-14 bg-white border-b border-gray-200/80 flex items-center px-4 fixed top-0 left-0 right-0 lg:left-64 z-30 shadow-sm lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-lg"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="ml-3 font-semibold text-gray-800 text-sm">システム管理</span>
        </header>
        <main className="flex-1 p-4 lg:p-6 mt-14 lg:mt-0">
          {children}
        </main>
      </div>
    </div>
  );
}
