import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../UserContext';
import '../HomePage.css';

const API = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

function AdminAuctionLogs() {
  const { user, isLoading } = useUser();
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [content, setContent] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isLoading && (!user || !user.isAdmin)) {
      navigate('/login');
    }
  }, [user, isLoading, navigate]);

  const loadFiles = useCallback(async () => {
    const token = localStorage.getItem('token');
    const r = await fetch(`${API}/api/admin/auction-logs/files`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) {
      setError('Không tải được danh sách file log.');
      return;
    }
    const j = await r.json();
    const list = j.files || [];
    setFiles(list);
    setError('');
    setSelectedDate((prev) => {
      if (prev) return prev;
      return list[0] ? list[0].replace(/\.jsonl$/i, '') : '';
    });
  }, []);

  useEffect(() => {
    if (user?.isAdmin) loadFiles();
  }, [user?.isAdmin, loadFiles]);

  useEffect(() => {
    if (!selectedDate || !user?.isAdmin) return undefined;
    let cancelled = false;
    (async () => {
      const token = localStorage.getItem('token');
      const r = await fetch(`${API}/api/admin/auction-logs/day/${encodeURIComponent(selectedDate)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (cancelled) return;
      if (!r.ok) {
        setError('Không tải được nội dung log.');
        setContent('');
        return;
      }
      const j = await r.json();
      setContent(j.content || '');
      setError('');
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDate, user?.isAdmin]);

  const filteredText = () => {
    const lines = content.split('\n').filter((l) => l.trim());
    const uid = filterUser.trim();
    if (!uid) return lines.join('\n');
    const n = Number(uid);
    if (!Number.isFinite(n)) return lines.join('\n');
    return lines
      .filter(
        (line) =>
          line.includes(`"seller_id":${n}`) ||
          line.includes(`"buyer_id":${n}`) ||
          line.includes(`"user_id":${n}`)
      )
      .join('\n');
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }
  if (!user?.isAdmin) {
    return null;
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>Quản lý hệ thống — Log đấu giá</h1>
        <button type="button" className="back-home-btn" onClick={() => navigate('/admin')}>
          ← Admin
        </button>
      </div>

      <div className="admin-content">
        <p>
          Mỗi ngày một file JSONL (nhẹ, dễ grep). Các sự kiện: mua ngay, kết thúc có người trúng, kết thúc không
          có bid. File cũ hơn 60 ngày (theo tên ngày) sẽ bị xóa khi có log mới ghi vào.
        </p>
        {error ? <p style={{ color: '#c00' }}>{error}</p> : null}
        <div style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <label>
            Ngày:{' '}
            <select value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}>
              {files.map((f) => {
                const d = f.replace(/\.jsonl$/i, '');
                return (
                  <option key={f} value={d}>
                    {d}
                  </option>
                );
              })}
            </select>
          </label>
          <label>
            Lọc theo user id:{' '}
            <input
              type="text"
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              placeholder="vd: 12"
              style={{ width: 100 }}
            />
          </label>
          <button type="button" onClick={() => loadFiles()}>
            Làm mới danh sách
          </button>
        </div>
        <pre
          style={{
            maxHeight: '60vh',
            overflow: 'auto',
            background: '#1a1a1a',
            color: '#e8e8e8',
            padding: 16,
            fontSize: 12,
            lineHeight: 1.45,
            borderRadius: 8,
          }}
        >
          {filteredText() || '(Trống)'}
        </pre>
      </div>
    </div>
  );
}

export default AdminAuctionLogs;
