/** Chuẩn hóa GET /api/users/:id/inventory (array cũ hoặc { items, slotCount, maxSlots }). */
export function normalizeInventoryResponse(data) {
  if (Array.isArray(data)) {
    return {
      items: data,
      slotCount: data.length,
      maxSlots: 100,
      freeSlots: Math.max(0, 100 - data.length),
    };
  }
  const items = Array.isArray(data?.items) ? data.items : [];
  const maxSlots = Number(data?.maxSlots) > 0 ? Number(data.maxSlots) : 100;
  const slotCount =
    data?.slotCount != null ? Number(data.slotCount) : items.length;
  return {
    items,
    slotCount,
    maxSlots,
    freeSlots:
      data?.freeSlots != null
        ? Number(data.freeSlots)
        : Math.max(0, maxSlots - slotCount),
  };
}

/** Lấy mảng từ API list (array cũ hoặc { pets|spirits|items: [...] }). */
export function asOwnedList(data, key) {
  if (Array.isArray(data)) return data;
  if (key && Array.isArray(data?.[key])) return data[key];
  if (Array.isArray(data?.pets)) return data.pets;
  if (Array.isArray(data?.spirits)) return data.spirits;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

export function normalizeOwnedCapacity(data, listKey, defaultMax) {
  const list = asOwnedList(data, listKey);
  const maxSlots =
    Number(data?.maxSlots) > 0 ? Number(data.maxSlots) : defaultMax;
  const slotCount =
    data?.slotCount != null ? Number(data.slotCount) : list.length;
  return {
    list,
    slotCount,
    maxSlots,
    freeSlots:
      data?.freeSlots != null
        ? Number(data.freeSlots)
        : Math.max(0, maxSlots - slotCount),
  };
}
