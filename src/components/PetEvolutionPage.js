import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TemplatePage from './template/TemplatePage';
import BackButton from './BackButton';
import GameModalButton from './ui/GameModalButton';
import './PetEvolutionPage.css';

/**
 * Trang phụ tiến hóa: hiện tại → yêu cầu (cấp + item) → loài đích.
 * API: GET /api/pets/:uuid/evolution-info, POST /api/pets/:uuid/evolve
 */
function PetEvolutionPage() {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const { uuid } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [targetId, setTargetId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const load = useCallback(async () => {
    if (!uuid || !API_BASE_URL || !token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/pets/${uuid}/evolution-info`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || `Lỗi ${res.status}`);
      }
      setInfo(data);
      const first = data.targets?.[0]?.species_id;
      setTargetId(first != null ? first : null);
    } catch (e) {
      setError(e.message || 'Không tải được dữ liệu tiến hóa.');
      setInfo(null);
    } finally {
      setLoading(false);
    }
  }, [uuid, API_BASE_URL, token]);

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    load();
  }, [token, navigate, load]);

  const handleEvolve = async () => {
    if (!targetId || !API_BASE_URL || !token) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/pets/${uuid}/evolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetSpeciesId: targetId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.message || 'Không thể tiến hóa.');
        return;
      }
      alert(data.message || 'Tiến hóa thành công!');
      navigate(`/pet/${uuid}`);
    } catch (e) {
      alert(e.message || 'Lỗi mạng');
    } finally {
      setSubmitting(false);
    }
  };

  const tabs = [{ label: '← Thú cưng', value: 'pet-evolve', path: `/pet/${uuid}` }];

  if (loading) {
    return (
      <TemplatePage tabs={tabs} showSearch={false} additionalControls={<BackButton onClick={() => navigate(`/pet/${uuid}`)} />} currentTab={0}>
        <div className="pet-evolution-page"><p className="pet-evolution-loading">Đang tải…</p></div>
      </TemplatePage>
    );
  }

  if (error || !info) {
    return (
      <TemplatePage tabs={tabs} showSearch={false} additionalControls={<BackButton onClick={() => navigate(`/pet/${uuid}`)} />} currentTab={0}>
        <div className="pet-evolution-page">
          <p className="pet-evolution-error">{error || 'Không có dữ liệu.'}</p>
          <GameModalButton type="button" variant="cancel" onClick={() => navigate(`/pet/${uuid}`)}>Quay lại</GameModalButton>
        </div>
      </TemplatePage>
    );
  }

  const { current, targets, requirements, can_evolve, reason, pet_level } = info;
  const selectedTarget = targets?.find((t) => t.species_id === targetId) || targets?.[0];

  return (
    <TemplatePage
      tabs={tabs}
      showSearch={false}
      additionalControls={<BackButton onClick={() => navigate(`/pet/${uuid}`)} />}
      currentTab={0}
    >
      <div className="pet-evolution-page">
        <h1 className="pet-evolution-title">Tiến hóa</h1>
        <p className="pet-evolution-sub">{info.pet_name}</p>

        <div className="pet-evolution-layout">
          <section className="pet-evolution-card pet-evolution-current">
            <h2>Hiện tại</h2>
            <div className="pet-evolution-img-wrap">
              {current?.image ? (
                <img src={`/images/pets/${current.image}`} alt={current.name} className="pet-evolution-img" onError={(e) => { e.target.src = '/images/pets/default.png'; }} />
              ) : (
                <div className="pet-evolution-img-placeholder">?</div>
              )}
            </div>
            <p className="pet-evolution-name">{current?.name}</p>
            {current?.type && <p className="pet-evolution-type">{current.type}</p>}
          </section>

          <section className="pet-evolution-card pet-evolution-requirements">
            <h2>Điều kiện</h2>
            <p className="pet-evolution-req-line">
              <strong>Đẳng cấp:</strong> {pet_level} / {requirements.min_level}
              {!requirements.meets_level && <span className="pet-evolution-bad"> (chưa đủ)</span>}
              {requirements.meets_level && <span className="pet-evolution-ok"> ✓</span>}
            </p>

            {requirements.needs_item && requirements.item ? (
              <div className="pet-evolution-item-block">
                <div className="pet-evolution-item-img-wrap">
                  <img
                    src={`/images/equipments/${requirements.item.image_url}`}
                    alt={requirements.item.name}
                    className="pet-evolution-item-img"
                    onError={(e) => { e.target.src = '/images/equipments/default.png'; e.target.onerror = null; }}
                  />
                </div>
                <p className="pet-evolution-item-name">{requirements.item.name}</p>
                <p className="pet-evolution-inv">
                  Trong túi: <strong>{requirements.inventory_quantity}</strong>
                </p>
              </div>
            ) : (
              <p className="pet-evolution-no-item">Không yêu cầu vật phẩm (admin để trống evolve_item_id).</p>
            )}

            {targets?.length > 1 && (
              <div className="pet-evolution-select-row">
                <label htmlFor="evolve-target">Hình thái đích</label>
                <select
                  id="evolve-target"
                  value={targetId ?? ''}
                  onChange={(e) => setTargetId(parseInt(e.target.value, 10))}
                >
                  {targets.map((t) => (
                    <option key={t.species_id} value={t.species_id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}

            {reason && !can_evolve && <p className="pet-evolution-reason">{reason}</p>}

            <GameModalButton
              type="button"
              variant="confirm"
              className="pet-evolution-use-btn"
              disabled={!can_evolve || submitting || !targetId}
              onClick={handleEvolve}
            >
              {submitting ? 'Đang xử lý…' : 'Sử dụng'}
            </GameModalButton>
          </section>

          <section className="pet-evolution-card pet-evolution-target">
            <h2>Sau tiến hóa</h2>
            <div className="pet-evolution-img-wrap">
              {selectedTarget?.image ? (
                <img src={`/images/pets/${selectedTarget.image}`} alt={selectedTarget.name} className="pet-evolution-img pet-evolution-img--large" onError={(e) => { e.target.src = '/images/pets/default.png'; }} />
              ) : (
                <div className="pet-evolution-img-placeholder">?</div>
              )}
            </div>
            <p className="pet-evolution-name">{selectedTarget?.name || '—'}</p>
            {selectedTarget?.type && <p className="pet-evolution-type">{selectedTarget.type}</p>}
          </section>
        </div>
      </div>
    </TemplatePage>
  );
}

export default PetEvolutionPage;
