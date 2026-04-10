import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Upload, Play, Trash2, MessageSquare, X, Cloud, HardDrive, Tag, Users, Search } from 'lucide-react';
import VideoCommentSection from '../components/VideoCommentSection';

export default function Videos() {
  const { currentTeam, user, isCoach, isOperator } = useAuth();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadData, setUploadData] = useState({ title: '', description: '', file: null, playerTagIds: [], categoryTagIds: [] });
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [r2Available, setR2Available] = useState(false);
  const [players, setPlayers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [editingTags, setEditingTags] = useState(null);
  const [editTagData, setEditTagData] = useState({ playerTagIds: [], categoryTagIds: [] });
  const [playerSearch, setPlayerSearch] = useState('');
  const [editPlayerSearch, setEditPlayerSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterPlayer, setFilterPlayer] = useState('');

  const currentTeamId = currentTeam?.id;
  const canManage = isCoach(currentTeamId) || isOperator();

  useEffect(() => {
    if (currentTeam) {
      fetchVideos();
      checkR2Status();
      fetchPlayers();
      fetchCategories();
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
      const res = await fetch(`/api/videos?teamId=${currentTeam.id}`, { credentials: 'include' });
      const data = await res.json();
      setVideos(data);
    } catch (error) {
      console.error('Failed to fetch videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlayers = async () => {
    try {
      const res = await fetch(`/api/players?teamId=${currentTeam.id}`, { credentials: 'include' });
      const data = await res.json();
      setPlayers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch players:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch(`/api/team-categories?teamId=${currentTeam.id}`, { credentials: 'include' });
      const data = await res.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
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
      setUploadData({ title: '', description: '', file: null, playerTagIds: [], categoryTagIds: [] });
      setUploadProgress(0);
      setPlayerSearch('');
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
        fileName: uploadData.file.name,
        playerTagIds: uploadData.playerTagIds,
        categoryTagIds: uploadData.categoryTagIds
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
    formData.append('playerTagIds', JSON.stringify(uploadData.playerTagIds));
    formData.append('categoryTagIds', JSON.stringify(uploadData.categoryTagIds));

    await fetch('/api/videos', {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
  };

  const handleDelete = async (id) => {
    if (!confirm('この動画を削除しますか？')) return;
    try {
      await fetch(`/api/videos/${id}`, { method: 'DELETE', credentials: 'include' });
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
      let url = data.url;
      if (url && url.startsWith('/api/')) {
        const token = localStorage.getItem('auth_token');
        if (token) {
          url += (url.includes('?') ? '&' : '?') + `token=${encodeURIComponent(token)}`;
        }
      }
      setVideoUrl(url);
    } catch (error) {
      console.error('Failed to get video URL:', error);
    }
  };

  const openEditTags = (video) => {
    setEditingTags(video);
    setEditTagData({
      playerTagIds: video.playerTags?.map(t => t.player.id) || [],
      categoryTagIds: video.categoryTags?.map(t => t.teamCategory.id) || []
    });
    setEditPlayerSearch('');
  };

  const handleSaveTags = async () => {
    if (!editingTags) return;
    try {
      await fetch(`/api/videos/${editingTags.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerTagIds: editTagData.playerTagIds,
          categoryTagIds: editTagData.categoryTagIds
        })
      });
      setEditingTags(null);
      setEditPlayerSearch('');
      fetchVideos();
    } catch (error) {
      console.error('Failed to save tags:', error);
    }
  };

  const toggleUploadPlayer = (id) => {
    setUploadData(prev => ({
      ...prev,
      playerTagIds: prev.playerTagIds.includes(id)
        ? prev.playerTagIds.filter(p => p !== id)
        : [...prev.playerTagIds, id]
    }));
  };

  const toggleUploadCategory = (id) => {
    setUploadData(prev => ({
      ...prev,
      categoryTagIds: prev.categoryTagIds.includes(id)
        ? prev.categoryTagIds.filter(c => c !== id)
        : [...prev.categoryTagIds, id]
    }));
  };

  const toggleEditPlayer = (id) => {
    setEditTagData(prev => ({
      ...prev,
      playerTagIds: prev.playerTagIds.includes(id)
        ? prev.playerTagIds.filter(p => p !== id)
        : [...prev.playerTagIds, id]
    }));
  };

  const toggleEditCategory = (id) => {
    setEditTagData(prev => ({
      ...prev,
      categoryTagIds: prev.categoryTagIds.includes(id)
        ? prev.categoryTagIds.filter(c => c !== id)
        : [...prev.categoryTagIds, id]
    }));
  };

  const filteredVideos = videos.filter(v => {
    if (filterCategory) {
      const hasCat = v.categoryTags?.some(t => t.teamCategory?.id === filterCategory);
      if (!hasCat) return false;
    }
    if (filterPlayer) {
      const hasPlayer = v.playerTags?.some(t => t.player?.id === filterPlayer);
      if (!hasPlayer) return false;
    }
    return true;
  });

  const filteredUploadPlayers = players.filter(p =>
    !playerSearch || p.name.toLowerCase().includes(playerSearch.toLowerCase()) || (p.number && p.number.includes(playerSearch))
  );

  const filteredEditPlayers = players.filter(p =>
    !editPlayerSearch || p.name.toLowerCase().includes(editPlayerSearch.toLowerCase()) || (p.number && p.number.includes(editPlayerSearch))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">動画管理</h1>
          <p className="mt-0.5 text-[12px] text-gray-500">{filteredVideos.length}件の動画</p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white text-[13px] font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
        >
          <Upload className="w-4 h-4" />
          アップロード
        </button>
      </div>

      {(categories.length > 0 || players.length > 0) && (
        <div className="flex flex-wrap gap-2 items-center">
          {categories.length > 0 && (
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="text-[12px] px-3 py-1.5 border border-gray-200 rounded-lg bg-white text-gray-600 focus:ring-2 focus:ring-primary-500 outline-none"
            >
              <option value="">全カテゴリー</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          {players.length > 0 && (
            <select
              value={filterPlayer}
              onChange={(e) => setFilterPlayer(e.target.value)}
              className="text-[12px] px-3 py-1.5 border border-gray-200 rounded-lg bg-white text-gray-600 focus:ring-2 focus:ring-primary-500 outline-none"
            >
              <option value="">全選手</option>
              {players.map(p => (
                <option key={p.id} value={p.id}>{p.number ? `#${p.number} ` : ''}{p.name}</option>
              ))}
            </select>
          )}
          {(filterCategory || filterPlayer) && (
            <button
              onClick={() => { setFilterCategory(''); setFilterPlayer(''); }}
              className="text-[11px] text-gray-400 hover:text-gray-600 px-2 py-1"
            >
              フィルター解除
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredVideos.map((video) => (
          <div key={video.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <button
              onClick={() => handlePlayVideo(video)}
              className="w-full aspect-video bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors cursor-pointer"
            >
              <Play className="w-10 h-10 text-gray-400" />
            </button>
            <div className="p-3">
              <div className="flex items-start gap-2">
                <h3 className="text-[13px] font-medium text-gray-900 flex-1 truncate">{video.title}</h3>
                {video.r2Key ? (
                  <Cloud className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" title="クラウド" />
                ) : (
                  <HardDrive className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 mt-0.5" title="ローカル" />
                )}
              </div>
              {video.description && (
                <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{video.description}</p>
              )}

              {(video.playerTags?.length > 0 || video.categoryTags?.length > 0) && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {video.categoryTags?.map(t => (
                    <span key={t.id} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded bg-purple-50 text-purple-700">
                      {t.teamCategory?.name}
                    </span>
                  ))}
                  {video.playerTags?.map(t => (
                    <span key={t.id} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-50 text-blue-700">
                      {t.player?.number ? `#${t.player.number} ` : ''}{t.player?.name}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-2 flex items-center justify-between">
                <span className="text-[10px] text-gray-400">
                  {new Date(video.createdAt).toLocaleDateString('ja-JP')}
                  {video.fileSize && ` · ${(video.fileSize / (1024 * 1024)).toFixed(1)} MB`}
                </span>
                <div className="flex items-center gap-0.5">
                  {canManage && (
                    <button
                      onClick={() => openEditTags(video)}
                      className="p-1.5 text-gray-400 hover:text-primary-600 rounded hover:bg-gray-50"
                      title="タグ編集"
                    >
                      <Tag className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => handlePlayVideo(video)}
                    className="p-1.5 text-gray-400 hover:text-primary-600 rounded hover:bg-gray-50"
                    title="再生"
                  >
                    <Play className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setSelectedVideo(video)}
                    className="p-1.5 text-gray-400 hover:text-primary-600 rounded hover:bg-gray-50"
                    title="コメント"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>
                  {(video.uploadedBy === user?.id || canManage) && (
                    <button
                      onClick={() => handleDelete(video.id)}
                      className="p-1.5 text-red-400 hover:text-red-600 rounded hover:bg-red-50"
                      title="削除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredVideos.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 text-center">
          <p className="text-[13px] text-gray-400">動画がありません</p>
        </div>
      )}

      {showUploadModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => { if (!uploading) { setShowUploadModal(false); setUploadProgress(0); setPlayerSearch(''); } }}>
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
              <h2 className="text-[14px] font-semibold text-gray-900">動画アップロード</h2>
              <div className="flex items-center gap-2">
                {r2Available && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                    <Cloud className="w-3 h-3" />
                    クラウド
                  </span>
                )}
                <button onClick={() => { setShowUploadModal(false); setUploadProgress(0); setPlayerSearch(''); }} disabled={uploading} className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <form onSubmit={handleUpload} className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-1">タイトル</label>
                <input
                  type="text"
                  value={uploadData.title}
                  onChange={(e) => setUploadData({ ...uploadData, title: e.target.value })}
                  className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-1">説明</label>
                <textarea
                  value={uploadData.description}
                  onChange={(e) => setUploadData({ ...uploadData, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-1">動画ファイル</label>
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => setUploadData({ ...uploadData, file: e.target.files[0] })}
                  className="w-full text-[12px]"
                  required
                />
                {uploadData.file && (
                  <p className="text-[10px] text-gray-400 mt-1">
                    {uploadData.file.name} ({(uploadData.file.size / (1024 * 1024)).toFixed(1)} MB)
                  </p>
                )}
              </div>

              {categories.length > 0 && (
                <div>
                  <label className="block text-[11px] font-medium text-gray-500 mb-1.5">共有カテゴリー</label>
                  <div className="flex flex-wrap gap-1.5">
                    {categories.map(cat => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => toggleUploadCategory(cat.id)}
                        className={`px-2.5 py-1 text-[11px] rounded-full border transition-colors ${
                          uploadData.categoryTagIds.includes(cat.id)
                            ? 'bg-purple-100 border-purple-300 text-purple-800 font-medium'
                            : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {players.length > 0 && (
                <div>
                  <label className="block text-[11px] font-medium text-gray-500 mb-1.5">共有選手</label>
                  {uploadData.playerTagIds.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {uploadData.playerTagIds.map(pid => {
                        const p = players.find(pl => pl.id === pid);
                        if (!p) return null;
                        return (
                          <span key={pid} className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-blue-100 text-blue-800">
                            {p.number ? `#${p.number} ` : ''}{p.name}
                            <button type="button" onClick={() => toggleUploadPlayer(pid)} className="hover:text-blue-600">
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={playerSearch}
                      onChange={(e) => setPlayerSearch(e.target.value)}
                      placeholder="選手名で検索..."
                      className="w-full pl-8 pr-3 py-1.5 text-[12px] border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>
                  <div className="mt-1.5 max-h-32 overflow-y-auto border border-gray-100 rounded-lg">
                    {filteredUploadPlayers.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleUploadPlayer(p.id)}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-left hover:bg-gray-50 transition-colors ${
                          uploadData.playerTagIds.includes(p.id) ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                        }`}
                      >
                        <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[9px] font-semibold text-gray-500 flex-shrink-0">
                          {p.number || '-'}
                        </span>
                        <span className="truncate">{p.name}</span>
                        {uploadData.playerTagIds.includes(p.id) && (
                          <span className="ml-auto text-blue-500 text-[10px]">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {uploading && uploadProgress > 0 && (
                <div>
                  <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                    <span>アップロード中...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className="bg-primary-600 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => { setShowUploadModal(false); setUploadProgress(0); setPlayerSearch(''); }}
                  className="px-4 py-2 text-[12px] text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                  disabled={uploading}
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-4 py-2 text-[12px] font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {uploading ? 'アップロード中...' : 'アップロード'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingTags && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setEditingTags(null)}>
          <div className="bg-white rounded-xl w-full max-w-md max-h-[85vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
              <h3 className="text-[14px] font-semibold text-gray-900">共有タグを編集</h3>
              <button onClick={() => setEditingTags(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-[11px] font-medium text-gray-400 mb-0.5">動画</p>
                <p className="text-[13px] font-semibold text-gray-800">{editingTags.title}</p>
              </div>

              {categories.length > 0 && (
                <div>
                  <label className="block text-[11px] font-medium text-gray-500 mb-1.5">カテゴリー</label>
                  <div className="flex flex-wrap gap-1.5">
                    {categories.map(cat => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => toggleEditCategory(cat.id)}
                        className={`px-2.5 py-1 text-[11px] rounded-full border transition-colors ${
                          editTagData.categoryTagIds.includes(cat.id)
                            ? 'bg-purple-100 border-purple-300 text-purple-800 font-medium'
                            : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-1.5">選手</label>
                {editTagData.playerTagIds.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {editTagData.playerTagIds.map(pid => {
                      const p = players.find(pl => pl.id === pid);
                      if (!p) return null;
                      return (
                        <span key={pid} className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-blue-100 text-blue-800">
                          {p.number ? `#${p.number} ` : ''}{p.name}
                          <button type="button" onClick={() => toggleEditPlayer(pid)} className="hover:text-blue-600">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={editPlayerSearch}
                    onChange={(e) => setEditPlayerSearch(e.target.value)}
                    placeholder="選手名で検索..."
                    className="w-full pl-8 pr-3 py-1.5 text-[12px] border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
                <div className="mt-1.5 max-h-40 overflow-y-auto border border-gray-100 rounded-lg">
                  {filteredEditPlayers.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleEditPlayer(p.id)}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-left hover:bg-gray-50 transition-colors ${
                        editTagData.playerTagIds.includes(p.id) ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                      }`}
                    >
                      <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[9px] font-semibold text-gray-500 flex-shrink-0">
                        {p.number || '-'}
                      </span>
                      <span className="truncate">{p.name}</span>
                      {editTagData.playerTagIds.includes(p.id) && (
                        <span className="ml-auto text-blue-500 text-[10px]">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  onClick={() => setEditingTags(null)}
                  className="px-4 py-2 text-[12px] text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSaveTags}
                  className="px-4 py-2 text-[12px] font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedVideo && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => { setSelectedVideo(null); setVideoUrl(null); }}>
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="mb-4 bg-white rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[14px] font-semibold text-gray-900">{selectedVideo.title}</h3>
                <button 
                  onClick={() => { setSelectedVideo(null); setVideoUrl(null); }}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              {(selectedVideo.playerTags?.length > 0 || selectedVideo.categoryTags?.length > 0) && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {selectedVideo.categoryTags?.map(t => (
                    <span key={t.id} className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-purple-50 text-purple-700">
                      {t.teamCategory?.name}
                    </span>
                  ))}
                  {selectedVideo.playerTags?.map(t => (
                    <span key={t.id} className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-50 text-blue-700">
                      {t.player?.number ? `#${t.player.number} ` : ''}{t.player?.name}
                    </span>
                  ))}
                </div>
              )}
              {videoUrl ? (
                <video src={videoUrl} controls className="w-full rounded-lg bg-black" />
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
