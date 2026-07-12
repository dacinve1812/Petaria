/**
 * Cửa hàng thuộc tab Chung (General).
 * path: /shop/general/:code
 */
export const GENERAL_SHOPS = [
  {
    code: 'food',
    name: 'Cửa Hàng Thực Phẩm',
    vendor: 'Bà béo Oishi',
    description: 'Bán thức ăn, đồ uống',
    type_filter: 'food',
    currency_type: 'peta',
    image: '/images/shops/food.png',
    accent: '#e8a54b',
  },
  {
    code: 'pharmacy',
    name: 'Cửa Hàng Dược Phẩm',
    vendor: 'Đại phu Amorph',
    description: 'Bán các loại thuốc và độc dược',
    type_filter: 'consumable',
    currency_type: 'peta',
    image: '/images/shops/pharmacy.png',
    accent: '#6bb3c8',
  },
  {
    code: 'grocery',
    name: 'Cửa Hàng Tạp Hóa',
    vendor: 'Lái buôn Raaki',
    description: 'Bán các vật phẩm linh tinh',
    type_filter: 'misc',
    currency_type: 'peta',
    image: '/images/shops/grocery.png',
    accent: '#7cb87c',
  },
  {
    code: 'armory',
    name: 'Cửa Hàng Binh Khí',
    vendor: 'Thợ rèn Zicha',
    description: 'Bán vũ khí, giáp trụ',
    type_filter: 'equipment',
    currency_type: 'peta',
    image: '/images/shops/armory.png',
    accent: '#c47a5a',
  },
  {
    code: 'mystic',
    name: 'Cửa Hàng Thần Bí',
    vendor: 'Phù thủy Merlin',
    description: 'Bán các vật phẩm hiếm có và bí ẩn dành cho khách VIP',
    type_filter: 'misc',
    currency_type: 'peta',
    image: '/images/shops/mystic.png',
    accent: '#8b6bb8',
  },
  {
    code: 'golden',
    name: 'Cửa Hàng Hoàng Kim',
    vendor: 'Công tước Chrono',
    description: 'Bán các loại kỳ trân dị bảo, mua bán petaGold',
    type_filter: 'all',
    currency_type: 'petagold',
    image: '/images/shops/golden.png',
    accent: '#d4a017',
  },
  {
    code: 'flea',
    name: 'Chợ Trời',
    vendor: 'Cư dân Petaria',
    description: 'Các cửa hàng của cư dân Petaria',
    type_filter: 'all',
    currency_type: 'peta',
    image: '/images/shops/flea.png',
    accent: '#5a8fbf',
  },
];

export const EXCHANGE_SUB_SHOPS = [
  { label: 'Peta', value: 'peta' },
  { label: 'PetaGold', value: 'petagold' },
  { label: 'Arena', value: 'arena' },
  { label: 'Honor', value: 'honor' },
  { label: 'Guild', value: 'guild' },
  { label: 'Guild War', value: 'guildwar' },
];

export const PREMIUM_SUB_SHOPS = [
  { label: 'Gói tháng', value: 'monthly' },
  { label: 'Đặc biệt', value: 'special' },
  { label: 'Giới hạn', value: 'limited' },
  { label: 'Hàng ngày', value: 'daily' },
];

export function getGeneralShopByCode(code) {
  return GENERAL_SHOPS.find((s) => s.code === String(code || '').toLowerCase()) || null;
}

/** Ảnh shop: ưu tiên DB image_url, fallback config mặc định */
export function resolveShopImage(shop) {
  if (!shop) return '';
  const fromDb = String(shop.image_url || '').trim();
  if (fromDb) return fromDb;
  const fallback = getGeneralShopByCode(shop.code);
  return fallback?.image || `/images/shops/${String(shop.code || '').toLowerCase()}.png`;
}

/** Danh sách shop tab Chung từ API (seed + shop admin thêm) */
export function listGeneralShops(apiShops) {
  // Chỉ fallback config khi chưa có dữ liệu API (null/undefined)
  if (!Array.isArray(apiShops)) {
    return GENERAL_SHOPS.map((s) => ({
      code: s.code,
      name: s.name,
      description: `${s.vendor}: ${s.description}`,
      image_url: s.image,
      parent_category: 'general',
      type_filter: s.type_filter,
      currency_type: s.currency_type,
      is_active: 1,
    }));
  }

  return apiShops
    .filter((s) => String(s.parent_category || '').toLowerCase() === 'general')
    .filter((s) => Number(s.is_active) !== 0)
    .slice()
    .sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0));
}

/**
 * Sub-tabs Đổi thưởng / Cao cấp từ API.
 * fallback: EXCHANGE_SUB_SHOPS | PREMIUM_SUB_SHOPS (chỉ khi apiShops chưa load).
 */
export function listCategorySubTabs(apiShops, category, fallback = []) {
  const cat = String(category || '').toLowerCase();
  if (!Array.isArray(apiShops)) {
    return (fallback || []).map((t) => ({
      label: t.label,
      value: t.value,
      id: null,
    }));
  }

  return apiShops
    .filter((s) => String(s.parent_category || '').toLowerCase() === cat)
    .filter((s) => Number(s.is_active) !== 0)
    .slice()
    .sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0))
    .map((s) => ({
      label: s.name || s.code,
      value: String(s.code).toLowerCase(),
      id: s.id,
      shop: s,
    }));
}
