import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useUser } from '../../UserContext';
import ForumEditor from './ForumEditor';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

export default function ForumNewThread() {
  const { categorySlug } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useUser();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const canPost = useMemo(() => isAuthenticated && !!user?.token, [isAuthenticated, user?.token]);

  const uploadImage = async (file) => {
    if (!canPost) return null;
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
    if (!canPost) {
      setError('Bạn cần đăng nhập để đăng bài.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/forum/threads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          categorySlug,
          title,
          content,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'Không thể đăng bài');
      }
      navigate(`/forum/${categorySlug}/${data.threadId}`);
    } catch (err) {
      setError(err?.message || 'Không thể đăng bài');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="forumCard">
      <div className="forumTitleRow">
        <div>
          <div className="forumBreadcrumbs">
            <Link to="/forum">Forum</Link>
            <span className="forumCrumbSep">/</span>
            <Link to={`/forum/${categorySlug}`}>{categorySlug}</Link>
            <span className="forumCrumbSep">/</span>
            <span>Bài mới</span>
          </div>
          <h2 className="forumTitle">Đăng bài mới</h2>
          <div className="forumHint">MVP: markdown đơn giản + upload ảnh.</div>
        </div>
      </div>

      {!canPost ? (
        <div className="forumError">
          Bạn cần <Link to="/login">đăng nhập</Link> để đăng bài.
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="forumForm">
        <label className="forumField">
          <div className="forumFieldLabel">Tiêu đề</div>
          <input
            className="forumInput"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={submitting}
            maxLength={180}
            placeholder="Ví dụ: Thông báo event tuần này"
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
            {submitting ? 'Đang đăng...' : 'Đăng bài'}
          </button>
          <Link className="forumBtn" to={`/forum/${categorySlug}`}>
            Hủy
          </Link>
        </div>
      </form>
    </div>
  );
}

