import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  ArrowLeft, Building2, Users, ClipboardList, Video, 
  UserPlus, Settings, ChevronRight, Edit, User, ExternalLink
} from 'lucide-react';

export default function AdminTeamView() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const { setCurrentTeam } = useAuth();
  const [team, setTeam] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchTeamData();
  }, [teamId]);

  const fetchTeamData = async () => {
    try {
      const [teamRes, playersRes] = await Promise.all([
        fetch(`/api/admin/teams/${teamId}`, { credentials: 'include' }),
        fetch(`/api/players?teamId=${teamId}&includeChildren=true`, { credentials: 'include' })
      ]);

      if (teamRes.ok) {
        const teamData = await teamRes.json();
        setTeam(teamData);
      }
      if (playersRes.ok) {
        const playersData = await playersRes.json();
        setPlayers(playersData);
      }
    } catch (error) {
      console.error('Failed to fetch team data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const handleEnterTeamDashboard = () => {
    setCurrentTeam(team);
    navigate('/dashboard');
  };

  if (!team) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">チームが見つかりません</p>
        <button
          onClick={() => navigate('/admin')}
          className="mt-4 text-primary-600 hover:text-primary-700"
        >
          ダッシュボードに戻る
        </button>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: '概要' },
    { id: 'players', label: '選手一覧' },
    { id: 'categories', label: 'カテゴリー' },
    { id: 'staff', label: 'スタッフ' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/admin')}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-4">
          {team.logoUrl ? (
            <img
              src={team.logoUrl}
              alt=""
              className="w-14 h-14 rounded-xl object-cover"
            />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center">
              <Building2 className="w-7 h-7 text-gray-400" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{team.name}</h1>
            <p className="text-sm text-gray-500">{team.organization?.name}</p>
          </div>
        </div>
        <button
          onClick={handleEnterTeamDashboard}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          チームとしてログイン
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex gap-6 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Users className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">選手数</p>
                    <p className="text-xl font-bold text-gray-900">{players.length}</p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Building2 className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">カテゴリー数</p>
                    <p className="text-xl font-bold text-gray-900">{team.children?.length || 0}</p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Users className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">スタッフ数</p>
                    <p className="text-xl font-bold text-gray-900">{team.users?.length || 0}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'players' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">選手一覧</h3>
              </div>
              {players.length > 0 ? (
                <div className="divide-y divide-gray-200">
                  {players.map((player) => (
                    <div key={player.id} className="py-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {player.photoUrl ? (
                          <img
                            src={player.photoUrl}
                            alt=""
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                            <User className="w-5 h-5 text-gray-400" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-900">
                            {player.number && <span className="text-gray-500 mr-2">#{player.number}</span>}
                            {player.name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {player.team?.name} {player.position && `/ ${player.position}`}
                          </p>
                        </div>
                      </div>
                      <Link
                        to={`/players/${player.id}`}
                        className="text-primary-600 hover:text-primary-700 text-sm"
                      >
                        詳細
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">選手が登録されていません</p>
              )}
            </div>
          )}

          {activeTab === 'categories' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">カテゴリー一覧</h3>
              {team.children?.length > 0 ? (
                <div className="space-y-3">
                  {team.children.map((category) => (
                    <div
                      key={category.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-lg">
                          <Building2 className="w-5 h-5 text-gray-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{category.name}</p>
                          <p className="text-sm text-gray-500">{category._count?.players || 0}名の選手</p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">カテゴリーが登録されていません</p>
              )}
            </div>
          )}

          {activeTab === 'staff' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">スタッフ一覧</h3>
              {team.users?.length > 0 ? (
                <div className="divide-y divide-gray-200">
                  {team.users.map((userTeam) => (
                    <div key={userTeam.id} className="py-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                          <span className="text-sm font-medium text-primary-700">
                            {userTeam.user?.name?.charAt(0) || 'U'}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{userTeam.user?.name}</p>
                          <p className="text-sm text-gray-500">{userTeam.user?.email}</p>
                        </div>
                      </div>
                      <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                        {userTeam.role?.replace('TEAM_', '')}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">スタッフが登録されていません</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
