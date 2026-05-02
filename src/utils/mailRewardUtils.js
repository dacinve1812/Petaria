/**
 * MySQL / driver có thể trả BOOLEAN/TINYINT dạng 0|1, chuỗi "0"|"1", hoặc BIT → Buffer.
 * Dùng helper này thay vì Boolean(mail.is_claimed) (Boolean("0") === true).
 */
export function normalizeSqlBool(value) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value === null || value === undefined) return false;
  if (typeof value === 'string') {
    const t = value.trim().toLowerCase();
    return t === '1' || t === 'true' || t === 'yes';
  }
  if (typeof value === 'bigint') return value === 1n;
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
    return value.length > 0 && value[0] === 1;
  }
  return false;
}

export function mailHasClaimableRewards(rewards) {
  if (!rewards || typeof rewards !== 'object') return false;
  return !!(
    rewards.peta ||
    rewards.peta_gold ||
    (rewards.items && rewards.items.length > 0) ||
    (rewards.spirits && rewards.spirits.length > 0) ||
    (rewards.pets && rewards.pets.length > 0) ||
    (rewards.auction_transfer_pet_ids && rewards.auction_transfer_pet_ids.length > 0) ||
    (rewards.auction_transfer_spirit_ids && rewards.auction_transfer_spirit_ids.length > 0)
  );
}

export function mailIsRewardsClaimed(mail) {
  return normalizeSqlBool(mail?.is_claimed);
}
