import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useUser } from '../../UserContext';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('vi-VN');
}

export default function ForumCategory() {
  const { categorySlug } = useParams();
  const { isAuthenticated } = useUser();

  const [category, setCategory] = useState(null);
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const title = useMemo(() => category?.name || 'Forum', [category?.name]);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        setLoading(true);
        setError('');
        const res = await fetch(`${API_BASE_URL}/api/forum/categories/${encodeURIComponent(categorySlug)}/threads`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!alive) return;
        setCategory(data.category || null);
        setThreads(Array.isArray(data.threads) ? data.threads : []);
      } catch (e) {
        if (!alive) return;
        setError('Không thể tải danh sách thread.');
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [categorySlug]);

  if (loading) return <div className="forumCard">Đang tải...</div>;
  if (error) return <div className="forumCard forumError">{error}</div>;

  return (
    <div className="forumCard">
      <div className="forumTitleRow">
        <div>
          <div className="forumBreadcrumbs">
            <Link to="/forum">Forum</Link>
            <span className="forumCrumbSep">/</span>
            <span>{title}</span>
          </div>
          <h2 className="forumTitle">{title}</h2>
          <div className="forumHint">{category?.description || ''}</div>
        </div>

        <div>
          {isAuthenticated ? (
            <Link className="forumBtn forumBtnPrimary" to={`/forum/${categorySlug}/new`}>
              Đăng bài mới
            </Link>
          ) : (
            <Link className="forumBtn" to="/login">
              Đăng nhập để đăng bài
            </Link>
          )}
        </div>
      </div>

      <div className="forumTable">
        <div className="forumTableHead forumThreadsHead">
          <div>Chủ đề</div>
          <div className="forumColRight">Thống kê</div>
        </div>

        {threads.length === 0 ? (
          <div className="forumEmpty">Chưa có bài viết nào.</div>
        ) : (
          threads.map((t) => (
            <Link
              key={t.id}
              className="forumTableRow forumThreadRow"
              to={`/forum/${categorySlug}/${t.id}`}
            >
              <div>
                <div className="forumRowTitle">
                  {t.is_pinned ? <span className="forumBadge">PIN</span> : null}
                  {t.is_locked ? <span className="forumBadge forumBadgeMuted">LOCK</span> : null}
                  <span>{t.title}</span>
                </div>
                <div className="forumRowSub">
                  bởi <b>{t.display_name || t.username || 'Người chơi'}</b> • cập nhật{' '}
                  {formatTime(t.updated_at)}
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

