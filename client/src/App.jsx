import React from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import AdminTeamManagement from './pages/AdminTeamManagement';
import AdminTeamView from './pages/AdminTeamView';
import AdminUserManagement from './pages/AdminUserManagement';
import TeamList from './pages/TeamList';
import TeamDetail from './pages/TeamDetail';
import PlayerList from './pages/PlayerList';
import PlayerDetail from './pages/PlayerDetail';
import EvaluationEntry from './pages/EvaluationEntry';
import EvaluationItems from './pages/EvaluationItems';
import UserManagement from './pages/UserManagement';
import Invitations from './pages/Invitations';
import Videos from './pages/Videos';
import AppealPublic from './pages/AppealPublic';
import InvitePage from './pages/InvitePage';
import MyPage from './pages/MyPage';
import Organizations from './pages/Organizations';
import Placeholder from './pages/Placeholder';
import Ranking from './pages/Ranking';
import GoalCategoryManagement from './pages/GoalCategoryManagement';
import StaffManagement from './pages/StaffManagement';
import CoachAssignmentManagement from './pages/CoachAssignmentManagement';
import Calendar from './pages/Calendar';
import Announcements from './pages/Announcements';
import TeamCategoryManagement from './pages/TeamCategoryManagement';
import PlayerProgress from './pages/PlayerProgress';
import MasterSettings from './pages/MasterSettings';
import JoinRequests from './pages/JoinRequests';
import AppealManagement from './pages/AppealManagement';
import NotificationSettings from './pages/NotificationSettings';
import PlayerDashboard from './pages/PlayerDashboard';
import AccountSettings from './pages/AccountSettings';
import EvaluationMatrix from './pages/EvaluationMatrix';
import AdminSystemSettings from './pages/AdminSystemSettings';
import AdminNotificationManagement from './pages/AdminNotificationManagement';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return user ? (children || <Outlet />) : <Navigate to="/login" />;
}

function OperatorRoute({ children }) {
  const { user, loading, isOperator } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" />;
  if (!isOperator()) return <Navigate to="/dashboard" />;

  return children || <Outlet />;
}

function RootRedirect() {
  const { isOperator, isPlayer, isParent, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (isOperator()) {
    return <Navigate to="/admin" replace />;
  }
  if (isPlayer() || isParent()) {
    return <Navigate to="/player-dashboard" replace />;
  }
  return <Navigate to="/dashboard" replace />;
}

function AdminLayoutWrapper() {
  return (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  );
}

function MainLayoutWrapper() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/invite/:token" element={<InvitePage />} />
      <Route path="/appeal/:token" element={<AppealPublic />} />
      
      <Route path="/" element={<PrivateRoute><RootRedirect /></PrivateRoute>} />
      
      <Route element={<OperatorRoute />}>
        <Route element={<AdminLayoutWrapper />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/teams" element={<AdminTeamManagement />} />
          <Route path="/admin/teams/:teamId/dashboard" element={<AdminTeamView />} />
          <Route path="/admin/users" element={<AdminUserManagement />} />
          <Route path="/admin/organizations" element={<Organizations />} />
          <Route path="/admin/master" element={<MasterSettings />} />
          <Route path="/admin/notifications" element={<AdminNotificationManagement />} />
          <Route path="/admin/settings" element={<AdminSystemSettings />} />
        </Route>
      </Route>
      
      <Route element={<PrivateRoute />}>
        <Route element={<MainLayoutWrapper />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/teams" element={<TeamList />} />
          <Route path="/teams/:id" element={<TeamDetail />} />
          <Route path="/players" element={<PlayerList />} />
          <Route path="/players/:id" element={<PlayerDetail />} />
          <Route path="/evaluations/entry" element={<EvaluationEntry />} />
          <Route path="/evaluations/items" element={<EvaluationItems />} />
          <Route path="/evaluations/matrix" element={<EvaluationMatrix />} />
          <Route path="/ranking" element={<Ranking />} />
          <Route path="/users" element={<UserManagement />} />
          <Route path="/invitations" element={<Invitations />} />
          <Route path="/videos" element={<Videos />} />
          <Route path="/mypage" element={<MyPage />} />
          <Route path="/organizations" element={<Organizations />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/announcements" element={<Announcements />} />
          <Route path="/permissions" element={<Placeholder />} />
          <Route path="/master" element={<MasterSettings />} />
          <Route path="/settings" element={<Placeholder />} />
          <Route path="/goal-categories" element={<GoalCategoryManagement />} />
          <Route path="/staff" element={<StaffManagement />} />
          <Route path="/coach-assignments" element={<CoachAssignmentManagement />} />
          <Route path="/team-categories" element={<TeamCategoryManagement />} />
          <Route path="/progress" element={<PlayerProgress />} />
          <Route path="/join-requests" element={<JoinRequests />} />
          <Route path="/appeal-management" element={<AppealManagement />} />
          <Route path="/notification-settings" element={<NotificationSettings />} />
          <Route path="/player-dashboard" element={<PlayerDashboard />} />
          <Route path="/account-settings" element={<AccountSettings />} />
        </Route>
      </Route>
    </Routes>
  );
}
