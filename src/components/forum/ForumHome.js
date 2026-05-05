import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

export default function ForumHome() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        setLoading(true);
        setError('');
        const res = await fetch(`${API_BASE_URL}/api/forum/categories`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!alive) return;
        setCategories(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!alive) return;
        setError('Không thể tải danh mục forum.');
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return <div className="forumCard">Đang tải...</div>;
  }

  if (error) {
    return <div className="forumCard forumError">{error}</div>;
  }

  return (
    <div className="forumCard">
      <div className="forumTitleRow">
        <h2 className="forumTitle">Danh mục</h2>
        <div className="forumHint">Bạn có thể xem tự do, đăng bài cần đăng nhập.</div>
      </div>

      <div className="forumTable">
        <div className="forumTableHead">
          <div>Diễn đàn</div>
          <div className="forumColRight">Threads</div>
        </div>
        {categories.map((c) => (
          <Link key={c.id} className="forumTableRow" to={`/forum/${c.slug}`}>
            <div>
              <div className="forumRowTitle">{c.name}</div>
              <div className="forumRowSub">{c.description || ''}</div>
            </div>
            <div className="forumColRight forumRowMeta">→</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

