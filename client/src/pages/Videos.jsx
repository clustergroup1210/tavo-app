import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Upload, Play, Trash2, MessageSquare, X } from 'lucide-react';
import VideoCommentSection from '../components/VideoCommentSection';

export default function Videos() {
  const { currentTeam, user } = useAuth();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadData, setUploadData] = useState({ title: '', description: '', file: null });
  const [selectedVideo, setSelectedVideo] = useState(null);

  useEffect(() => {
    if (currentTeam) {
      fetchVideos();
    }
  }, [currentTeam]);

  const fetchVideos = async () => {
    try {
      const res = await fetch(`/api/videos?teamId=${currentTeam.id}`, {
        credentials: 'include',
      });
      const data = await res.json();
      setVideos(data);
    } catch (error) {
      console.error('Failed to fetch videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadData.file) return;

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('video', uploadData.file);
      formData.append('title', uploadData.title);
      formData.append('description', uploadData.description);
      formData.append('teamId', currentTeam.id);

      await fetch('/api/videos', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      setShowUploadModal(false);
      setUploadData({ title: '', description: '', file: null });
      fetchVideos();
    } catch (error) {
      console.error('Failed to upload video:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('この動画を削除しますか？')) return;
    try {
      await fetch(`/api/videos/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      fetchVideos();
    } catch (error) {
      console.error('Failed to delete video:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">動画管理</h1>
          <p className="mt-1 text-sm text-gray-500">{videos.length}件の動画</p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Upload className="w-4 h-4" />
          アップロード
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {videos.map((video) => (
          <div
            key={video.id}
            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
          >
            <div className="aspect-video bg-gray-100 flex items-center justify-center">
              <Play className="w-12 h-12 text-gray-400" />
            </div>
            <div className="p-4">
              <h3 className="font-medium text-gray-900">{video.title}</h3>
              <p className="text-sm text-gray-500 mt-1">{video.description}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {new Date(video.createdAt).toLocaleDateString('ja-JP')}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setSelectedVideo(video)}
                    className="p-2 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-gray-50"
                    title="コメント"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>
                  {video.uploadedBy === user?.id && (
                    <button
                      onClick={() => handleDelete(video.id)}
                      className="p-2 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {videos.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-500">動画がありません</p>
        </div>
      )}

      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">動画アップロード</h2>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">タイトル</label>
                <input
                  type="text"
                  value={uploadData.title}
                  onChange={(e) => setUploadData({ ...uploadData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
                <textarea
                  value={uploadData.description}
                  onChange={(e) => setUploadData({ ...uploadData, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">動画ファイル</label>
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => setUploadData({ ...uploadData, file: e.target.files[0] })}
                  className="w-full"
                  required
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {uploading ? 'アップロード中...' : 'アップロード'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedVideo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg">
            <div className="mb-4 bg-white rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900">{selectedVideo.title}</h3>
                <button 
                  onClick={() => setSelectedVideo(null)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <video
                src={`/api/videos/${selectedVideo.id}/stream`}
                controls
                className="w-full rounded-lg bg-black"
              />
            </div>
            <VideoCommentSection 
              videoId={selectedVideo.id} 
              onClose={() => setSelectedVideo(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
