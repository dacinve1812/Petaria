-- Add multi-asset support to auctions (items / pets / spirits / currency)
-- NOTE: Run this migration manually against your MySQL DB.

-- 1) Extend auctions table to support multiple asset types
ALTER TABLE auctions
  ADD COLUMN asset_type ENUM('item','pet','spirit','currency') NOT NULL DEFAULT 'item' AFTER id,
  ADD COLUMN asset_ref_id INT NULL AFTER asset_type,
  ADD COLUMN asset_currency ENUM('peta','petagold') NULL AFTER asset_ref_id,
  ADD COLUMN asset_quantity INT NOT NULL DEFAULT 1 AFTER asset_currency,
  ADD COLUMN bid_currency ENUM('peta','petagold') NOT NULL DEFAULT 'peta' AFTER asset_quantity;

-- Backfill existing item auctions
UPDATE auctions SET asset_ref_id = item_id WHERE asset_type = 'item' AND asset_ref_id IS NULL;

-- Cho phép đấu giá pet / spirit / currency: item_id chỉ dùng khi asset_type = item
ALTER TABLE auctions MODIFY COLUMN item_id INT NULL;

-- 2) Keep old item_id for backwards compatibility (optional).
-- You can later drop item_id after codebase fully migrates.

-- 3) Add listing locks to pets & spirits so they can't be used while listed
ALTER TABLE pets ADD COLUMN is_listed TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE user_spirits ADD COLUMN is_listed TINYINT(1) NOT NULL DEFAULT 0;

CREATE INDEX idx_auctions_asset_type ON auctions(asset_type);
CREATE INDEX idx_auctions_asset_ref ON auctions(asset_ref_id);
CREATE INDEX idx_auctions_bid_currency ON auctions(bid_currency);
