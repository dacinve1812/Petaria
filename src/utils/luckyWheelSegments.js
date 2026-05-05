/**
 * Ghép ô cố định (Peta, Peta Gold) + ô vật phẩm do admin cấu hình cho vòng quay.
 *
 * Khi có cả Peta và Peta Gold: xen một nửa danh sách item giữa hai ô tiền tệ — hai ô không kề nhau
 * trên đĩa miễn là có ≥ 2 ô vật phẩm (tổng ≥ 4 ô). Chỉ hai ô tiền (không item) vẫn kề nhau.
 */
export function buildLuckyWheelSegments(luckyWheel) {
  if (!luckyWheel) return [];
  const ps =
    luckyWheel.petaSlot && String(luckyWheel.petaSlot.currency || '').toLowerCase() === 'peta'
      ? luckyWheel.petaSlot
      : null;
  const pg =
    luckyWheel.petaGoldSlot && String(luckyWheel.petaGoldSlot.currency || '').toLowerCase() === 'petagold'
      ? luckyWheel.petaGoldSlot
      : null;
  const items = Array.isArray(luckyWheel.segments) ? luckyWheel.segments : [];

  if (!ps && !pg) return [...items];
  if (ps && !pg) return [ps, ...items];
  if (!ps && pg) return [pg, ...items];

  const firstCount = Math.ceil(items.length / 2);
  return [ps, ...items.slice(0, firstCount), pg, ...items.slice(firstCount)];
}
