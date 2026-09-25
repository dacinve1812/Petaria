import React, { useEffect, useMemo, useState } from 'react';
import GameDialogModal from './ui/GameDialogModal';
import { asOwnedList, normalizeInventoryResponse } from '../utils/inventoryApi';
import './PetEquipPickerModal.css';

const MAX_EQUIP_SLOTS = 4;

/**
 * Modal chọn linh thú / vật phẩm để trang bị cho pet hiện tại.
 * Hỗ trợ chuyển đồ đã trang bị trên pet khác (unequip → equip) sau khi confirm.
 */
function PetEquipPickerModal({
  isOpen,
  kind, // 'spirit' | 'item'
  petId,
  petName,
  userId,
  apiBaseUrl,
  onClose,
  onEquipped,
}) {
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [options, setOptions] = useState([]);
  const [pendingTransfer, setPendingTransfer] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const title = kind === 'spirit' ? 'Chọn linh thú' : 'Chọn vật phẩm trang bị';

  useEffect(() => {
    if (!isOpen || !userId || !apiBaseUrl) return undefined;

    let cancelled = false;
    const token = localStorage.getItem('token');

    const load = async () => {
      setLoading(true);
      setError(null);
      setPendingTransfer(null);
      setSearchTerm('');
      try {
        if (kind === 'spirit') {
          const res = await fetch(`${apiBaseUrl}/api/users/${userId}/spirits`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || data.message || 'Không tải được linh thú');
          if (!cancelled) setOptions(asOwnedList(data, 'spirits'));
        } else {
          const res = await fetch(`${apiBaseUrl}/api/users/${userId}/inventory`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || data.message || 'Không tải được kho đồ');
          const { items } = normalizeInventoryResponse(data);
          if (!cancelled) {
            setOptions(
              items.filter((it) => {
                if (it.type !== 'equipment') return false;
                if (it.is_broken === 1 || it.is_broken === true) return false;
                const dur = it.durability_left != null ? Number(it.durability_left) : 1;
                return dur > 0;
              })
            );
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setError(err.message || 'Lỗi tải dữ liệu');
          setOptions([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, kind, userId, apiBaseUrl]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => {
      const name = String(opt.name || opt.item_name || '').toLowerCase();
      const pet = String(opt.equipped_pet_name || opt.pet_name || '').toLowerCase();
      return name.includes(q) || pet.includes(q);
    });
  }, [options, searchTerm]);

  const isEquippedFlag = (opt) => {
    const v = opt?.is_equipped;
    return v === true || v === 1 || v === '1';
  };

  const isEquippedOnCurrent = (opt) => {
    const equippedPetId = Number(opt.equipped_pet_id);
    return isEquippedFlag(opt) && equippedPetId === Number(petId);
  };

  const isEquippedOnOther = (opt) => {
    const equippedPetId = Number(opt.equipped_pet_id);
    return isEquippedFlag(opt) && equippedPetId > 0 && equippedPetId !== Number(petId);
  };

  const unequipThenEquip = async (opt) => {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Chưa đăng nhập');

    if (kind === 'spirit') {
      if (isEquippedFlag(opt)) {
        const unequipRes = await fetch(`${apiBaseUrl}/api/spirits/unequip`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ userSpiritId: opt.id }),
        });
        const unequipData = await unequipRes.json().catch(() => ({}));
        if (!unequipRes.ok) {
          throw new Error(unequipData.error || unequipData.message || 'Không tháo được linh thú');
        }
      }

      const equipRes = await fetch(`${apiBaseUrl}/api/spirits/equip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userSpiritId: opt.id, petId }),
      });
      const equipData = await equipRes.json().catch(() => ({}));
      if (!equipRes.ok) {
        throw new Error(equipData.error || equipData.message || 'Không trang bị được linh thú');
      }
      return equipData.message || 'Trang bị linh thú thành công!';
    }

    // item
    if (isEquippedFlag(opt)) {
      const unequipRes = await fetch(`${apiBaseUrl}/api/inventory/${opt.id}/unequip`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const unequipData = await unequipRes.json().catch(() => ({}));
      if (!unequipRes.ok) {
        throw new Error(unequipData.message || unequipData.error || 'Không gỡ được vật phẩm');
      }
    }

    const equipRes = await fetch(`${apiBaseUrl}/api/pets/${petId}/equip-item`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ inventory_id: opt.id }),
    });
    const equipData = await equipRes.json().catch(() => ({}));
    if (!equipRes.ok) {
      throw new Error(equipData.message || equipData.error || 'Không trang bị được vật phẩm');
    }
    return equipData.message || 'Trang bị thành công!';
  };

  const handleSelect = async (opt) => {
    if (busy) return;
    if (isEquippedOnCurrent(opt)) {
      setError(`Đã trang bị cho ${petName || 'thú cưng này'}.`);
      return;
    }
    if (isEquippedOnOther(opt)) {
      setPendingTransfer(opt);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await unequipThenEquip(opt);
      onEquipped?.();
      onClose?.();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Trang bị thất bại');
    } finally {
      setBusy(false);
    }
  };

  const confirmTransfer = async () => {
    if (!pendingTransfer || busy) return;
    setBusy(true);
    setError(null);
    try {
      await unequipThenEquip(pendingTransfer);
      setPendingTransfer(null);
      onEquipped?.();
      onClose?.();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Chuyển trang bị thất bại');
      setPendingTransfer(null);
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  const otherPetName =
    pendingTransfer?.equipped_pet_name ||
    pendingTransfer?.pet_name ||
    'thú cưng khác';

  return (
    <>
      <div className="pet-equip-picker-overlay" onClick={() => !busy && onClose?.()} role="presentation">
        <div
          className="pet-equip-picker-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pet-equip-picker-title"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="pet-equip-picker-header">
            <h3 id="pet-equip-picker-title">{title}</h3>
            <button
              type="button"
              className="pet-equip-picker-close"
              onClick={() => !busy && onClose?.()}
              aria-label="Đóng"
              disabled={busy}
            >
              ×
            </button>
          </div>

          <p className="pet-equip-picker-subtitle">
            Trang bị cho <strong>{petName || 'thú cưng'}</strong>
            {kind === 'item' ? ` (tối đa ${MAX_EQUIP_SLOTS} ô)` : ` (tối đa ${MAX_EQUIP_SLOTS} linh thú)`}
          </p>

          <input
            type="search"
            className="pet-equip-picker-search"
            placeholder={kind === 'spirit' ? 'Tìm linh thú…' : 'Tìm vật phẩm…'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={busy}
          />

          {error && <p className="pet-equip-picker-error">{error}</p>}

          <div className="pet-equip-picker-body">
            {loading ? (
              <p className="pet-equip-picker-empty">Đang tải…</p>
            ) : filtered.length === 0 ? (
              <p className="pet-equip-picker-empty">
                {kind === 'spirit' ? 'Bạn chưa có linh thú nào.' : 'Không có vật phẩm trang bị trong kho.'}
              </p>
            ) : (
              <div className="pet-equip-picker-grid">
                {filtered.map((opt) => {
                  const name = opt.name || opt.item_name || '???';
                  const imgSrc =
                    kind === 'spirit'
                      ? `/images/spirit/${opt.image_url}`
                      : `/images/equipments/${opt.image_url}`;
                  const onCurrent = isEquippedOnCurrent(opt);
                  const onOther = isEquippedOnOther(opt);
                  const equippedLabel = onCurrent
                    ? 'Đang trang bị'
                    : onOther
                      ? `Đang trên: ${opt.equipped_pet_name || opt.pet_name || 'pet khác'}`
                      : null;

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      className={`pet-equip-picker-card${onCurrent ? ' is-current' : ''}${onOther ? ' is-other' : ''}`}
                      onClick={() => handleSelect(opt)}
                      disabled={busy || onCurrent}
                      title={equippedLabel || name}
                    >
                      <div className="pet-equip-picker-card__img-wrap">
                        <img
                          src={imgSrc}
                          alt={name}
                          onError={(e) => {
                            e.target.src =
                              kind === 'spirit'
                                ? '/images/spirit/angelpuss.gif'
                                : '/images/pets/placeholder.png';
                          }}
                        />
                        {onOther && <span className="pet-equip-picker-card__badge">E</span>}
                        {onCurrent && <span className="pet-equip-picker-card__badge is-current-badge">✓</span>}
                      </div>
                      <span className="pet-equip-picker-card__name">{name}</span>
                      {equippedLabel && (
                        <span className="pet-equip-picker-card__meta">{equippedLabel}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <GameDialogModal
        isOpen={Boolean(pendingTransfer)}
        onClose={() => !busy && setPendingTransfer(null)}
        title="Chuyển trang bị?"
        mode="confirm"
        tone="warning"
        confirmLabel={busy ? 'Đang chuyển…' : 'Xác nhận'}
        cancelLabel="Hủy"
        confirmDisabled={busy}
        onConfirm={confirmTransfer}
        onCancel={() => !busy && setPendingTransfer(null)}
      >
        <p>
          <strong>{pendingTransfer?.name || pendingTransfer?.item_name}</strong> đang trang bị cho{' '}
          <strong>{otherPetName}</strong>.
        </p>
        <p>
          Gỡ khỏi thú đó và trang bị cho <strong>{petName || 'thú cưng hiện tại'}</strong>?
        </p>
      </GameDialogModal>
    </>
  );
}

export default PetEquipPickerModal;
export { MAX_EQUIP_SLOTS };
