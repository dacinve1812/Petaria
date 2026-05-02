const express = require('express');
const router = express.Router();
const db = require('../config/database');
const auth = require('../middleware/auth');
const titleService = require('../titleService');
const { appendAuctionAdminLog } = require('../services/auctionAdminLog');
const { buildAuctionMail } = require('../services/auctionMailTemplateService');
const { ensureAuctionMultiAssetSchema } = require('../services/auctionMultiAssetSchema');

const MAIL_SENDER_NAME = 'Hệ thống';
const MAIL_EXPIRE_DAYS = 30;
/** Locale nội dung thư đấu giá (vi | en). Sau này có thể map theo user / Accept-Language. */
const AUCTION_MAIL_LOCALE = process.env.AUCTION_MAIL_LOCALE || 'vi';

// Helper function to deduct currency for auctions (supports peta / petagold)
const deductCurrencyForAuction = async (userId, amount, currency = 'peta', runner = db) => {
  const cur = String(currency || 'peta').toLowerCase() === 'petagold' ? 'petagold' : 'peta';
  const amt = Math.floor(Number(amount));
  if (!Number.isFinite(amt) || amt < 1) {
    throw new Error(`Invalid auction currency amount: ${amount}`);
  }
  console.log(`deductCurrencyForAuction: User ${userId}, Amount ${amt}, Currency ${cur}`);
  
  const [user] = await runner.query('SELECT peta, petagold FROM users WHERE id = ?', [userId]);
  console.log(`User balance before: Peta ${user[0].peta}, PetaGold ${user[0].petagold}`);
  
  const balance = Math.floor(cur === 'petagold' ? (user[0].petagold || 0) : (user[0].peta || 0));
  if (balance < amt) {
    throw new Error(`Insufficient ${cur} for auction`);
  }
  
  await runner.query(`UPDATE users SET ${cur} = ${cur} - ? WHERE id = ?`, [amt, userId]);
  console.log(`Updated ${cur}: -${amt}`);
  try {
    if (cur === 'peta') await titleService.recordPetaSpent(db, userId, amt);
  } catch (e) {
    console.error('title auction spend:', e);
  }
  
  return cur === 'peta'
    ? { petaDeduction: amt, petagoldDeduction: 0 }
    : { petaDeduction: 0, petagoldDeduction: amt };
};

// Helper function to deduct currency (prioritize petagold first, then gold) - for other systems
const deductCurrency = async (userId, amount) => {
  console.log(`deductCurrency: User ${userId}, Amount ${amount}`);
  
  const [user] = await db.query('SELECT peta, petagold FROM users WHERE id = ?', [userId]);
  console.log(`User balance before: Peta ${user[0].peta}, PetaGold ${user[0].petagold}`);
  
  let remainingDeduction = amount;
  let petagoldDeduction = 0;
  let petaDeduction = 0;
  
  if (user[0].petagold >= remainingDeduction) {
    petagoldDeduction = remainingDeduction;
    remainingDeduction = 0;
  } else {
    petagoldDeduction = user[0].petagold || 0;
    remainingDeduction -= petagoldDeduction;
    petaDeduction = remainingDeduction;
  }
  
  console.log(`Deduction plan: PetaGold ${petagoldDeduction}, Peta ${petaDeduction}`);
  
  if (petagoldDeduction > 0) {
    await db.query('UPDATE users SET petagold = petagold - ? WHERE id = ?', [petagoldDeduction, userId]);
    console.log(`Updated PetaGold: -${petagoldDeduction}`);
  }
  if (petaDeduction > 0) {
    await db.query('UPDATE users SET peta = peta - ? WHERE id = ?', [petaDeduction, userId]);
    console.log(`Updated Peta: -${petaDeduction}`);
  }
  
  return { petagoldDeduction, petaDeduction };
};

// Helper function to add currency (add to petagold as premium currency)
const addCurrency = async (userId, amount) => {
  console.log(`addCurrency: User ${userId}, Amount ${amount}`);
  await db.query('UPDATE users SET petagold = petagold + ? WHERE id = ?', [amount, userId]);
  console.log(`Added ${amount} to User ${userId} PetaGold`);
};

// Helper function to add currency for auction refunds (add to Peta)
// refund = hoàn đặt giá (giảm chỉ số tiêu phí đã ghi); income = tiền bán đấu giá (kiếm được)

/** Thêm 1 item catalog vào inventory người chơi (stack hoặc dòng equipment riêng). */
async function grantOneItemToInventory(playerId, itemId, runner = db) {
  const [itemRows] = await runner.query('SELECT id, type FROM items WHERE id = ?', [itemId]);
  if (!itemRows.length) return;
  const itemRow = itemRows[0];
  if (itemRow.type === 'equipment') {
    const [equipInfo] = await runner.query('SELECT durability_max FROM equipment_data WHERE item_id = ?', [itemId]);
    const durability = equipInfo.length > 0 ? (equipInfo[0].durability_max ?? 1) : 1;
    await runner.query(
      `INSERT INTO inventory (player_id, item_id, quantity, is_equipped, durability_left) VALUES (?, ?, 1, 0, ?)`,
      [playerId, itemId, durability]
    );
  } else {
    const [invRows] = await runner.query(
      `SELECT id FROM inventory WHERE player_id = ? AND item_id = ? AND (is_equipped = 0 OR is_equipped IS NULL)`,
      [playerId, itemId]
    );
    if (invRows.length > 0) {
      await runner.query('UPDATE inventory SET quantity = quantity + 1 WHERE id = ?', [invRows[0].id]);
    } else {
      await runner.query('INSERT INTO inventory (player_id, item_id, quantity) VALUES (?, ?, 1)', [playerId, itemId]);
    }
  }
}

/** Trang bị: chỉ đấu giá khi còn max độ bền; bỏ qua nếu vĩnh cửu (unbreakable / max rất lớn) hoặc random/unknown không có max. */
function isInventoryRowEligibleForEquipmentAuction(row) {
  const itemType = String(row.item_type || row.type || '').toLowerCase();
  if (itemType !== 'equipment') return true;
  const mode = String(row.durability_mode || '').toLowerCase();
  const max = row.durability_max != null ? Number(row.durability_max) : NaN;
  const left = row.durability_left != null ? Number(row.durability_left) : NaN;
  if (mode === 'unbreakable' || (Number.isFinite(max) && max >= 999999)) return true;
  if (mode === 'unknown' || mode === 'random') return true;
  if (!Number.isFinite(max) || max <= 0) return true;
  return Number.isFinite(left) && left >= max;
}

const addCurrencyForAuction = async (userId, amount, kind = 'refund', currency = 'peta', runner = db) => {
  const cur = String(currency || 'peta').toLowerCase() === 'petagold' ? 'petagold' : 'peta';
  const amt = Math.floor(Number(amount));
  if (!Number.isFinite(amt) || amt < 0) {
    throw new Error(`Invalid auction currency amount: ${amount}`);
  }
  console.log(`addCurrencyForAuction: User ${userId}, Amount ${amt}, Currency ${cur}`);
  await runner.query(`UPDATE users SET ${cur} = ${cur} + ? WHERE id = ?`, [amt, userId]);
  console.log(`Added ${amt} to User ${userId} ${cur}`);
  try {
    if (cur === 'peta') {
      if (kind === 'refund') await titleService.recordPetaSpent(db, userId, -amt);
      else if (kind === 'income') await titleService.recordPetaEarned(db, userId, amt);
    }
  } catch (e) {
    console.error('title auction peta adjust:', e);
  }
};

async function insertAuctionSystemMail(runner, { userId, subject, message, attachedRewards = null, expireDays = MAIL_EXPIRE_DAYS }) {
  const expireAt = new Date();
  expireAt.setDate(expireAt.getDate() + expireDays);
  let rewardsJson = null;
  if (attachedRewards && typeof attachedRewards === 'object' && Object.keys(attachedRewards).length > 0) {
    rewardsJson = JSON.stringify(attachedRewards);
  }
  await runner.query(
    `INSERT INTO mails (user_id, sender_type, sender_name, subject, message, attached_rewards, expire_at)
     VALUES (?, 'system', ?, ?, ?, ?, ?)`,
    [userId, MAIL_SENDER_NAME, subject, message, rewardsJson, expireAt]
  );
}

function describeAuctionAssetShort(a) {
  const t = a.asset_type || 'item';
  if (t === 'currency') {
    const c = String(a.asset_currency || 'peta').toLowerCase() === 'petagold' ? 'petagold' : 'peta';
    return `${Math.floor(Number(a.asset_quantity) || 0)} ${c}`;
  }
  if (t === 'pet') return `Thú cưng (#${a.asset_ref_id})`;
  if (t === 'spirit') return `Linh thú (#${a.asset_ref_id})`;
  return `Vật phẩm / trang bị (#${a.asset_ref_id || a.item_id})`;
}

function currencyMailAttachment(bidCur, amount) {
  const amt = Math.floor(Number(amount));
  if (bidCur === 'petagold') return { peta_gold: amt };
  return { peta: amt };
}

/** Tên hiển thị trong thư cho người mua (tên item/pet/spirit hoặc mô tả tiền). */
async function getBuyerMailAssetDisplayName(auctionData, runner = db) {
  const t = auctionData.asset_type || 'item';
  if (t === 'item') {
    const catalogId = parseInt(auctionData.asset_ref_id || auctionData.item_id, 10);
    if (!Number.isFinite(catalogId)) return describeAuctionAssetShort(auctionData);
    const [r] = await runner.query('SELECT name FROM items WHERE id = ? LIMIT 1', [catalogId]);
    return r.length ? r[0].name : describeAuctionAssetShort(auctionData);
  }
  if (t === 'pet') {
    const pid = parseInt(auctionData.asset_ref_id, 10);
    if (!Number.isFinite(pid)) return describeAuctionAssetShort(auctionData);
    const [r] = await runner.query('SELECT name FROM pets WHERE id = ? LIMIT 1', [pid]);
    return r.length ? r[0].name : `Thú cưng #${pid}`;
  }
  if (t === 'spirit') {
    const sid = parseInt(auctionData.asset_ref_id, 10);
    if (!Number.isFinite(sid)) return describeAuctionAssetShort(auctionData);
    const [r] = await runner.query(
      `SELECT s.name FROM user_spirits us JOIN spirits s ON s.id = us.spirit_id WHERE us.id = ? LIMIT 1`,
      [sid]
    );
    return r.length ? r[0].name : `Linh thú #${sid}`;
  }
  if (t === 'currency') {
    return describeAuctionAssetShort(auctionData);
  }
  return describeAuctionAssetShort(auctionData);
}

/** Phần thưởng đính kèm thư người mua — item/currency khi claim; pet/spirit đã chuyển owner khi kết phiên, claim chỉ idempotent. */
function buildBuyerAuctionMailAttachmentRewards(auctionData) {
  const aType = auctionData.asset_type || 'item';
  const out = {};
  if (aType === 'item') {
    const catalogId = parseInt(auctionData.asset_ref_id || auctionData.item_id, 10);
    if (Number.isFinite(catalogId) && catalogId > 0) {
      out.items = [{ item_id: catalogId, quantity: 1 }];
    }
  } else if (aType === 'pet') {
    const pid = parseInt(auctionData.asset_ref_id, 10);
    if (Number.isFinite(pid)) out.auction_transfer_pet_ids = [pid];
  } else if (aType === 'spirit') {
    const sid = parseInt(auctionData.asset_ref_id, 10);
    if (Number.isFinite(sid)) out.auction_transfer_spirit_ids = [sid];
  } else if (aType === 'currency') {
    const cur = String(auctionData.asset_currency || 'peta').toLowerCase() === 'petagold' ? 'petagold' : 'peta';
    Object.assign(out, currencyMailAttachment(cur, auctionData.asset_quantity));
  }
  return out;
}

async function returnAuctionAssetToSeller(auctionData, runner = db) {
  const sellerId = auctionData.seller_id;
  const aType = auctionData.asset_type || 'item';
  if (aType === 'item') {
    const catalogId = parseInt(auctionData.asset_ref_id || auctionData.item_id, 10);
    if (Number.isFinite(catalogId) && catalogId > 0) await grantOneItemToInventory(sellerId, catalogId, runner);
  } else if (aType === 'pet') {
    await runner.query('UPDATE pets SET is_listed = 0 WHERE id = ? AND owner_id = ?', [
      auctionData.asset_ref_id,
      sellerId,
    ]);
  } else if (aType === 'spirit') {
    await runner.query('UPDATE user_spirits SET is_listed = 0 WHERE id = ? AND user_id = ?', [
      auctionData.asset_ref_id,
      sellerId,
    ]);
  } else if (aType === 'currency') {
    const cur = String(auctionData.asset_currency || 'peta').toLowerCase() === 'petagold' ? 'petagold' : 'peta';
    const qty = parseInt(auctionData.asset_quantity || 0, 10);
    if (qty > 0) await addCurrencyForAuction(sellerId, qty, 'refund', cur, runner);
  }
}

/** Pet/spirit đấu giá: chuyển quyền sở hữu ngay cho buyer (gỡ khỏi tầm thao tác của seller). Thư claim chỉ còn idempotent. */
async function transferAuctionPetSpiritFromSeller(conn, auctionRow, newOwnerUserId) {
  const aType = auctionRow.asset_type || 'item';
  const sellerId = Number(auctionRow.seller_id);
  const ref = parseInt(auctionRow.asset_ref_id, 10);
  const buyer = Number(newOwnerUserId);
  if (!Number.isFinite(buyer) || buyer < 1 || buyer === sellerId) return;
  if (!Number.isFinite(ref) || ref < 1) return;
  if (aType === 'pet') {
    await conn.query('UPDATE pets SET owner_id = ?, is_listed = 0 WHERE id = ? AND owner_id = ?', [
      buyer,
      ref,
      sellerId,
    ]);
  } else if (aType === 'spirit') {
    await conn.query(
      `UPDATE user_spirits
       SET user_id = ?, is_equipped = 0, equipped_pet_id = NULL, is_listed = 0
       WHERE id = ? AND user_id = ?`,
      [buyer, ref, sellerId]
    );
  }
}

async function settleOneAuctionRow(conn, row) {
  const id = row.id;
  const [locked] = await conn.query(
    'SELECT * FROM auctions WHERE id = ? AND status = "active" FOR UPDATE',
    [id]
  );
  if (!locked.length) return null;
  const a = locked[0];
  if (new Date(a.end_time) >= new Date()) return null;

  const bidCur = String(a.bid_currency || 'peta').toLowerCase() === 'petagold' ? 'petagold' : 'peta';
  const curLabel = bidCur === 'petagold' ? 'PetaGold' : 'Peta';

  const [topBid] = await conn.query(
    `SELECT bidder_id, bid_amount FROM auction_bids WHERE auction_id = ? ORDER BY bid_amount DESC LIMIT 1`,
    [id]
  );

  if (!topBid.length) {
    await returnAuctionAssetToSeller(a, conn);
    await conn.query(`UPDATE auctions SET status = 'ended' WHERE id = ?`, [id]);
    const noBidItemName = await getBuyerMailAssetDisplayName(a, conn);
    await insertAuctionSystemMail(conn, {
      userId: a.seller_id,
      ...(await buildAuctionMail(conn, 'settle_no_bids_seller', AUCTION_MAIL_LOCALE, {
        item_name: noBidItemName,
      })),
    });
    return {
      event: 'auction_ended_no_bids',
      auction_id: id,
      seller_id: a.seller_id,
      asset_type: a.asset_type || 'item',
    };
  }

  const winnerId = topBid[0].bidder_id;
  const winAmount = Math.floor(Number(topBid[0].bid_amount));
  const itemName = await getBuyerMailAssetDisplayName(a, conn);

  await insertAuctionSystemMail(conn, {
    userId: a.seller_id,
    ...(await buildAuctionMail(conn, 'settle_win_seller', AUCTION_MAIL_LOCALE, {
      item_name: itemName,
      amount_fmt: winAmount.toLocaleString('vi-VN'),
      currency_label: curLabel,
    })),
    attachedRewards: currencyMailAttachment(bidCur, winAmount),
  });

  await insertAuctionSystemMail(conn, {
    userId: winnerId,
    ...(await buildAuctionMail(conn, 'settle_win_buyer', AUCTION_MAIL_LOCALE, {
      item_name: itemName,
      amount_fmt: winAmount.toLocaleString('vi-VN'),
      currency_label: curLabel,
    })),
    attachedRewards: buildBuyerAuctionMailAttachmentRewards(a),
  });

  await transferAuctionPetSpiritFromSeller(conn, a, winnerId);

  await conn.query(`UPDATE auctions SET status = 'ended' WHERE id = ?`, [id]);

  return {
    event: 'auction_settled_win',
    auction_id: id,
    seller_id: a.seller_id,
    buyer_id: winnerId,
    amount: winAmount,
    currency: bidCur,
    asset_type: a.asset_type || 'item',
  };
}

async function settleDueAuctions() {
  const [due] = await db.query(
    `SELECT id FROM auctions WHERE status = 'active' AND end_time < NOW() ORDER BY end_time ASC LIMIT 40`
  );
  for (const row of due) {
    const conn = await db.getConnection();
    let logPayload = null;
    try {
      await conn.beginTransaction();
      logPayload = await settleOneAuctionRow(conn, row);
      await conn.commit();
      if (logPayload) await appendAuctionAdminLog(logPayload);
    } catch (e) {
      try {
        await conn.rollback();
      } catch (_) {}
      console.error('settleDueAuctions auction', row.id, e);
    } finally {
      conn.release();
    }
  }
}

// Get all active auctions with pagination and search
router.get('/', async (req, res) => {
  try {
    await settleDueAuctions();
    const { 
      page = 1, 
      limit = 20, 
      search = '', 
      sortBy = 'end_time', 
      order = 'ASC',
      seller_id = null,
      asset_type = null
    } = req.query;
    
    const offset = (page - 1) * limit;
    const validSortFields = ['end_time', 'current_bid', 'starting_price', 'created_at'];
    const validOrders = ['ASC', 'DESC'];
    
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'end_time';
    const sortOrder = validOrders.includes(order.toUpperCase()) ? order.toUpperCase() : 'ASC';
    
    let query = `
      SELECT 
        a.id,
        a.asset_type,
        a.asset_ref_id,
        a.asset_currency,
        a.asset_quantity,
        a.bid_currency,
        a.item_id,
        a.seller_id,
        a.starting_price,
        a.current_bid,
        a.buy_now_price,
        a.min_increment,
        a.end_time,
        a.status,
        a.created_at,
        -- Item fields (when asset_type='item')
        i.name as item_name,
        i.description as item_description,
        i.image_url as item_image,
        i.rarity as item_rarity,
        i.type as item_type,
        -- Pet fields (when asset_type='pet')
        p.name as pet_name,
        ps.name as pet_species_name,
        ps.image as pet_species_image,
        p.level as pet_level,
        -- Spirit fields (when asset_type='spirit')
        us.id as user_spirit_id,
        s.name as spirit_name,
        s.image_url as spirit_image,
        s.rarity as spirit_rarity,
        COALESCE(NULLIF(TRIM(up.display_name), ''), u.username) as seller_name,
        (SELECT COUNT(*) FROM auction_bids ab WHERE ab.auction_id = a.id) as bid_count,
        (SELECT ab.bidder_id FROM auction_bids ab WHERE ab.auction_id = a.id ORDER BY ab.bid_amount DESC LIMIT 1) as highest_bidder_id,
        (
          SELECT COALESCE(NULLIF(TRIM(up2.display_name), ''), u2.username)
          FROM auction_bids ab
          JOIN users u2 ON ab.bidder_id = u2.id
          LEFT JOIN user_profiles up2 ON up2.user_id = u2.id
          WHERE ab.auction_id = a.id
          ORDER BY ab.bid_amount DESC
          LIMIT 1
        ) as highest_bidder_name
      FROM auctions a
      LEFT JOIN items i ON i.id = a.asset_ref_id AND a.asset_type = 'item'
      LEFT JOIN pets p ON p.id = a.asset_ref_id AND a.asset_type = 'pet'
      LEFT JOIN pet_species ps ON ps.id = p.pet_species_id
      LEFT JOIN user_spirits us ON us.id = a.asset_ref_id AND a.asset_type = 'spirit'
      LEFT JOIN spirits s ON s.id = us.spirit_id
      JOIN users u ON a.seller_id = u.id
      LEFT JOIN user_profiles up ON up.user_id = u.id
      WHERE a.status = 'active' AND a.end_time > NOW()
    `;
    
    const queryParams = [];
    
    if (search) {
      query += ` AND (
        (a.asset_type = 'item' AND i.name LIKE ?)
        OR (a.asset_type = 'pet' AND (p.name LIKE ? OR ps.name LIKE ?))
        OR (a.asset_type = 'spirit' AND s.name LIKE ?)
        OR (a.asset_type = 'currency' AND CONCAT(a.asset_currency, ' ', a.asset_quantity) LIKE ?)
      )`;
      queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    
    if (seller_id) {
      query += ` AND a.seller_id = ?`;
      queryParams.push(seller_id);
    }

    if (asset_type && ['item','pet','spirit','currency'].includes(String(asset_type))) {
      query += ` AND a.asset_type = ?`;
      queryParams.push(String(asset_type));
    }
    
    query += ` ORDER BY a.${sortField} ${sortOrder} LIMIT ? OFFSET ?`;
    queryParams.push(parseInt(limit), parseInt(offset));
    
    const [auctions] = await db.query(query, queryParams);
    
    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM auctions a
      WHERE a.status = 'active' AND a.end_time > NOW()
    `;
    
    const countParams = [];
    if (search) {
      countQuery += ` AND (
        (a.asset_type = 'item' AND EXISTS (SELECT 1 FROM items i WHERE i.id = a.asset_ref_id AND i.name LIKE ?))
        OR (a.asset_type = 'pet' AND EXISTS (
          SELECT 1 FROM pets p JOIN pet_species ps ON ps.id = p.pet_species_id
          WHERE p.id = a.asset_ref_id AND (p.name LIKE ? OR ps.name LIKE ?)
        ))
        OR (a.asset_type = 'spirit' AND EXISTS (
          SELECT 1 FROM user_spirits us JOIN spirits s ON s.id = us.spirit_id
          WHERE us.id = a.asset_ref_id AND s.name LIKE ?
        ))
        OR (a.asset_type = 'currency' AND CONCAT(a.asset_currency, ' ', a.asset_quantity) LIKE ?)
      )`;
      countParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    
    if (seller_id) {
      countQuery += ` AND a.seller_id = ?`;
      countParams.push(seller_id);
    }

    if (asset_type && ['item','pet','spirit','currency'].includes(String(asset_type))) {
      countQuery += ` AND a.asset_type = ?`;
      countParams.push(String(asset_type));
    }
    
    const [countResult] = await db.query(countQuery, countParams);
    const total = countResult[0].total;
    
    res.json({
      auctions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching auctions:', error);
    res.status(500).json({ message: 'Error fetching auctions' });
  }
});

/** SELECT + JOINs giống danh sách đấu giá — dùng cho /me (đang bán / đang bid). */
function sqlAuctionCardFrom(extraSelect = '') {
  return `
    SELECT
      a.id,
      a.asset_type,
      a.asset_ref_id,
      a.asset_currency,
      a.asset_quantity,
      a.bid_currency,
      a.item_id,
      a.seller_id,
      a.starting_price,
      a.current_bid,
      a.buy_now_price,
      a.min_increment,
      a.end_time,
      a.status,
      a.created_at,
      i.name as item_name,
      i.description as item_description,
      i.image_url as item_image,
      i.rarity as item_rarity,
      i.type as item_type,
      p.name as pet_name,
      ps.name as pet_species_name,
      ps.image as pet_species_image,
      p.level as pet_level,
      us.id as user_spirit_id,
      s.name as spirit_name,
      s.image_url as spirit_image,
      s.rarity as spirit_rarity,
      COALESCE(NULLIF(TRIM(up.display_name), ''), u.username) as seller_name,
      (SELECT COUNT(*) FROM auction_bids ab0 WHERE ab0.auction_id = a.id) as bid_count,
      (SELECT ab1.bidder_id FROM auction_bids ab1 WHERE ab1.auction_id = a.id ORDER BY ab1.bid_amount DESC LIMIT 1) as highest_bidder_id,
      (
        SELECT COALESCE(NULLIF(TRIM(up2.display_name), ''), u2.username)
        FROM auction_bids ab
        JOIN users u2 ON ab.bidder_id = u2.id
        LEFT JOIN user_profiles up2 ON up2.user_id = u2.id
        WHERE ab.auction_id = a.id
        ORDER BY ab.bid_amount DESC
        LIMIT 1
      ) as highest_bidder_name
      ${extraSelect}
    FROM auctions a
    LEFT JOIN items i ON i.id = a.asset_ref_id AND a.asset_type = 'item'
    LEFT JOIN pets p ON p.id = a.asset_ref_id AND a.asset_type = 'pet'
    LEFT JOIN pet_species ps ON ps.id = p.pet_species_id
    LEFT JOIN user_spirits us ON us.id = a.asset_ref_id AND a.asset_type = 'spirit'
    LEFT JOIN spirits s ON s.id = us.spirit_id
    JOIN users u ON a.seller_id = u.id
    LEFT JOIN user_profiles up ON up.user_id = u.id
  `;
}

// Phiên đấu giá của tôi: đang bán + đang đặt giá (chỉ phiên còn hiệu lực)
router.get('/me', auth, async (req, res) => {
  try {
    await settleDueAuctions();
    const uid = req.user.id;

    const [selling] = await db.query(
      `${sqlAuctionCardFrom()}
       WHERE a.seller_id = ? AND a.status = 'active' AND a.end_time > NOW()
       ORDER BY a.end_time ASC`,
      [uid]
    );

    const [bidding] = await db.query(
      `${sqlAuctionCardFrom(
        `, (SELECT MAX(mxb.bid_amount) FROM auction_bids mxb WHERE mxb.auction_id = a.id AND mxb.bidder_id = ?) AS my_max_bid`
      )}
       WHERE a.status = 'active' AND a.end_time > NOW()
         AND a.seller_id <> ?
         AND EXISTS (SELECT 1 FROM auction_bids ex WHERE ex.auction_id = a.id AND ex.bidder_id = ?)
       ORDER BY a.end_time ASC`,
      [uid, uid, uid]
    );

    res.json({ selling, bidding });
  } catch (error) {
    console.error('GET /api/auctions/me:', error);
    res.status(500).json({ message: 'Error fetching my auctions' });
  }
});

// Get auction by ID with bid history
router.get('/:id', async (req, res) => {
  try {
    await settleDueAuctions();
    const auctionId = req.params.id;
    
    const [auction] = await db.query(`
      SELECT 
        a.*,
        i.name as item_name,
        i.description as item_description,
        i.image_url as item_image,
        i.rarity as item_rarity,
        i.type as item_type,
        p.name as pet_name,
        ps.name as pet_species_name,
        ps.image as pet_species_image,
        p.level as pet_level,
        us.id as user_spirit_id,
        s.name as spirit_name,
        s.image_url as spirit_image,
        s.rarity as spirit_rarity,
        COALESCE(NULLIF(TRIM(up.display_name), ''), u.username) as seller_name,
        (SELECT COUNT(*) FROM auction_bids ab WHERE ab.auction_id = a.id) as bid_count
      FROM auctions a
      LEFT JOIN items i ON i.id = a.asset_ref_id AND a.asset_type = 'item'
      LEFT JOIN pets p ON p.id = a.asset_ref_id AND a.asset_type = 'pet'
      LEFT JOIN pet_species ps ON ps.id = p.pet_species_id
      LEFT JOIN user_spirits us ON us.id = a.asset_ref_id AND a.asset_type = 'spirit'
      LEFT JOIN spirits s ON s.id = us.spirit_id
      JOIN users u ON a.seller_id = u.id
      LEFT JOIN user_profiles up ON up.user_id = u.id
      WHERE a.id = ?
    `, [auctionId]);
    
    if (auction.length === 0) {
      return res.status(404).json({ message: 'Auction not found' });
    }
    
    // Get bid history
    const [bids] = await db.query(`
      SELECT 
        ab.bid_amount,
        ab.bid_time,
        COALESCE(NULLIF(TRIM(up.display_name), ''), u.username) as bidder_name
      FROM auction_bids ab
      JOIN users u ON ab.bidder_id = u.id
      LEFT JOIN user_profiles up ON up.user_id = u.id
      WHERE ab.auction_id = ?
      ORDER BY ab.bid_amount DESC, ab.bid_time DESC
    `, [auctionId]);
    
    res.json({
      auction: auction[0],
      bids
    });
  } catch (error) {
    console.error('Error fetching auction:', error);
    res.status(500).json({ message: 'Error fetching auction' });
  }
});

// Create new auction
router.post('/', auth, async (req, res) => {
  const {
    asset_type = 'item',
    inventory_id,
    pet_id,
    user_spirit_id,
    currency_type,
    currency_amount,
    bid_currency,
    starting_price,
    buy_now_price,
    min_increment,
    duration_hours,
  } = req.body;

  const seller_id = req.user.id;
  const aType = ['item', 'pet', 'spirit', 'currency'].includes(String(asset_type)) ? String(asset_type) : 'item';
  const bidCur = String(bid_currency || 'peta').toLowerCase() === 'petagold' ? 'petagold' : 'peta';

  if (starting_price == null || starting_price === '' || duration_hours == null || duration_hours === '') {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  const starting_price_i = Math.floor(Number(starting_price));
  const min_increment_i = Math.floor(Number(min_increment));
  const buy_now_price_i =
    buy_now_price != null && buy_now_price !== '' && String(buy_now_price).trim() !== ''
      ? Math.floor(Number(buy_now_price))
      : null;
  const duration_hours_n = Number(duration_hours);

  if (
    !Number.isFinite(starting_price_i) ||
    starting_price_i < 1 ||
    !Number.isFinite(min_increment_i) ||
    min_increment_i < 1
  ) {
    return res.status(400).json({
      message: 'Starting price and minimum increment must be positive integers (1, 2, 3...)',
    });
  }
  if (
    buy_now_price_i != null &&
    (!Number.isFinite(buy_now_price_i) || buy_now_price_i <= starting_price_i)
  ) {
    return res.status(400).json({
      message: 'Buy now price must be a positive integer higher than starting price',
    });
  }
  if (!Number.isFinite(duration_hours_n) || duration_hours_n < 0.5 || duration_hours_n > 168) {
    return res.status(400).json({ message: 'Duration must be between 0.5 and 168 hours' });
  }

  let conn;
  try {
    await ensureAuctionMultiAssetSchema();
    conn = await db.getConnection();
    await conn.beginTransaction();

    let assetRefId = null;
    let assetCurrency = null;
    let assetQuantity = 1;
    let resolvedInventoryId = null;

    if (aType === 'item') {
      const invId = parseInt(inventory_id, 10);
      if (!Number.isFinite(invId) || invId < 1) {
        await conn.rollback();
        return res.status(400).json({ message: 'Missing or invalid inventory_id' });
      }
      const [invRows] = await conn.query(
        `SELECT inv.id, inv.item_id, inv.quantity, inv.player_id, inv.is_equipped, inv.durability_left,
                it.type AS item_type,
                ed.durability_max, ed.durability_mode
         FROM inventory inv
         JOIN items it ON it.id = inv.item_id
         LEFT JOIN equipment_data ed ON ed.item_id = it.id
         WHERE inv.id = ? AND inv.player_id = ? AND inv.quantity > 0
         LIMIT 1`,
        [invId, seller_id]
      );
      if (!invRows.length) {
        await conn.rollback();
        return res.status(400).json({ message: 'Inventory row not found or not yours' });
      }
      if (Number(invRows[0].is_equipped) === 1) {
        await conn.rollback();
        return res.status(400).json({ message: 'Cannot auction an equipped item' });
      }
      if (!isInventoryRowEligibleForEquipmentAuction(invRows[0])) {
        await conn.rollback();
        return res.status(400).json({
          message: 'Trang bị chỉ được đem đấu giá khi còn độ bền tối đa (trừ đồ vĩnh cửu / không bền).',
        });
      }
      assetRefId = parseInt(invRows[0].item_id, 10);
      resolvedInventoryId = invId;
    } else if (aType === 'pet') {
      const pid = parseInt(pet_id, 10);
      if (!Number.isFinite(pid) || pid < 1) {
        await conn.rollback();
        return res.status(400).json({ message: 'Missing or invalid pet_id' });
      }
      assetRefId = pid;
      const [petRows] = await conn.query(
        'SELECT id FROM pets WHERE id = ? AND owner_id = ? AND (is_listed = 0 OR is_listed IS NULL)',
        [assetRefId, seller_id]
      );
      if (!petRows.length) {
        await conn.rollback();
        return res.status(400).json({ message: 'Pet not found, not yours, or already listed' });
      }
      const [eqRows] = await conn.query(
        `SELECT
           (SELECT COUNT(*) FROM user_spirits us WHERE us.equipped_pet_id = ? AND us.is_equipped = 1) AS spirit_n,
           (SELECT COUNT(*) FROM inventory i WHERE i.equipped_pet_id = ? AND i.is_equipped = 1) AS item_n`,
        [assetRefId, assetRefId]
      );
      const eq = eqRows[0] || { spirit_n: 0, item_n: 0 };
      if (Number(eq.spirit_n) > 0 || Number(eq.item_n) > 0) {
        await conn.rollback();
        return res.status(400).json({
          message: 'Pet phải tháo hết linh thú và vật phẩm trang bị trước khi đem đấu giá.',
        });
      }
    } else if (aType === 'spirit') {
      const sid = parseInt(user_spirit_id, 10);
      if (!Number.isFinite(sid) || sid < 1) {
        await conn.rollback();
        return res.status(400).json({ message: 'Missing or invalid user_spirit_id' });
      }
      assetRefId = sid;
      const [spRows] = await conn.query(
        `SELECT id, equipped_pet_id, is_equipped FROM user_spirits
         WHERE id = ? AND user_id = ? AND (is_listed = 0 OR is_listed IS NULL)`,
        [assetRefId, seller_id]
      );
      if (!spRows.length) {
        await conn.rollback();
        return res.status(400).json({ message: 'Spirit not found, not yours, or already listed' });
      }
      const sp = spRows[0];
      const spiritStillEquipped =
        (sp.equipped_pet_id != null && Number(sp.equipped_pet_id) > 0) || Number(sp.is_equipped) === 1;
      if (spiritStillEquipped) {
        await conn.rollback();
        return res.status(400).json({
          message: 'Linh thú phải gỡ khỏi toàn bộ pet (không trang bị) trước khi đem đấu giá.',
        });
      }
    } else if (aType === 'currency') {
      assetCurrency = String(currency_type || '').toLowerCase() === 'petagold' ? 'petagold' : 'peta';
      assetQuantity = parseInt(currency_amount, 10);
      if (!Number.isFinite(assetQuantity) || assetQuantity < 1) {
        await conn.rollback();
        return res.status(400).json({ message: 'Invalid currency_amount' });
      }
      await deductCurrencyForAuction(seller_id, assetQuantity, assetCurrency, conn);
    }

    const end_time = new Date(Date.now() + duration_hours_n * 60 * 60 * 1000);

    const [result] = await conn.query(
      `
        INSERT INTO auctions (
          asset_type, asset_ref_id, asset_currency, asset_quantity, bid_currency,
          item_id, seller_id, starting_price, current_bid, buy_now_price, min_increment, end_time
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        aType,
        assetRefId,
        assetCurrency,
        assetQuantity,
        bidCur,
        aType === 'item' ? assetRefId : null,
        seller_id,
        starting_price_i,
        starting_price_i,
        buy_now_price_i,
        min_increment_i,
        end_time,
      ]
    );

    if (aType === 'item') {
      await conn.query(
        'UPDATE inventory SET quantity = quantity - 1 WHERE id = ? AND player_id = ? AND quantity >= 1',
        [resolvedInventoryId, seller_id]
      );
      const [left] = await conn.query('SELECT quantity FROM inventory WHERE id = ?', [resolvedInventoryId]);
      if (left.length && Number(left[0].quantity) <= 0) {
        await conn.query('DELETE FROM inventory WHERE id = ?', [resolvedInventoryId]);
      }
    } else if (aType === 'pet') {
      await conn.query('UPDATE pets SET is_listed = 1 WHERE id = ? AND owner_id = ?', [assetRefId, seller_id]);
    } else if (aType === 'spirit') {
      await conn.query('UPDATE user_spirits SET is_listed = 1 WHERE id = ? AND user_id = ?', [assetRefId, seller_id]);
    }

    await conn.commit();
    res.json({
      message: 'Auction created successfully',
      auction_id: result.insertId,
    });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (_) {}
    }
    console.error('Error creating auction:', error);
    res.status(500).json({
      message: 'Error creating auction',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined,
    });
  } finally {
    if (conn) conn.release();
  }
});

// Place bid
router.post('/:id/bid', auth, async (req, res) => {
  try {
    await settleDueAuctions();
    const { bid_amount } = req.body;
    const bidder_id = req.user.id;
    const auction_id = req.params.id;
    
    if (!bid_amount || bid_amount < 1 || !Number.isInteger(bid_amount)) {
      return res.status(400).json({ message: 'Bid amount must be a positive integer (1, 2, 3...)' });
    }
    
    // Get auction details
    const [auction] = await db.query(
      'SELECT * FROM auctions WHERE id = ? AND status = "active"',
      [auction_id]
    );
    
    if (auction.length === 0) {
      return res.status(404).json({ message: 'Auction not found or not active' });
    }
    
    const auctionData = auction[0];
    
    // Check if auction has ended
    if (new Date(auctionData.end_time) <= new Date()) {
      return res.status(400).json({ message: 'Auction has ended' });
    }
    
    // Check if user is not the seller
    if (auctionData.seller_id === bidder_id) {
      return res.status(400).json({ message: 'Cannot bid on your own auction' });
    }
    
    // Check minimum bid
    const min_bid = Math.ceil(Number(auctionData.current_bid) + Number(auctionData.min_increment));
    if (bid_amount < min_bid) {
      return res.status(400).json({ message: `Minimum bid is ${min_bid}` });
    }
    
    const bidCur = String(auctionData.bid_currency || 'peta').toLowerCase() === 'petagold' ? 'petagold' : 'peta';
    const [user] = await db.query('SELECT peta, petagold FROM users WHERE id = ?', [bidder_id]);
    const balance = Math.floor(bidCur === 'petagold' ? (user[0].petagold || 0) : (user[0].peta || 0));
    if (balance < bid_amount) {
      return res.status(400).json({ message: `Insufficient ${bidCur}` });
    }
    
    // Start transaction
    await db.query('START TRANSACTION');

    let outbidMailPayload = null;

    try {
      console.log(`Bid attempt: User ${bidder_id} bidding ${bid_amount} on auction ${auction_id}`);
      
      // Deduct currency from bidder (auction uses bid_currency)
      const deduction = await deductCurrencyForAuction(bidder_id, bid_amount, bidCur);
      console.log(`Currency deducted:`, deduction);
      
      // Refund previous highest bidder (exclude current bidder)
      const [previousBid] = await db.query(
        'SELECT bidder_id, bid_amount FROM auction_bids WHERE auction_id = ? AND bidder_id != ? ORDER BY bid_amount DESC LIMIT 1',
        [auction_id, bidder_id]
      );
      
      if (previousBid.length > 0) {
        const refundAmt = Math.floor(Number(previousBid[0].bid_amount));
        console.log(`Refunding User ${previousBid[0].bidder_id}: ${refundAmt} ${bidCur}`);
        if (refundAmt > 0) {
          await addCurrencyForAuction(previousBid[0].bidder_id, refundAmt, 'refund', bidCur);
          outbidMailPayload = {
            prevBidderId: Number(previousBid[0].bidder_id),
            refundAmt,
          };
        }
      } else {
        console.log('No previous bidder to refund');
      }
      
      // Add new bid
      await db.query(
        'INSERT INTO auction_bids (auction_id, bidder_id, bid_amount) VALUES (?, ?, ?)',
        [auction_id, bidder_id, bid_amount]
      );
      console.log('New bid added to database');
      
      // Update auction current bid
      await db.query(
        'UPDATE auctions SET current_bid = ? WHERE id = ?',
        [bid_amount, auction_id]
      );
      console.log('Auction current bid updated');
      
      await db.query('COMMIT');
      console.log('Transaction committed successfully');

      if (outbidMailPayload) {
        try {
          const itemName = await getBuyerMailAssetDisplayName(auctionData, db);
          const curLabel = bidCur === 'petagold' ? 'PetaGold' : 'Peta';
          const numLoc = String(AUCTION_MAIL_LOCALE).toLowerCase() === 'en' ? 'en-US' : 'vi-VN';
          const mail = await buildAuctionMail(db, 'outbid_refund', AUCTION_MAIL_LOCALE, {
            item_name: itemName,
            refund_fmt: outbidMailPayload.refundAmt.toLocaleString(numLoc),
            currency_label: curLabel,
            new_bid_fmt: Math.floor(Number(bid_amount)).toLocaleString(numLoc),
          });
          await insertAuctionSystemMail(db, {
            userId: outbidMailPayload.prevBidderId,
            subject: mail.subject,
            message: mail.message,
          });
        } catch (mailErr) {
          console.error('Outbid refund mail:', mailErr);
        }
      }

      res.json({ message: 'Bid placed successfully' });
    } catch (error) {
      console.error('Transaction error:', error);
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error placing bid:', error);
    res.status(500).json({ message: 'Error placing bid' });
  }
});

// Buy now
router.post('/:id/buy-now', auth, async (req, res) => {
  try {
    await settleDueAuctions();
    const buyer_id = req.user.id;
    const auction_id = req.params.id;

    const [auctionPre] = await db.query(
      'SELECT * FROM auctions WHERE id = ? AND status = "active"',
      [auction_id]
    );

    if (auctionPre.length === 0) {
      return res.status(404).json({ message: 'Auction not found or not active' });
    }

    const auctionData = auctionPre[0];

    if (!auctionData.buy_now_price) {
      return res.status(400).json({ message: 'Buy now not available for this auction' });
    }

    if (auctionData.seller_id === buyer_id) {
      return res.status(400).json({ message: 'Cannot buy your own auction' });
    }

    const bidCur = String(auctionData.bid_currency || 'peta').toLowerCase() === 'petagold' ? 'petagold' : 'peta';
    const buyNowPrice = Math.floor(Number(auctionData.buy_now_price));
    if (!Number.isFinite(buyNowPrice) || buyNowPrice < 1) {
      return res.status(400).json({ message: 'Invalid buy now price' });
    }

    const [user] = await db.query('SELECT peta, petagold FROM users WHERE id = ?', [buyer_id]);
    const balance = Math.floor(bidCur === 'petagold' ? (user[0].petagold || 0) : (user[0].peta || 0));
    if (balance < buyNowPrice) {
      return res.status(400).json({ message: `Insufficient ${bidCur}` });
    }

    const curLabel = bidCur === 'petagold' ? 'PetaGold' : 'Peta';

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [auction] = await conn.query(
        'SELECT * FROM auctions WHERE id = ? AND status = "active" FOR UPDATE',
        [auction_id]
      );
      if (!auction.length) {
        await conn.rollback();
        return res.status(404).json({ message: 'Auction not found or not active' });
      }
      const a = auction[0];

      await deductCurrencyForAuction(buyer_id, buyNowPrice, bidCur, conn);

      const [bids] = await conn.query(
        'SELECT bidder_id, bid_amount FROM auction_bids WHERE auction_id = ?',
        [auction_id]
      );

      /** Tổng hoàn theo người chơi (chỉ gửi thư cho người khác người mua ngay). */
      const refundTotalsByBidder = new Map();
      for (const bid of bids) {
        const refundAmt = Math.floor(Number(bid.bid_amount));
        if (refundAmt > 0) {
          await addCurrencyForAuction(bid.bidder_id, refundAmt, 'refund', bidCur, conn);
          const bidderId = Number(bid.bidder_id);
          if (Number.isFinite(bidderId) && bidderId !== Number(buyer_id)) {
            refundTotalsByBidder.set(bidderId, (refundTotalsByBidder.get(bidderId) || 0) + refundAmt);
          }
        }
      }

      await transferAuctionPetSpiritFromSeller(conn, a, buyer_id);

      const itemName = await getBuyerMailAssetDisplayName(a, conn);
      const numLoc = String(AUCTION_MAIL_LOCALE).toLowerCase() === 'en' ? 'en-US' : 'vi-VN';
      const sellerMail = await buildAuctionMail(conn, 'buy_now_seller', AUCTION_MAIL_LOCALE, {
        item_name: itemName,
        amount_fmt: buyNowPrice.toLocaleString(numLoc),
        currency_label: curLabel,
      });
      await insertAuctionSystemMail(conn, {
        userId: a.seller_id,
        subject: sellerMail.subject,
        message: sellerMail.message,
        attachedRewards: currencyMailAttachment(bidCur, buyNowPrice),
      });

      const buyerMail = await buildAuctionMail(conn, 'buy_now_buyer', AUCTION_MAIL_LOCALE, {
        item_name: itemName,
        amount_fmt: buyNowPrice.toLocaleString(numLoc),
        currency_label: curLabel,
      });
      await insertAuctionSystemMail(conn, {
        userId: buyer_id,
        subject: buyerMail.subject,
        message: buyerMail.message,
        attachedRewards: buildBuyerAuctionMailAttachmentRewards(a),
      });

      for (const [loserId, totalRefund] of refundTotalsByBidder) {
        if (!Number.isFinite(loserId) || loserId <= 0 || totalRefund <= 0) continue;
        try {
          const loserMail = await buildAuctionMail(conn, 'buy_now_refund_bidder', AUCTION_MAIL_LOCALE, {
            item_name: itemName,
            refund_fmt: totalRefund.toLocaleString(numLoc),
            currency_label: curLabel,
            buy_now_fmt: buyNowPrice.toLocaleString(numLoc),
          });
          await insertAuctionSystemMail(conn, {
            userId: loserId,
            subject: loserMail.subject,
            message: loserMail.message,
          });
        } catch (mailErr) {
          console.error('Buy-now refund bidder mail:', mailErr);
        }
      }

      await conn.query('UPDATE auctions SET status = "ended" WHERE id = ?', [auction_id]);

      await conn.commit();

      await appendAuctionAdminLog({
        event: 'auction_buy_now',
        auction_id: Number(auction_id),
        seller_id: a.seller_id,
        buyer_id,
        amount: buyNowPrice,
        currency: bidCur,
        asset_type: a.asset_type || 'item',
      });

      return res.json({ message: 'Item purchased successfully' });
    } catch (inner) {
      try {
        await conn.rollback();
      } catch (_) {}
      console.error('Buy-now transaction:', inner);
      return res.status(500).json({ message: 'Error purchasing item' });
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('Error purchasing item:', error);
    res.status(500).json({ message: 'Error purchasing item' });
  }
});

// Get user's auctions
router.get('/user/:userId', auth, async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Check if user is requesting their own auctions or is admin
    if (req.user.id !== parseInt(userId) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const [auctions] = await db.query(`
      SELECT 
        a.*,
        i.name as item_name,
        i.image_url as item_image,
        i.rarity as item_rarity,
        i.type as item_type,
        (SELECT COUNT(*) FROM auction_bids ab WHERE ab.auction_id = a.id) as bid_count
      FROM auctions a
      JOIN items i ON a.item_id = i.id
      WHERE a.seller_id = ?
      ORDER BY a.created_at DESC
    `, [userId]);
    
    res.json(auctions);
  } catch (error) {
    console.error('Error fetching user auctions:', error);
    res.status(500).json({ message: 'Error fetching user auctions' });
  }
});

module.exports = router;
