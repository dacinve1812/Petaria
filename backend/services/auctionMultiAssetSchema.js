const db = require('../config/database');

let ensuredPromise = null;

/** Thêm cột / sửa NULL cần cho pet, spirit, currency auction (idempotent). */
function ensureAuctionMultiAssetSchema() {
  if (!ensuredPromise) {
    const dupCol = (e) =>
      e && (e.errno === 1060 || String(e.message || '').toLowerCase().includes('duplicate column name'));
    ensuredPromise = (async () => {
      try {
        await db.query('ALTER TABLE pets ADD COLUMN is_listed TINYINT(1) NOT NULL DEFAULT 0');
      } catch (e) {
        if (!dupCol(e)) console.warn('[auctionMultiAssetSchema] pets.is_listed:', e.message);
      }
      try {
        await db.query('ALTER TABLE user_spirits ADD COLUMN is_listed TINYINT(1) NOT NULL DEFAULT 0');
      } catch (e) {
        if (!dupCol(e)) console.warn('[auctionMultiAssetSchema] user_spirits.is_listed:', e.message);
      }
      try {
        await db.query('ALTER TABLE auctions MODIFY COLUMN item_id INT NULL');
      } catch (e) {
        console.warn('[auctionMultiAssetSchema] auctions.item_id NULL:', e.message);
      }
    })();
  }
  return ensuredPromise;
}

module.exports = { ensureAuctionMultiAssetSchema };
