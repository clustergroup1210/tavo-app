import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const OPERATIONS_ROLES = ['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'EXTERNAL'];
const TEAM_ROLES = ['TEAM_MANAGER', 'COACH', 'GUEST_COACH'];
const USER_ROLES = ['PLAYER', 'PARENT'];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [roles, setRoles] = useState(null);
  const [teams, setTeams] = useState([]);
  const [currentTeam, setCurrentTeam] = useState(null);
  const [playerData, setPlayerData] = useState(null);
  const [parentPlayers, setParentPlayers] = useState([]);
  const [childPlayerData, setChildPlayerData] = useState(null);
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
        if (data.players?.length > 0) {
          setPlayerData(data.players[0]);
        }
        if (data.parentPlayers?.length > 0) {
          setParentPlayers(data.parentPlayers);
          setChildPlayerData(data.parentPlayers[0].player);
          if (data.parentPlayers[0].player?.teamId) {
            const childTeam = { id: data.parentPlayers[0].player.teamId, name: data.parentPlayers[0].player.team?.name };
            if (!data.teams?.length) {
              setCurrentTeam(childTeam);
            }
          }
        }
      } else {
        localStorage.removeItem('auth_token');
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
    if (data.token) {
      localStorage.setItem('auth_token', data.token);
    }
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
    if (data.token) {
      localStorage.setItem('auth_token', data.token);
    }
    setUser(data.user);
    await checkAuth();
    return data;
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    localStorage.removeItem('auth_token');
    setUser(null);
    setRoles(null);
    setTeams([]);
    setCurrentTeam(null);
    setPlayerData(null);
    setParentPlayers([]);
    setChildPlayerData(null);
  };

  const isOperator = () => {
    return roles?.isOperator || false;
  };

  const isSuperAdmin = () => roles?.highestRole === 'SUPER_ADMIN';
  const isAdmin = () => ['SUPER_ADMIN', 'ADMIN'].includes(roles?.highestRole);

  const isTeamAdmin = (teamId) => {
    if (isOperator()) return true;
    return roles?.teamManagerTeams?.some(t => t.teamId === teamId) || false;
  };

  const isCoach = (teamId) => {
    if (isOperator()) return true;
    return roles?.coachTeams?.some(t => t.teamId === teamId) || 
           roles?.teamManagerTeams?.some(t => t.teamId === teamId) || false;
  };

  const isGuestCoach = (teamId) => {
    return roles?.guestCoachTeams?.some(t => t.teamId === teamId) || false;
  };

  const isPlayer = () => roles?.isPlayer || false;
  const isParent = () => roles?.isParent || false;

  const hasPermission = (permission) => {
    return roles?.permissions?.includes(permission) || false;
  };

  const getUserRole = () => roles?.highestRole || null;

  return (
    <AuthContext.Provider
      value={{
        user,
        roles,
        teams,
        currentTeam,
        setCurrentTeam,
        playerData,
        parentPlayers,
        childPlayerData,
        loading,
        login,
        register,
        logout,
        checkAuth,
        isOperator,
        isSuperAdmin,
        isAdmin,
        isTeamAdmin,
        isCoach,
        isGuestCoach,
        isPlayer,
        isParent,
        hasPermission,
        getUserRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
