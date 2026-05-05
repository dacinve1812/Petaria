import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useUser } from '../../UserContext';
import ForumEditor from './ForumEditor';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

export default function ForumEditThread() {
  const { categorySlug, threadId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useUser();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const canEdit = useMemo(() => isAuthenticated && !!user?.token, [isAuthenticated, user?.token]);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        setLoading(true);
        setError('');
        const res = await fetch(`${API_BASE_URL}/api/forum/threads/${encodeURIComponent(threadId)}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
        if (!alive) return;
        setTitle(String(data?.thread?.title || ''));
        setContent(String(data?.thread?.body_markdown || ''));
      } catch (e) {
        if (!alive) return;
        setError(e?.message || 'Không thể tải thread.');
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [threadId]);

  const uploadImage = async (file) => {
    if (!canEdit) return null;
    const fd = new FormData();
    fd.append('image', file);
    const res = await fetch(`${API_BASE_URL}/api/forum/upload-image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${user.token}` },
      body: fd,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.url || null;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!canEdit) {
      setError('Bạn cần đăng nhập để sửa bài.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/forum/threads/${encodeURIComponent(threadId)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ title, content }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Không thể sửa bài');
      navigate(`/forum/${categorySlug}/${threadId}`);
    } catch (e2) {
      setError(e2?.message || 'Không thể sửa bài');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="forumCard forumError">
        Bạn cần <Link to="/login">đăng nhập</Link> để sửa bài.
      </div>
    );
  }

  if (loading) return <div className="forumCard">Đang tải...</div>;
  if (error) return <div className="forumCard forumError">{error}</div>;

  return (
    <div className="forumCard">
      <div className="forumTitleRow">
        <div>
          <div className="forumBreadcrumbs">
            <Link to="/forum">Forum</Link>
            <span className="forumCrumbSep">/</span>
            <Link to={`/forum/${categorySlug}`}>{categorySlug}</Link>
            <span className="forumCrumbSep">/</span>
            <Link to={`/forum/${categorySlug}/${threadId}`}>Thread</Link>
            <span className="forumCrumbSep">/</span>
            <span>Sửa</span>
          </div>
          <h2 className="forumTitle">Sửa bài</h2>
        </div>
      </div>

      <form onSubmit={onSubmit} className="forumForm">
        <label className="forumField">
          <div className="forumFieldLabel">Tiêu đề</div>
          <input
            className="forumInput"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={submitting}
            maxLength={180}
          />
        </label>

        <label className="forumField">
          <div className="forumFieldLabel">Nội dung</div>
          <ForumEditor
            value={content}
            onChange={setContent}
            onUploadImage={uploadImage}
            disabled={submitting}
          />
        </label>

        {error ? <div className="forumError">{error}</div> : null}

        <div className="forumActions">
          <button className="forumBtn forumBtnPrimary" disabled={submitting} type="submit">
            {submitting ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
          <Link className="forumBtn" to={`/forum/${categorySlug}/${threadId}`}>
            Hủy
          </Link>
        </div>
      </form>
    </div>
  );
}

