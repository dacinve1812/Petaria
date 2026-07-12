import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './EncounterModal.css';
import './CatchWildPetModal.css';

const NET_CODES = new Set([90000, 90001, 90002]);

/** Catalog luôn hiện 3 lưới (trái → phải theo rarity / tier). */
const NET_CATALOG = [
  { item_code: 90000, name: 'Lưới thường', rarity: 'common', image_url: 'normal_net.png' },
  { item_code: 90001, name: 'Lưới Điện', rarity: 'uncommon', image_url: 'electric_net.png' },
  { item_code: 90002, name: 'Lưới Đặc Biệt', rarity: 'epic', image_url: 'master_net.png' },
];

const RARITY_RANK = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
};

function successChanceRank(chance) {
  const c = Math.max(0, Number(chance) || 0);
  if (c < 10) return { key: 'very_low', label: 'Cực thấp' };
  if (c < 25) return { key: 'low', label: 'Thấp' };
  if (c < 50) return { key: 'medium', label: 'Trung bình' };
  if (c < 70) return { key: 'fairly_high', label: 'Khá cao' };
  if (c < 90) return { key: 'high', label: 'Cao' };
  return { key: 'very_high', label: 'Rất cao' };
}

function clampCatchChance(netRate, foodBonus, catchPenalty, maxCatchChance = 95) {
  const effectiveNet = Math.max(0, Number(netRate) - Number(catchPenalty || 0));
  const total = effectiveNet + Number(foodBonus || 0);
  const max = Number(maxCatchChance) || 95;
  return Math.max(0, Math.min(max, Math.round(total * 10) / 10));
}

function itemImg(url) {
  if (!url) return '/images/equipments/placeholder.png';
  if (url.startsWith('http') || url.startsWith('/')) return url;
  return `/images/equipments/${url}`;
}

function petImg(image) {
  if (!image) return '/images/pets/default.png';
  if (image.startsWith('http') || image.startsWith('/')) return image;
  return `/images/pets/${image}`;
}

function isFoodRow(it) {
  const cat = String(it.item_category || it.category || '').toLowerCase();
  return it.type === 'food' || (it.type === 'consumable' && cat === 'food');
}

function isNetRow(it) {
  const code = Number(it.item_code);
  if (NET_CODES.has(code)) return true;
  const name = String(it.name || '').toLowerCase();
  const sub = String(it.item_subtype || it.subtype || '').toLowerCase();
  return sub === 'catch_net' || name.includes('lưới') || name.includes('luoi');
}

function buildNetSlots(inventoryNets) {
  const byCode = new Map();
  for (const n of inventoryNets || []) {
    const code = Number(n.item_code);
    if (!NET_CODES.has(code)) continue;
    const qty = Number(n.quantity) || 0;
    const prev = byCode.get(code);
    if (!prev || qty > (Number(prev.quantity) || 0)) byCode.set(code, n);
  }

  return NET_CATALOG.map((cat) => {
    const inv = byCode.get(cat.item_code);
    const qty = inv ? Number(inv.quantity) || 0 : 0;
    const rarity = String(inv?.rarity || cat.rarity || 'common').toLowerCase();
    return {
      slotKey: cat.item_code,
      item_code: cat.item_code,
      inventoryId: qty > 0 ? inv.id : null,
      name: inv?.name || cat.name,
      rarity,
      image_url: inv?.image_url || cat.image_url,
      quantity: qty,
      disabled: qty <= 0,
    };
  }).sort((a, b) => {
    const ra = RARITY_RANK[a.rarity] ?? 0;
    const rb = RARITY_RANK[b.rarity] ?? 0;
    if (ra !== rb) return ra - rb;
    return a.item_code - b.item_code;
  });
}

/**
 * @param {{
 *   wildPet: object,
 *   token: string,
 *   userId: number|string,
 *   apiBase: string,
 *   onClose: () => void,
 *   onCaught: (result: object) => void,
 *   onFled: (message?: string) => void,
 * }} props
 */
function CatchWildPetModal({ wildPet, token, userId, apiBase, onClose, onCaught, onFled }) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [invNets, setInvNets] = useState([]);
  const [foods, setFoods] = useState([]);
  const [selectedNetId, setSelectedNetId] = useState(null);
  const [selectedFoodId, setSelectedFoodId] = useState(null);
  const [foodBonus, setFoodBonus] = useState(0);
  const [catchPenalty, setCatchPenalty] = useState(0);
  const [netRates, setNetRates] = useState({});
  const [maxCatchChance, setMaxCatchChance] = useState(95);
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState('');

  const speciesId = wildPet?.species_id ?? wildPet?.speciesId;
  const level = Math.max(1, Number(wildPet?.level) || 1);
  const petName = wildPet?.name || 'Pet';

  const netSlots = useMemo(() => buildNetSlots(invNets), [invNets]);

  const selectedNetSlot = useMemo(
    () => netSlots.find((n) => n.inventoryId === selectedNetId) || null,
    [netSlots, selectedNetId]
  );

  const successRank = useMemo(() => {
    if (!selectedNetSlot) return null;
    const netRate =
      netRates[String(selectedNetSlot.item_code)] ?? netRates[selectedNetSlot.item_code] ?? 0;
    const chance = clampCatchChance(netRate, foodBonus, catchPenalty, maxCatchChance);
    return successChanceRank(chance);
  }, [selectedNetSlot, netRates, foodBonus, catchPenalty, maxCatchChance]);

  const authHeaders = useCallback(
    () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }),
    [token]
  );

  const reloadInventory = useCallback(async () => {
    const res = await fetch(`${apiBase}/api/users/${userId}/inventory`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Không tải được túi đồ');
    const rows = await res.json();
    const list = Array.isArray(rows) ? rows : Array.isArray(rows?.items) ? rows.items : [];
    const netList = list.filter((r) => isNetRow(r));
    const foodList = list.filter((r) => Number(r.quantity) > 0 && isFoodRow(r));
    setInvNets(netList);
    setFoods(foodList);

    const available = buildNetSlots(netList).filter((s) => !s.disabled && s.inventoryId);
    setSelectedNetId((prev) => {
      if (prev && available.some((n) => n.inventoryId === prev)) return prev;
      return available[0]?.inventoryId ?? null;
    });
    setSelectedFoodId((prev) => {
      if (prev && foodList.some((f) => f.id === prev)) return prev;
      return foodList[0]?.id ?? null;
    });
  }, [apiBase, userId, token]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const sess = await fetch(`${apiBase}/api/hunting/catch/session`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            speciesId,
            level,
            name: wildPet?.name,
          }),
        });
        if (!sess.ok) {
          const b = await sess.json().catch(() => ({}));
          throw new Error(b.message || 'Không mở được phiên bắt');
        }
        const s = await sess.json();
        if (!cancelled) {
          setFoodBonus(s.foodBonus || 0);
          setCatchPenalty(Number(s.catchPenalty) || 0);
          setNetRates(s.netRates && typeof s.netRates === 'object' ? s.netRates : {});
          setMaxCatchChance(Number(s.maxCatchChance) || 95);
        }
        await reloadInventory();
      } catch (e) {
        if (!cancelled) setError(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBase, authHeaders, speciesId, level, wildPet?.name, reloadInventory]);

  const handleFeed = async () => {
    if (!selectedFoodId || busy) return;
    setBusy(true);
    setError('');
    setStatusMsg('');
    try {
      const res = await fetch(`${apiBase}/api/hunting/catch/feed`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ inventoryId: selectedFoodId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || 'Cho ăn thất bại');
      if (body.fled) {
        onFled(body.message || 'Pet hoảng sợ và chạy mất!');
        return;
      }
      setFoodBonus(body.foodBonus || 0);
      setStatusMsg(body.message || `${petName} có vẻ rất thích món này!`);
      await reloadInventory();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleThrowNet = async () => {
    if (!selectedNetId || busy) return;
    setBusy(true);
    setError('');
    setStatusMsg('');
    try {
      const res = await fetch(`${apiBase}/api/hunting/catch`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          netInventoryId: selectedNetId,
          speciesId,
          level,
          name: wildPet?.name,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || 'Ném lưới thất bại');
      if (body.success) {
        onCaught(body);
        return;
      }
      setStatusMsg(body.message || 'Hụt rồi!');
      if (body.foodBonus != null) setFoodBonus(body.foodBonus);
      await reloadInventory();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    try {
      await fetch(`${apiBase}/api/hunting/catch/cancel`, {
        method: 'POST',
        headers: authHeaders(),
        body: '{}',
      });
    } catch (_) {}
    onClose();
  };

  return (
    <div className="encounter-modal-overlay">
      <div className="encounter-modal-content catch-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="encounter-modal-close" onClick={handleCancel}>
          ✕
        </button>

        <div className="encounter-header">
          <h2 className="encounter-title">Bắt thú cưng</h2>
        </div>

        <div className="catch-pet-summary">
          <img
            src={petImg(wildPet?.image || wildPet?.sprite)}
            alt=""
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = '/images/pets/default.png';
            }}
          />
          <div className="catch-pet-summary-text">
            <div className="pet-name">{wildPet?.name || 'Pet'}</div>
            <div className="encounter-level">Lv. {level}</div>
          </div>
        </div>

        <div className="catch-stats-bar">
          <div className="catch-stat-line">
            Tỷ lệ thành công:{' '}
            {successRank ? (
              <strong className={`catch-rank catch-rank--${successRank.key}`}>
                {successRank.label}
              </strong>
            ) : (
              <strong className="catch-rank catch-rank--none">—</strong>
            )}
          </div>
          <div className="catch-stat-line">
            Bonus thức ăn:{' '}
            <strong className="catch-food-bonus">+{foodBonus}%</strong>
          </div>
        </div>

        {loading ? (
          <p className="catch-hint catch-hint-center">Đang tải túi đồ…</p>
        ) : (
          <>
            <section className="catch-section">
              <h4>Chọn lưới</h4>
              <div className="catch-item-grid catch-net-grid">
                {netSlots.map((n) => {
                  const selected = selectedNetId === n.inventoryId;
                  return (
                    <button
                      key={n.slotKey}
                      type="button"
                      className={
                        'catch-item-card' +
                        (selected ? ' selected' : '') +
                        (n.disabled ? ' disabled' : '')
                      }
                      onClick={() => {
                        if (n.disabled || !n.inventoryId) return;
                        setSelectedNetId(n.inventoryId);
                      }}
                      disabled={busy || n.disabled}
                      title={n.disabled ? 'Hết lưới' : n.name}
                    >
                      <img src={itemImg(n.image_url)} alt="" />
                      <span className="catch-item-name">{n.name}</span>
                      <span className="catch-item-meta">×{n.quantity}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="catch-section">
              <h4>Cho ăn</h4>
              {foods.length === 0 ? (
                <p className="catch-hint">Không có thức ăn trong túi.</p>
              ) : (
                <div className="catch-item-grid">
                  {foods.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className={'catch-item-card' + (selectedFoodId === f.id ? ' selected' : '')}
                      onClick={() => setSelectedFoodId(f.id)}
                      disabled={busy}
                    >
                      <img src={itemImg(f.image_url)} alt="" />
                      <span className="catch-item-name">{f.name}</span>
                      <span className="catch-item-meta">×{f.quantity}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {statusMsg && <p className="catch-status">{statusMsg}</p>}
        {error && <p className="catch-error">{error}</p>}

        <div className="encounter-actions">
          <button
            type="button"
            className="action-button secondary"
            onClick={handleFeed}
            disabled={busy || loading || !selectedFoodId}
          >
            Cho ăn
          </button>
          <button
            type="button"
            className="action-button primary"
            onClick={handleThrowNet}
            disabled={busy || loading || !selectedNetId}
          >
            Ném lưới
          </button>
          <button type="button" className="action-button ghost" onClick={handleCancel} disabled={busy}>
            Hủy
          </button>
        </div>
      </div>
    </div>
  );
}

export default CatchWildPetModal;
