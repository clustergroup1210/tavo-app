import React from 'react';
import AdminSidebar from './AdminSidebar';
import PostLoginPushPrompt from './PostLoginPushPrompt';

export default function AdminLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-gray-100">
      <AdminSidebar />

      <div className="flex-1 ml-60 flex flex-col min-w-0">
        <main className="flex-1 p-4 lg:p-5">
          {children}
        </main>
      </div>
      <PostLoginPushPrompt />
    </div>
  );
}
