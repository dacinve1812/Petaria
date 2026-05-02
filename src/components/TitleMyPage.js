import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../UserContext';
import TemplatePage from './template/TemplatePage';
import './TitleMyPage.css';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

const METRIC_KEYS = {
  peta_earned: 'peta_earned',
  peta_spent: 'peta_spent',
  pets_caught: 'pets_caught',
  pet_evolutions: 'pet_evolutions',
  hunt_wins: 'hunt_wins',
};

function formatNum(n) {
  const x = Number(n) || 0;
  return x.toLocaleString('vi-VN');
}

/** Mô tả điều kiện (tiếng Việt) — dùng ngưỡng của title để hiển thị */
function requirementDescription(title) {
  const t = Number(title.threshold) || 0;
  const formatted = formatNum(t);
  switch (title.metric_type) {
    case 'peta_earned':
      return `Kiếm được ${formatted} Peta (tổng)`;
    case 'peta_spent':
      return `Tiêu phí ${formatted} Peta (tổng)`;
    case 'pets_caught':
      return `Bắt thành công ${formatted} pet`;
    case 'pet_evolutions':
      return `Tiến hóa pet ${formatted} lần`;
    case 'hunt_wins':
      return `Chiến thắng quái khi đi săn ${formatted} lần`;
    default:
      return `Hoàn thành điều kiện (${title.metric_type})`;
  }
}

function TitleMyPage() {
  const navigate = useNavigate();
  const { user, isLoading } = useUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [titles, setTitles] = useState([]);
  const [state, setState] = useState({
    progress: {},
    unlocked: [],
    equipped_title_id: null,
  });
  const [equippingId, setEquippingId] = useState(null);

  const unlockedIds = useMemo(
    () => new Set((state.unlocked || []).map((u) => u.id)),
    [state.unlocked]
  );

  const loadData = useCallback(async () => {
    if (!user?.token) return;
    setLoading(true);
    setError('');
    try {
      const [pubRes, mineRes] = await Promise.all([
        fetch(`${API_BASE}/api/titles`),
        fetch(`${API_BASE}/api/user/titles-state`, {
          headers: { Authorization: `Bearer ${user.token}` },
        }),
      ]);
      const pubData = await pubRes.json();
      const mineData = await mineRes.json();
      if (!pubRes.ok) throw new Error(pubData.message || 'Không tải được danh sách danh hiệu');
      if (!mineRes.ok) throw new Error(mineData.message || 'Không tải được tiến độ');
      setTitles(Array.isArray(pubData) ? pubData : []);
      setState({
        progress: mineData.progress || {},
        unlocked: mineData.unlocked || [],
        equipped_title_id: mineData.equipped_title_id ?? null,
      });
    } catch (e) {
      setError(e.message || 'Lỗi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, [user?.token]);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      navigate('/login');
      return;
    }
    loadData();
  }, [isLoading, user, navigate, loadData]);

  const rows = useMemo(() => {
    const prog = state.progress || {};
    return titles.map((t) => {
      const col = METRIC_KEYS[t.metric_type] || t.metric_type;
      const current = Math.max(0, Number(prog[col]) || 0);
      const target = Math.max(0, Number(t.threshold) || 0);
      const pct = target > 0 ? Math.min(100, Math.floor((current / target) * 100)) : 0;
      const isUnlocked = unlockedIds.has(t.id) || (target > 0 && current >= target);
      const isEquipped = state.equipped_title_id === t.id;
      return {
        ...t,
        image_url: t.image_url || `/images/title/${String(t.image_key || 't1').replace(/[^a-zA-Z0-9_-]/g, '')}.png`,
        current,
        target,
        pct,
        isUnlocked,
        isEquipped,
        requirementText: requirementDescription(t),
      };
    });
  }, [titles, state.progress, state.equipped_title_id, unlockedIds]);

  const handleUse = async (titleId) => {
    if (!user?.token) return;
    setEquippingId(titleId);
    setError('');
    try {
      const r = await fetch(`${API_BASE}/api/user/equipped-title`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ titleId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || 'Không thể đặt danh hiệu');
      await loadData();
    } catch (e) {
      setError(e.message || 'Lỗi');
    } finally {
      setEquippingId(null);
    }
  };

  if (isLoading || !user) {
    return (
      <TemplatePage showSearch={false} showTabs={false}>
        <div className="title-my-page">
          <div className="title-my-loading">Đang tải…</div>
        </div>
      </TemplatePage>
    );
  }

  return (
    <TemplatePage showSearch={false} showTabs={false}>
      <div className="title-my-page">
        {error && <div className="title-my-error">{error}</div>}

        <section className="title-my-panel">
          <h2 className="title-my-panel-label">DANH SÁCH DANH HIỆU</h2>

          {loading ? (
            <div className="title-my-loading">Đang tải danh sách…</div>
          ) : (
            <div className="title-my-grid">
              {rows.map((row) => (
                <article
                  key={row.id}
                  className={`title-my-card ${row.isUnlocked ? 'title-my-card--unlocked' : 'title-my-card--locked'}`}
                >
                  <div className="title-my-card-visual">
                    <img
                      src={row.image_url}
                      alt=""
                      className="title-my-card-img"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.opacity = '0.35';
                      }}
                    />
                    {!row.isUnlocked && (
                      <div className="title-my-card-lock-overlay" aria-hidden>
                        CHƯA MỞ KHÓA
                      </div>
                    )}
                  </div>
                  <h3 className="title-my-card-name">{row.name}</h3>
                  <p className="title-my-card-req">{row.requirementText}</p>

                  <div className="title-my-progress-row">
                    <span className="title-my-progress-label">Tiến độ</span>
                    <span className="title-my-progress-values">
                      {formatNum(row.current)} / {formatNum(row.target)} ({row.pct}%)
                    </span>
                  </div>
                  <div className="title-my-card-divider" />

                  <div className="title-my-card-footer">
                    {!row.isUnlocked && <span className="title-my-status-muted">Chưa mở khóa</span>}
                    {row.isUnlocked && row.isEquipped && (
                      <span className="title-my-status-equipped">Đang dùng</span>
                    )}
                    {row.isUnlocked && !row.isEquipped && (
                      <button
                        type="button"
                        className="title-my-btn-use"
                        disabled={equippingId === row.id}
                        onClick={() => handleUse(row.id)}
                      >
                        {equippingId === row.id ? 'Đang lưu…' : 'Dùng'}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </TemplatePage>
  );
}

export default TitleMyPage;
