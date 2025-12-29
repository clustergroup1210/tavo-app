import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Database, Tag, Target } from 'lucide-react';
import TeamCategoryManagement from './TeamCategoryManagement';
import GoalCategoryManagement from './GoalCategoryManagement';

export default function MasterSettings() {
  const { user, isCoach, isOperator } = useAuth();
  const [activeTab, setActiveTab] = useState('team-categories');

  const currentTeamId = user?.teams?.[0]?.teamId;
  const canManage = isCoach(currentTeamId) || isOperator();

  if (!canManage) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Database className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">マスタ設定へのアクセス権限がありません</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'team-categories', label: 'チームカテゴリー', icon: Tag },
    { id: 'goal-categories', label: '目標カテゴリー', icon: Target },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Database className="w-6 h-6 text-primary-600" />
        <h1 className="text-2xl font-bold text-gray-900">マスタ設定</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'team-categories' && <TeamCategoryManagement />}
          {activeTab === 'goal-categories' && <GoalCategoryManagement />}
        </div>
      </div>
    </div>
  );
}
