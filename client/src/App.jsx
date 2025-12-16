import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
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

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return user ? children : <Navigate to="/login" />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/invite/:token" element={<InvitePage />} />
      <Route path="/appeal/:token" element={<AppealPublic />} />
      <Route
        path="/*"
        element={
          <PrivateRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/teams" element={<TeamList />} />
                <Route path="/teams/:id" element={<TeamDetail />} />
                <Route path="/players" element={<PlayerList />} />
                <Route path="/players/:id" element={<PlayerDetail />} />
                <Route path="/evaluations/entry" element={<EvaluationEntry />} />
                <Route path="/evaluations/items" element={<EvaluationItems />} />
                <Route path="/users" element={<UserManagement />} />
                <Route path="/invitations" element={<Invitations />} />
                <Route path="/videos" element={<Videos />} />
                <Route path="/mypage" element={<MyPage />} />
                <Route path="/organizations" element={<Organizations />} />
                <Route path="/announcements" element={<Placeholder />} />
                <Route path="/permissions" element={<Placeholder />} />
                <Route path="/master" element={<Placeholder />} />
                <Route path="/settings" element={<Placeholder />} />
              </Routes>
            </Layout>
          </PrivateRoute>
        }
      />
    </Routes>
  );
}
