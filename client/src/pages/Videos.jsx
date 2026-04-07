import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Upload, Play, Trash2, MessageSquare, X, Cloud, HardDrive } from 'lucide-react';
import VideoCommentSection from '../components/VideoCommentSection';

export default function Videos() {
  const { currentTeam, user } = useAuth();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadData, setUploadData] = useState({ title: '', description: '', file: null });
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [r2Available, setR2Available] = useState(false);

  useEffect(() => {
    if (currentTeam) {
      fetchVideos();
      checkR2Status();
    }
  }, [currentTeam]);

  const checkR2Status = async () => {
    try {
      const res = await fetch('/api/videos/r2-status', { credentials: 'include' });
      const data = await res.json();
      setR2Available(data.configured);
    } catch {
      setR2Available(false);
    }
  };

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
    setUploadProgress(0);

    try {
      if (r2Available) {
        await handleR2Upload();
      } else {
        await handleLocalUpload();
      }

      setShowUploadModal(false);
      setUploadData({ title: '', description: '', file: null });
      setUploadProgress(0);
      fetchVideos();
    } catch (error) {
      console.error('Failed to upload video:', error);
      alert('動画のアップロードに失敗しました');
    } finally {
      setUploading(false);
    }
  };

  const handleR2Upload = async () => {
    const res = await fetch('/api/videos/presigned-upload', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: uploadData.title,
        description: uploadData.description,
        teamId: currentTeam.id,
        contentType: uploadData.file.type,
        fileSize: uploadData.file.size,
        fileName: uploadData.file.name
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to get upload URL');
    }

    const { uploadUrl } = await res.json();

    setUploadProgress(10);

    const xhr = new XMLHttpRequest();
    await new Promise((resolve, reject) => {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 90) + 10;
          setUploadProgress(pct);
        }
      });
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setUploadProgress(100);
          resolve();
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });
      xhr.addEventListener('error', () => reject(new Error('Upload failed')));
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', uploadData.file.type);
      xhr.send(uploadData.file);
    });
  };

  const handleLocalUpload = async () => {
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

  const handlePlayVideo = async (video) => {
    setSelectedVideo(video);
    setVideoUrl(null);
    try {
      const res = await fetch(`/api/videos/${video.id}`, { credentials: 'include' });
      const data = await res.json();
      setVideoUrl(data.url);
    } catch (error) {
      console.error('Failed to get video URL:', error);
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
            <button
              onClick={() => handlePlayVideo(video)}
              className="w-full aspect-video bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors cursor-pointer"
            >
              <Play className="w-12 h-12 text-gray-400" />
            </button>
            <div className="p-4">
              <div className="flex items-start gap-2">
                <h3 className="font-medium text-gray-900 flex-1">{video.title}</h3>
                {video.r2Key ? (
                  <Cloud className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" title="クラウドストレージ" />
                ) : (
                  <HardDrive className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" title="ローカルストレージ" />
                )}
              </div>
              <p className="text-sm text-gray-500 mt-1">{video.description}</p>
              {video.fileSize && (
                <p className="text-xs text-gray-400 mt-1">
                  {(video.fileSize / (1024 * 1024)).toFixed(1)} MB
                </p>
              )}
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {new Date(video.createdAt).toLocaleDateString('ja-JP')}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handlePlayVideo(video)}
                    className="p-2 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-gray-50"
                    title="再生"
                  >
                    <Play className="w-4 h-4" />
                  </button>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">動画アップロード</h2>
              {r2Available && (
                <span className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                  <Cloud className="w-3 h-3" />
                  クラウド
                </span>
              )}
            </div>
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
                {uploadData.file && (
                  <p className="text-xs text-gray-500 mt-1">
                    {uploadData.file.name} ({(uploadData.file.size / (1024 * 1024)).toFixed(1)} MB)
                  </p>
                )}
              </div>

              {uploading && uploadProgress > 0 && (
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>アップロード中...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setShowUploadModal(false); setUploadProgress(0); }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                  disabled={uploading}
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
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="mb-4 bg-white rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900">{selectedVideo.title}</h3>
                <button 
                  onClick={() => { setSelectedVideo(null); setVideoUrl(null); }}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              {videoUrl ? (
                <video
                  src={videoUrl}
                  controls
                  className="w-full rounded-lg bg-black"
                />
              ) : (
                <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              )}
            </div>
            <VideoCommentSection 
              videoId={selectedVideo.id} 
              onClose={() => { setSelectedVideo(null); setVideoUrl(null); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
