import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function InvitePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    verifyInvitation();
  }, [token]);

  const verifyInvitation = async () => {
    try {
      const res = await fetch(`/api/invitations/verify/${token}`);
      if (!res.ok) {
        throw new Error('招待URLが無効または期限切れです');
      }
      const data = await res.json();
      setInvitation(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = () => {
    navigate(`/register?token=${token}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-md text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/login')}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            ログインページへ
          </button>
        </div>
      </div>
    );
  }

  const roleLabels = {
    TEAM_ADMIN: '管理者',
    TEAM_HEAD_COACH: '代表監督・コーチ',
    TEAM_COACH: '監督・コーチ',
    TEAM_EXTERNAL_COACH: '外部コーチ',
    PLAYER: '選手',
    PARENT: '保護者',
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">招待を受けました</h1>
        
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <p className="text-lg font-medium text-gray-900">{invitation.teamName}</p>
          <p className="text-sm text-gray-500 mt-1">
            役割: {roleLabels[invitation.role] || invitation.role}
          </p>
        </div>

        <p className="text-sm text-gray-600 mb-6">
          このチームに参加するにはアカウントを作成してください
        </p>

        <button
          onClick={handleAccept}
          className="w-full px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
        >
          アカウントを作成して参加
        </button>

        <p className="text-sm text-gray-500 mt-4">
          すでにアカウントをお持ちの場合は{' '}
          <button
            onClick={() => navigate('/login')}
            className="text-primary-600 hover:underline"
          >
            ログイン
          </button>
        </p>
      </div>
    </div>
  );
}
