import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import TemplatePage from '../template/TemplatePage';
import { useUser } from '../../UserContext';
import GameDialogModal from '../ui/GameDialogModal';
import ItemDetailModal from '../items/ItemDetailModal';
import './TasksPages.css';
import './TaskItemHuntPage.css';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
const FALLBACK_IMG = '/images/placeholder.png';

const TIER_META = {
  easy: { title: 'Dễ', subtitle: 'Nhiệm vụ vật phẩm', accent: 'easy' },
  medium: { title: 'Trung Bình', subtitle: 'Nhiệm vụ vật phẩm', accent: 'medium' },
  hard: { title: 'Khó', subtitle: 'Nhiệm vụ vật phẩm', accent: 'hard' },
  special: { title: 'Đặc Biệt', subtitle: 'Sự kiện Kỳ Trân', accent: 'special' },
};

function itemImageSrc(imageUrl) {
  if (!imageUrl) return FALLBACK_IMG;
  const s = String(imageUrl);
  if (s.startsWith('/') || s.startsWith('http')) return s;
  return `/images/equipments/${s}`;
}

function formatMs(ms) {
  const total = Math.max(0, Math.floor(Number(ms) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')} giờ ${String(m).padStart(2, '0')} phút ${String(s).padStart(2, '0')} giây`;
}

function formatDurationLabel(ms) {
  const mins = Math.round(Number(ms) / 60000);
  if (mins >= 60) return `${Math.round(mins / 60)} giờ`;
  return `${mins} phút`;
}

function rarityClass(r) {
  const k = String(r || '').toLowerCase();
  if (k === 'rare') return 'rare';
  if (k === 'epic') return 'epic';
  if (k === 'legendary') return 'legendary';
  return 'common';
}

function TaskItemHuntPage() {
  const navigate = useNavigate();
  const { user, isLoading } = useUser();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const [resultModal, setResultModal] = useState(null);
  const [reqDetailItem, setReqDetailItem] = useState(null);
  const [loreOpen, setLoreOpen] = useState(false);

  const token = user?.token;

  const loadStatus = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/tasks/item-hunt/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || 'Không tải được nhiệm vụ');
      setStatus(data);
      setError('');
      setTick((t) => t + 0); // keep ticker alive; remaining computed from absolute timestamps
    } catch (err) {
      setError(err.message || 'Lỗi kết nối');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      navigate('/login');
      return;
    }
    loadStatus();
  }, [isLoading, user, navigate, loadStatus]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const questRemainingMs = useMemo(() => {
    void tick;
    if (!status?.active_quest?.expires_at) return 0;
    return Math.max(0, new Date(status.active_quest.expires_at).getTime() - Date.now());
  }, [status?.active_quest?.expires_at, tick]);

  const cooldownRemainingMs = useMemo(() => {
    void tick;
    if (!status?.cooldown_until) {
      return Math.max(0, (Number(status?.cooldown_remaining_ms) || 0));
    }
    return Math.max(0, new Date(status.cooldown_until).getTime() - Date.now());
  }, [status?.cooldown_until, status?.cooldown_remaining_ms, tick]);

  // Auto refresh when quest just expired
  useEffect(() => {
    if (!status?.active_quest) return;
    if (questRemainingMs <= 0) {
      const t = setTimeout(() => loadStatus(), 400);
      return () => clearTimeout(t);
    }
  }, [questRemainingMs, status?.active_quest, loadStatus]);

  const acceptTier = async (tier) => {
    if (!token || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/tasks/item-hunt/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tier }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không nhận được nhiệm vụ');
      await loadStatus();
    } catch (err) {
      setError(err.message || 'Lỗi nhận nhiệm vụ');
    } finally {
      setBusy(false);
    }
  };

  const submitQuest = async () => {
    if (!token || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/tasks/item-hunt/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không nộp được nhiệm vụ');
      setResultModal(data);
      await loadStatus();
    } catch (err) {
      setError(err.message || 'Lỗi nộp nhiệm vụ');
    } finally {
      setBusy(false);
    }
  };

  const abandonQuest = async () => {
    if (!token || busy) return;
    setConfirmAbandon(false);
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/tasks/item-hunt/abandon`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không hủy được nhiệm vụ');
      await loadStatus();
    } catch (err) {
      setError(err.message || 'Lỗi hủy nhiệm vụ');
    } finally {
      setBusy(false);
    }
  };

  const active = status?.active_quest;

  return (
    <TemplatePage showSearch={false} showTabs={false}>
      <div className="tasks-page item-hunt-page">
        <div className="tasks-detail-header item-hunt-header">
          <button type="button" className="tasks-back-btn" onClick={() => navigate('/tasks')}>
            ← Quay lại danh sách nhiệm vụ
          </button>
          <div className="item-hunt-title-row">
            <h2>Truy tìm vật phẩm (Kỳ Trân Các)</h2>
            <button
              type="button"
              className="modal-help-icon-btn item-hunt-help-btn"
              onClick={() => setLoreOpen(true)}
              aria-label="Mô tả nhiệm vụ"
              title="Mô tả nhiệm vụ"
            >
              ?
            </button>
          </div>
        </div>

        {error ? <p className="item-hunt-error">{error}</p> : null}
        {loading ? <p className="item-hunt-loading">Đang tải…</p> : null}

        {!loading && cooldownRemainingMs > 0 && !active ? (
          <div className="item-hunt-cooldown">
            Thời gian chờ trước khi nhận nhiệm vụ mới:{' '}
            <strong>{formatMs(cooldownRemainingMs)}</strong>
          </div>
        ) : null}

        {!loading && active ? (
          <div className="item-hunt-active">
            <div className="item-hunt-timer">
              Thời gian còn lại: <strong>{formatMs(questRemainingMs)}</strong>
            </div>
            <div className="item-hunt-tier-badge">
              Cấp độ: <strong>{active.tier_label || active.tier}</strong>
            </div>

            <div className="item-hunt-actions">
              <button
                type="button"
                className="item-hunt-btn item-hunt-btn--primary"
                disabled={busy || !active.can_submit || questRemainingMs <= 0}
                onClick={() => void submitQuest()}
              >
                Nộp vật phẩm
              </button>
              <button
                type="button"
                className="item-hunt-btn item-hunt-btn--danger"
                disabled={busy}
                onClick={() => setConfirmAbandon(true)}
              >
                Hủy nhiệm vụ
              </button>
            </div>

            <section className="item-hunt-section">
              <h3>Yêu cầu vật phẩm</h3>
              <div className="item-hunt-item-row">
                {(active.requirements || []).map((req) => (
                  <button
                    type="button"
                    key={`${req.item_id}-${req.name}`}
                    className="item-hunt-item-card item-hunt-item-card--clickable"
                    onClick={() => setReqDetailItem(req)}
                  >
                    <img
                      src={itemImageSrc(req.image_url)}
                      alt=""
                      onError={(e) => {
                        e.currentTarget.src = FALLBACK_IMG;
                      }}
                    />
                    <div className="item-hunt-item-name">{req.name}</div>
                    <div
                      className={`item-hunt-item-progress ${
                        req.enough ? 'is-enough' : 'is-missing'
                      }`}
                    >
                      {req.owned}/{req.qty}
                    </div>
                    <div className={`item-hunt-rarity item-hunt-rarity--${rarityClass(req.rarity)}`}>
                      {req.rarity}
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="item-hunt-section">
              <h3>Phần thưởng</h3>
              <div className="item-hunt-item-row">
                {active.reward_item ? (
                  <div className="item-hunt-item-card">
                    <img
                      src={itemImageSrc(active.reward_item.image_url)}
                      alt=""
                      onError={(e) => {
                        e.currentTarget.src = FALLBACK_IMG;
                      }}
                    />
                    <div className="item-hunt-item-name">{active.reward_item.name}</div>
                    <div className="item-hunt-item-qty">x{active.reward_item.qty || 1}</div>
                    <div
                      className={`item-hunt-rarity item-hunt-rarity--${rarityClass(
                        active.reward_item.rarity
                      )}`}
                    >
                      {active.reward_item.rarity}
                    </div>
                  </div>
                ) : null}
                <div className="item-hunt-item-card item-hunt-item-card--peta">
                  <img src="/images/icons/peta.png" alt="" />
                  <div className="item-hunt-item-name">Peta</div>
                  <div className="item-hunt-item-qty">
                    +{(Number(active.reward_peta) || 0).toLocaleString('en-US')}
                  </div>
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {!loading && !active ? (
          <>
            <div className="item-hunt-tier-grid">
              {(status?.tiers || []).map((tier) => {
                const meta = TIER_META[tier.key] || {
                  title: tier.label,
                  subtitle: 'Nhiệm vụ vật phẩm',
                  accent: tier.key,
                };
                return (
                  <div key={tier.key} className="item-hunt-tier-wrap">
                    <div className={`item-hunt-tier-card item-hunt-tier-card--${meta.accent}`}>
                      <span className="item-hunt-tier-chip">MISSION ITEMs</span>
                      <div className="item-hunt-tier-title">{meta.title}</div>
                      <div className="item-hunt-tier-sub">{meta.subtitle}</div>
                      <div className="item-hunt-tier-meta">
                        <span>{formatDurationLabel(tier.duration_ms)}</span>
                        <span>
                          {tier.daily_used}/{tier.daily_limit} lượt
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="item-hunt-btn item-hunt-btn--primary item-hunt-tier-accept"
                      disabled={busy || !tier.available}
                      title={tier.locked_reason || undefined}
                      onClick={() => void acceptTier(tier.key)}
                    >
                      {tier.available ? `Nhận ${meta.title}` : tier.locked_reason || 'Không khả dụng'}
                    </button>
                  </div>
                );
              })}
            </div>

            
          </>
        ) : null}
      </div>

      <GameDialogModal
        isOpen={confirmAbandon}
        onClose={() => setConfirmAbandon(false)}
        title="Xác nhận hủy nhiệm vụ"
        mode="confirm"
        tone="warning"
        confirmLabel="Hủy nhiệm vụ"
        cancelLabel="Không"
        onConfirm={() => void abandonQuest()}
        onCancel={() => setConfirmAbandon(false)}
      >
        <p>
          Hủy nhiệm vụ sẽ áp dụng thời gian chờ <strong>30 phút</strong> trước khi nhận nhiệm vụ mới.
          Tiếp tục?
        </p>
      </GameDialogModal>

      <GameDialogModal
        isOpen={Boolean(resultModal)}
        onClose={() => setResultModal(null)}
        title="Hoàn thành nhiệm vụ!"
        mode="alert"
        tone="success"
        confirmLabel="Đóng"
        onConfirm={() => setResultModal(null)}
      >
        {resultModal?.reward ? (
          <div className="item-hunt-result">
            <p>Bạn nhận được:</p>
            <div className="item-hunt-result-row">
              {resultModal.reward.item ? (
                <div className="item-hunt-item-card">
                  <img
                    src={itemImageSrc(resultModal.reward.item.image_url)}
                    alt=""
                    onError={(e) => {
                      e.currentTarget.src = FALLBACK_IMG;
                    }}
                  />
                  <div className="item-hunt-item-name">{resultModal.reward.item.name}</div>
                  <div className="item-hunt-item-qty">
                    x{resultModal.reward.item.qty || 1}
                  </div>
                </div>
              ) : null}
              <div className="item-hunt-item-card item-hunt-item-card--peta">
                <img src="/images/icons/peta.png" alt="" />
                <div className="item-hunt-item-name">Peta</div>
                <div className="item-hunt-item-qty">
                  +{(Number(resultModal.reward.peta) || 0).toLocaleString('en-US')}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p>{resultModal?.message || 'Thành công!'}</p>
        )}
      </GameDialogModal>

      <GameDialogModal
        isOpen={loreOpen}
        onClose={() => setLoreOpen(false)}
        title="Truy tìm vật phẩm (Kỳ Trân Các)"
        mode="alert"
        tone="info"
        confirmLabel="Đóng"
        onConfirm={() => setLoreOpen(false)}
        className="ec-feature-lore-modal"
      >
        <div className="ec-feature-lore">
          <div className="ec-feature-lore__dialog">
            <div className="ec-feature-dialog__body">
              <ul className="item-hunt-lore-list">
                <li>Dễ / Trung bình / Khó: mở hằng ngày, nhận mọi lúc (giới hạn lượt).</li>
                <li>Đặc biệt: chỉ mở trong thời gian sự kiện.</li>
                <li>Càng khó → thời gian hoàn thành càng ngắn.</li>
                <li>Không mất lệ phí nhận. Hủy nhiệm vụ → chờ 30 phút.</li>
                <li>Hết giờ → thất bại và chờ 15 phút.</li>
                <li>Mỗi tài khoản chỉ 1 nhiệm vụ đang chạy.</li>
              </ul>
            </div>
          </div>
        </div>
      </GameDialogModal>

      {reqDetailItem ? (
        <ItemDetailModal
          item={reqDetailItem}
          mode="item-hunt"
          onClose={() => setReqDetailItem(null)}
        />
      ) : null}
    </TemplatePage>
  );
}

export default TaskItemHuntPage;
