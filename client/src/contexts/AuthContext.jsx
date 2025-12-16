import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [roles, setRoles] = useState(null);
  const [teams, setTeams] = useState([]);
  const [currentTeam, setCurrentTeam] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setRoles(data.roles);
        setTeams(data.teams || []);
        if (data.teams?.length > 0) {
          setCurrentTeam(data.teams[0].team);
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Login failed');
    }

    const data = await res.json();
    setUser(data.user);
    setRoles(data.roles);
    await checkAuth();
    return data;
  };

  const register = async (email, password, name, invitationToken) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password, name, invitationToken }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Registration failed');
    }

    const data = await res.json();
    setUser(data.user);
    await checkAuth();
    return data;
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
    setRoles(null);
    setTeams([]);
    setCurrentTeam(null);
  };

  const isOperator = () => {
    return roles?.isOperator || false;
  };

  const isTeamAdmin = (teamId) => {
    return roles?.teamAdminTeams?.some(t => t.teamId === teamId) || false;
  };

  const isCoach = (teamId) => {
    return roles?.coachTeams?.some(t => t.teamId === teamId) || 
           roles?.teamAdminTeams?.some(t => t.teamId === teamId) || false;
  };

  const isPlayer = () => roles?.isPlayer || false;
  const isParent = () => roles?.isParent || false;

  return (
    <AuthContext.Provider
      value={{
        user,
        roles,
        teams,
        currentTeam,
        setCurrentTeam,
        loading,
        login,
        register,
        logout,
        checkAuth,
        isOperator,
        isTeamAdmin,
        isCoach,
        isPlayer,
        isParent,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
