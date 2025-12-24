import React from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
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
import Calendar from './pages/Calendar';
import Announcements from './pages/Announcements';
import TeamCategoryManagement from './pages/TeamCategoryManagement';

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
  const { isOperator, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return isOperator() ? <Navigate to="/admin" replace /> : <Navigate to="/dashboard" replace />;
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
          <Route path="/admin/teams" element={<AdminDashboard />} />
          <Route path="/admin/teams/:teamId/dashboard" element={<AdminTeamView />} />
          <Route path="/admin/users" element={<AdminUserManagement />} />
          <Route path="/admin/organizations" element={<Organizations />} />
          <Route path="/admin/master" element={<Placeholder />} />
          <Route path="/admin/notifications" element={<Placeholder />} />
          <Route path="/admin/settings" element={<Placeholder />} />
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
          <Route path="/ranking" element={<Ranking />} />
          <Route path="/users" element={<UserManagement />} />
          <Route path="/invitations" element={<Invitations />} />
          <Route path="/videos" element={<Videos />} />
          <Route path="/mypage" element={<MyPage />} />
          <Route path="/organizations" element={<Organizations />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/announcements" element={<Announcements />} />
          <Route path="/permissions" element={<Placeholder />} />
          <Route path="/master" element={<Placeholder />} />
          <Route path="/settings" element={<Placeholder />} />
          <Route path="/goal-categories" element={<GoalCategoryManagement />} />
          <Route path="/staff" element={<StaffManagement />} />
          <Route path="/team-categories" element={<TeamCategoryManagement />} />
        </Route>
      </Route>
    </Routes>
  );
}
