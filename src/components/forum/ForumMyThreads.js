import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../../UserContext';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('vi-VN');
}

export default function ForumMyThreads() {
  const { user, isAuthenticated } = useUser();
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!isAuthenticated || !user?.token) {
        setLoading(false);
        setThreads([]);
        return;
      }
      try {
        setLoading(true);
        setError('');
        const res = await fetch(`${API_BASE_URL}/api/forum/my/threads`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
        if (!alive) return;
        setThreads(Array.isArray(data.threads) ? data.threads : []);
      } catch (e) {
        if (!alive) return;
        setError(e?.message || 'Không thể tải bài của bạn.');
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [isAuthenticated, user?.token]);

  if (!isAuthenticated) {
    return (
      <div className="forumCard forumError">
        Bạn cần <Link to="/login">đăng nhập</Link> để xem bài của mình.
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
            <span>Bài của tôi</span>
          </div>
          <h2 className="forumTitle">Bài của tôi</h2>
          <div className="forumHint">Xem lại, sửa hoặc xóa các bài bạn đã đăng.</div>
        </div>
      </div>

      <div className="forumTable">
        <div className="forumTableHead forumThreadsHead">
          <div>Chủ đề</div>
          <div className="forumColRight">Thống kê</div>
        </div>

        {threads.length === 0 ? (
          <div className="forumEmpty">Bạn chưa đăng bài nào.</div>
        ) : (
          threads.map((t) => (
            <Link
              key={t.id}
              className="forumTableRow forumThreadRow"
              to={`/forum/${t.category_slug}/${t.id}`}
            >
              <div>
                <div className="forumRowTitle">
                  <span>{t.title}</span>
                </div>
                <div className="forumRowSub">
                  {t.category_name} • cập nhật {formatTime(t.updated_at)}
                </div>
              </div>
              <div className="forumColRight forumRowMeta">
                <div>{Number(t.comment_count || 0).toLocaleString('vi-VN')} bình luận</div>
                <div>{Number(t.view_count || 0).toLocaleString('vi-VN')} lượt xem</div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

