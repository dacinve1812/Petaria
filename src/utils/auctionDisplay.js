/**
 * Ảnh + tên hiển thị phiên đấu giá (list + detail).
 * Icon tiền dùng /images/icons/* — thống nhất với Sidebar, Mail, Shop.
 */
export function getAuctionDisplay(auction) {
  if (!auction) {
    return { name: '—', image: '/images/default-item.png' };
  }
  const type = auction.asset_type || 'item';
  if (type === 'pet') {
    const img = auction.pet_species_image;
    let image = '/images/pets/placeholder.png';
    if (img) {
      const s = String(img);
      image = s.startsWith('http') || s.startsWith('/') ? s : `/images/pets/${s}`;
    }
    return {
      name: auction.pet_name || auction.pet_species_name || 'Pet',
      image,
    };
  }
  if (type === 'spirit') {
    const img = auction.spirit_image;
    let image = '/images/spirit/placeholder.png';
    if (img) {
      const s = String(img);
      image = s.startsWith('http') || s.startsWith('/') ? s : `/images/spirit/${s}`;
    }
    return {
      name: auction.spirit_name || 'Spirit',
      image,
    };
  }
  if (type === 'currency') {
    const cur = String(auction.asset_currency || 'peta').toLowerCase() === 'petagold' ? 'petagold' : 'peta';
    const qty = Math.floor(auction.asset_quantity || 0);
    return {
      name: `${qty.toLocaleString()} ${cur}`,
      image: cur === 'petagold' ? '/images/icons/petagold.png' : '/images/icons/peta.png',
    };
  }
  return {
    name: auction.item_name || 'Item',
    image: auction.item_image ? `/images/equipments/${auction.item_image}` : '/images/default-item.png',
  };
}
