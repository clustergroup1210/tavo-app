import React, { useState, useEffect } from 'react';
import { MessageSquare, Send, Trash2, Edit2, X, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import clsx from 'clsx';

export default function VideoCommentSection({ videoId, onClose }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    if (videoId) {
      fetchComments();
    }
  }, [videoId]);

  const fetchComments = async () => {
    try {
      const res = await fetch(`/api/video-comments/${videoId}`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setComments(data);
      }
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/video-comments/${videoId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: newComment })
      });

      if (res.ok) {
        const comment = await res.json();
        setComments([...comments, comment]);
        setNewComment('');
      }
    } catch (error) {
      console.error('Failed to post comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (commentId) => {
    if (!editContent.trim()) return;

    try {
      const res = await fetch(`/api/video-comments/${commentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: editContent })
      });

      if (res.ok) {
        const updated = await res.json();
        setComments(comments.map(c => c.id === commentId ? updated : c));
        setEditingId(null);
        setEditContent('');
      }
    } catch (error) {
      console.error('Failed to edit comment:', error);
    }
  };

  const handleDelete = async (commentId) => {
    if (!confirm('このコメントを削除しますか？')) return;

    try {
      const res = await fetch(`/api/video-comments/${commentId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (res.ok) {
        setComments(comments.filter(c => c.id !== commentId));
      }
    } catch (error) {
      console.error('Failed to delete comment:', error);
    }
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary-600" />
          <h3 className="font-semibold text-gray-900">コメント</h3>
          <span className="text-sm text-gray-500">({comments.length})</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        )}
      </div>

      <div className="max-h-80 overflow-y-auto">
        {loading ? (
          <div className="p-8 flex justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
          </div>
        ) : comments.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            コメントはまだありません
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {comments.map((comment) => (
              <div key={comment.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                    {comment.user?.avatarUrl ? (
                      <img src={comment.user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <span className="text-sm font-medium text-gray-600">
                        {comment.user?.name?.charAt(0) || '?'}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 text-sm">{comment.user?.name}</span>
                      <span className="text-xs text-gray-400">{formatTime(comment.createdAt)}</span>
                    </div>
                    {editingId === comment.id ? (
                      <div className="mt-2 flex gap-2">
                        <input
                          type="text"
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg"
                          autoFocus
                        />
                        <button
                          onClick={() => handleEdit(comment.id)}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { setEditingId(null); setEditContent(''); }}
                          className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-gray-700">{comment.content}</p>
                    )}
                  </div>
                  {comment.userId === user?.id && editingId !== comment.id && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setEditingId(comment.id); setEditContent(comment.content); }}
                        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(comment.id)}
                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-100 flex gap-2">
        <input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="コメントを入力..."
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        <button
          type="submit"
          disabled={submitting || !newComment.trim()}
          className={clsx(
            'p-2 rounded-lg transition-colors',
            newComment.trim()
              ? 'bg-primary-600 text-white hover:bg-primary-700'
              : 'bg-gray-100 text-gray-400'
          )}
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
