const express = require('express');
const router = express.Router();
const db = require('../config/database');
const auth = require('../middleware/auth');

// Helper function to deduct currency for auctions (use Gold only)
const deductCurrencyForAuction = async (userId, amount) => {
  console.log(`deductCurrencyForAuction: User ${userId}, Amount ${amount}`);
  
  const [user] = await db.query('SELECT peta, petagold FROM users WHERE id = ?', [userId]);
  console.log(`User balance before: Peta ${user[0].peta}, PetaGold ${user[0].petagold}`);
  
  // Check if user has enough peta
  if (user[0].peta < amount) {
    throw new Error('Insufficient peta for auction bid');
  }
  
  // Deduct only from peta
  await db.query('UPDATE users SET peta = peta - ? WHERE id = ?', [amount, userId]);
  console.log(`Updated Peta: -${amount}`);
  
  return { petaDeduction: amount, petagoldDeduction: 0 };
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
const addCurrencyForAuction = async (userId, amount) => {
  console.log(`addCurrencyForAuction: User ${userId}, Amount ${amount}`);
  await db.query('UPDATE users SET peta = peta + ? WHERE id = ?', [amount, userId]);
  console.log(`Added ${amount} to User ${userId} Peta`);
};

// Get all active auctions with pagination and search
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search = '', 
      sortBy = 'end_time', 
      order = 'ASC',
      seller_id = null 
    } = req.query;
    
    const offset = (page - 1) * limit;
    const validSortFields = ['end_time', 'current_bid', 'starting_price', 'created_at'];
    const validOrders = ['ASC', 'DESC'];
    
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'end_time';
    const sortOrder = validOrders.includes(order.toUpperCase()) ? order.toUpperCase() : 'ASC';
    
    let query = `
      SELECT 
        a.id,
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
        u.username as seller_name,
        (SELECT COUNT(*) FROM auction_bids ab WHERE ab.auction_id = a.id) as bid_count,
        (SELECT ab.bidder_id FROM auction_bids ab WHERE ab.auction_id = a.id ORDER BY ab.bid_amount DESC LIMIT 1) as highest_bidder_id,
        (SELECT u2.username FROM auction_bids ab JOIN users u2 ON ab.bidder_id = u2.id WHERE ab.auction_id = a.id ORDER BY ab.bid_amount DESC LIMIT 1) as highest_bidder_name
      FROM auctions a
      JOIN items i ON a.item_id = i.id
      JOIN users u ON a.seller_id = u.id
      WHERE a.status = 'active' AND a.end_time > NOW()
    `;
    
    const queryParams = [];
    
    if (search) {
      query += ` AND i.name LIKE ?`;
      queryParams.push(`%${search}%`);
    }
    
    if (seller_id) {
      query += ` AND a.seller_id = ?`;
      queryParams.push(seller_id);
    }
    
    query += ` ORDER BY a.${sortField} ${sortOrder} LIMIT ? OFFSET ?`;
    queryParams.push(parseInt(limit), parseInt(offset));
    
    const [auctions] = await db.query(query, queryParams);
    
    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM auctions a
      JOIN items i ON a.item_id = i.id
      WHERE a.status = 'active' AND a.end_time > NOW()
    `;
    
    const countParams = [];
    if (search) {
      countQuery += ` AND i.name LIKE ?`;
      countParams.push(`%${search}%`);
    }
    
    if (seller_id) {
      countQuery += ` AND a.seller_id = ?`;
      countParams.push(seller_id);
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

// Get auction by ID with bid history
router.get('/:id', async (req, res) => {
  try {
    const auctionId = req.params.id;
    
    const [auction] = await db.query(`
      SELECT 
        a.*,
        i.name as item_name,
        i.description as item_description,
        i.image_url as item_image,
        i.rarity as item_rarity,
        i.type as item_type,
        u.username as seller_name,
        (SELECT COUNT(*) FROM auction_bids ab WHERE ab.auction_id = a.id) as bid_count
      FROM auctions a
      JOIN items i ON a.item_id = i.id
      JOIN users u ON a.seller_id = u.id
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
        u.username as bidder_name
      FROM auction_bids ab
      JOIN users u ON ab.bidder_id = u.id
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
  try {
    const { 
      item_id, 
      starting_price, 
      buy_now_price, 
      min_increment, 
      duration_hours 
    } = req.body;
    
    const seller_id = req.user.id;
    
    // Validate input
    if (!item_id || !starting_price || !duration_hours) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    if (starting_price < 1 || min_increment < 1 || !Number.isInteger(starting_price) || !Number.isInteger(min_increment)) {
      return res.status(400).json({ message: 'Starting price and minimum increment must be positive integers (1, 2, 3...)' });
    }
    
    if (buy_now_price && (buy_now_price <= starting_price || !Number.isInteger(buy_now_price))) {
      return res.status(400).json({ message: 'Buy now price must be a positive integer higher than starting price' });
    }
    
    if (duration_hours < 0.5 || duration_hours > 168) { // 0.5 hours to 1 week
      return res.status(400).json({ message: 'Duration must be between 0.5 and 168 hours' });
    }
    
    // Check if user owns the item
    const [userItem] = await db.query(
      'SELECT * FROM user_items WHERE user_id = ? AND item_id = ? AND quantity > 0',
      [seller_id, item_id]
    );
    
    if (userItem.length === 0) {
      return res.status(400).json({ message: 'You do not own this item or have insufficient quantity' });
    }
    
    // Calculate end time
    const end_time = new Date(Date.now() + duration_hours * 60 * 60 * 1000);
    
    // Start transaction
    await db.query('START TRANSACTION');
    
    try {
      // Create auction
      const [result] = await db.query(`
        INSERT INTO auctions (item_id, seller_id, starting_price, current_bid, buy_now_price, min_increment, end_time) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [item_id, seller_id, starting_price, starting_price, buy_now_price, min_increment, end_time]);
      
      // Remove item from user's inventory
      await db.query(
        'UPDATE user_items SET quantity = quantity - 1 WHERE user_id = ? AND item_id = ?',
        [seller_id, item_id]
      );
      
      await db.query('COMMIT');
      res.json({ 
        message: 'Auction created successfully', 
        auction_id: result.insertId 
      });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error creating auction:', error);
    res.status(500).json({ message: 'Error creating auction' });
  }
});

// Place bid
router.post('/:id/bid', auth, async (req, res) => {
  try {
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
    const min_bid = auctionData.current_bid + auctionData.min_increment;
    if (bid_amount < min_bid) {
      return res.status(400).json({ message: `Minimum bid is ${min_bid}` });
    }
    
    // Check user has enough gold/peta
    const [user] = await db.query('SELECT peta, petagold FROM users WHERE id = ?', [bidder_id]);
    if (user[0].peta < bid_amount) {
      return res.status(400).json({ message: 'Insufficient peta' });
    }
    
    // Start transaction
    await db.query('START TRANSACTION');
    
    try {
      console.log(`Bid attempt: User ${bidder_id} bidding ${bid_amount} on auction ${auction_id}`);
      
      // Deduct currency from bidder (use Gold only for auctions)
      const deduction = await deductCurrencyForAuction(bidder_id, bid_amount);
      console.log(`Currency deducted:`, deduction);
      
      // Refund previous highest bidder (exclude current bidder)
      const [previousBid] = await db.query(
        'SELECT bidder_id, bid_amount FROM auction_bids WHERE auction_id = ? AND bidder_id != ? ORDER BY bid_amount DESC LIMIT 1',
        [auction_id, bidder_id]
      );
      
      if (previousBid.length > 0) {
        console.log(`Refunding User ${previousBid[0].bidder_id}: ${previousBid[0].bid_amount} peta`);
        await addCurrencyForAuction(previousBid[0].bidder_id, previousBid[0].bid_amount);
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
    const buyer_id = req.user.id;
    const auction_id = req.params.id;
    
    // Get auction details
    const [auction] = await db.query(
      'SELECT * FROM auctions WHERE id = ? AND status = "active"',
      [auction_id]
    );
    
    if (auction.length === 0) {
      return res.status(404).json({ message: 'Auction not found or not active' });
    }
    
    const auctionData = auction[0];
    
    if (!auctionData.buy_now_price) {
      return res.status(400).json({ message: 'Buy now not available for this auction' });
    }
    
    // Check if user is not the seller
    if (auctionData.seller_id === buyer_id) {
      return res.status(400).json({ message: 'Cannot buy your own auction' });
    }
    
    // Check user has enough peta (auctions use Peta only)
    const [user] = await db.query('SELECT peta FROM users WHERE id = ?', [buyer_id]);
    if (user[0].peta < auctionData.buy_now_price) {
      return res.status(400).json({ message: 'Insufficient peta' });
    }
    
    // Start transaction
    await db.query('START TRANSACTION');
    
    try {
      // Deduct currency from buyer (use Gold only for auctions)
      await deductCurrencyForAuction(buyer_id, auctionData.buy_now_price);
      
      // Refund all bidders (refund to Gold)
      const [bids] = await db.query(
        'SELECT bidder_id, bid_amount FROM auction_bids WHERE auction_id = ?',
        [auction_id]
      );
      
      for (const bid of bids) {
        await addCurrencyForAuction(bid.bidder_id, bid.bid_amount);
      }
      
      // Give currency to seller (add to Gold)
      await addCurrencyForAuction(auctionData.seller_id, auctionData.buy_now_price);
      
      // Give item to buyer
      await db.query(
        'INSERT INTO user_items (user_id, item_id, quantity) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE quantity = quantity + 1',
        [buyer_id, auctionData.item_id]
      );
      
      // End auction
      await db.query('UPDATE auctions SET status = "ended" WHERE id = ?', [auction_id]);
      
      await db.query('COMMIT');
      res.json({ message: 'Item purchased successfully' });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
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
