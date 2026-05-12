import React from 'react';
import { useLocation } from 'react-router-dom';

export default function Placeholder() {
  const location = useLocation();

  const titles = {
    '/announcements': 'お知らせ',
    '/permissions': '権限管理',
    '/settings': 'システム設定',
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{titles[location.pathname] || 'ページ'}</h1>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
        <p className="text-gray-500">このページは準備中です</p>
      </div>
    </div>
  );
}
