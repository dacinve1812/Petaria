const {
  randomFactor,
  isCriticalHit,
  isDodged,
  calculateDamage,
  simulateTurn,
  simulateFullBattle,
  simulateDefendTurn,
  getBossAction,
  simulateBossTurn,
} = require('./battleEngine');


function generateIVStats() {
  return {
    iv_hp: Math.floor(Math.random() * 32),
    iv_mp: Math.floor(Math.random() * 32),
    iv_str: Math.floor(Math.random() * 32),
    iv_def: Math.floor(Math.random() * 32),
    iv_intelligence: Math.floor(Math.random() * 32),
    iv_spd: Math.floor(Math.random() * 32)
  };
}

function calculateFinalStats(base, iv, level) {
  const getStat = (b, i) => Math.floor(((2 * b + i) * level) / 100) + 5;
  const getHP = (b, i) => (Math.floor(((2 * b + i) * level) / 100) + level + 10) * 5;

  return {
    hp: getHP(base.hp, iv.iv_hp),
    mp: getStat(base.mp, iv.iv_mp),
    str: getStat(base.str, iv.iv_str),
    def: getStat(base.def, iv.iv_def),
    intelligence: getStat(base.intelligence, iv.iv_intelligence),
    spd: getStat(base.spd, iv.iv_spd),
  };
}

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { createClient } = require('redis');

const app = express();
const port = 5000; // Chọn cổng cho backend


const mysql = require('mysql2'); // Hoặc const { Pool } = require('pg');

const pool = mysql.createPool({ // Hoặc const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'petaria',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const db = pool.promise();

// Redis client cho Arena Match State (optional)
// Quản lý RAM: mỗi SET match phải có TTL; khi kết thúc trận (finalize) hoặc terminate phải DEL key ngay.
let redisClient = null;
const REDIS_MATCH_TTL = parseInt(process.env.REDIS_MATCH_TTL, 10) || 1800; // 30 phút mặc định (env: REDIS_MATCH_TTL)
const REDIS_MATCH_PREFIX = 'match:';

async function initRedis() {
  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  try {
    redisClient = createClient({ url });
    redisClient.on('error', (err) => console.error('Redis error:', err));
    await redisClient.connect();
    console.log('Redis connected');
  } catch (e) {
    console.warn('Redis not available:', e.message);
  }
}

function getRedis() {
  return redisClient;
}

// Kiểm tra kết nối
pool.getConnection((err, connection) => {
  if (err) {
    console.error('Database connection failed: ', err);
  } else {
    console.log('Database connected successfully');
    connection.release();
  }
});

app.use(cors());
app.use(bodyParser.json());

// Import auction routes
const auctionRoutes = require('./routes/auctions');
app.use('/api/auctions', auctionRoutes);

// User Items API (for auction system)
app.get('/api/user/items', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const userId = decoded.userId;

    const [items] = await db.query(`
      SELECT ui.id, ui.quantity, i.name, i.description, i.image_url, i.rarity, i.type
      FROM user_items ui
      JOIN items i ON ui.item_id = i.id
      WHERE ui.user_id = ? 
        AND ui.quantity > 0
        AND ui.item_id NOT IN (
          SELECT DISTINCT item_id 
          FROM auctions 
          WHERE seller_id = ? AND status = 'active'
        )
      ORDER BY i.name
    `, [userId, userId]);

    res.json({ items });
  } catch (error) {
    console.error('Error fetching user items:', error);
    res.status(500).json({ message: 'Error fetching user items' });
  }
});

// Thêm multer để xử lý upload ảnh (khai báo và khởi tạo trước khi sử dụng)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/images');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  },
});
const upload = multer({ storage: storage });
const uploadMemory = multer({ storage: multer.memoryStorage() });

// API endpoints sẽ được thêm vào đây

// Site Configuration API Endpoints
app.get('/api/site-config/pages', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM site_pages ORDER BY created_at ASC');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching site pages:', error);
    res.status(500).json({ error: 'Failed to fetch site pages' });
  }
});

app.get('/api/site-config/pages/:path', async (req, res) => {
  try {
    const { path } = req.params;
    const [rows] = await db.query('SELECT * FROM site_pages WHERE path = ?', [path]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Page not found' });
    }
    
    const page = rows[0];
    
    // Lấy custom elements cho trang này
    const [elementRows] = await db.query(
      'SELECT * FROM site_custom_elements WHERE page_id = ? ORDER BY sort_order ASC',
      [page.id]
    );
    
    res.json({
      ...page,
      customElements: elementRows
    });
  } catch (error) {
    console.error('Error fetching page config:', error);
    res.status(500).json({ error: 'Failed to fetch page config' });
  }
});

app.post('/api/site-config/pages', async (req, res) => {
  try {

    const { id, path, name, component, config } = req.body;
    
    const [result] = await db.query(
      `INSERT INTO site_pages (id, path, name, component, config) 
       VALUES (?, ?, ?, ?, ?) 
       ON DUPLICATE KEY UPDATE 
       name = VALUES(name), 
       component = VALUES(component), 
       config = VALUES(config),
       updated_at = CURRENT_TIMESTAMP`,
      [id, path, name, component, JSON.stringify(config)]
    );
    
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error saving page config:', error);
    res.status(500).json({ error: 'Failed to save page config' });
  }
});

app.post('/api/site-config/elements', async (req, res) => {
  try {
    const { pageId, elements } = req.body;
    
    // Xóa elements cũ
    await db.query('DELETE FROM site_custom_elements WHERE page_id = ?', [pageId]);
    
    // Thêm elements mới
    if (elements && elements.length > 0) {
      const values = elements.map((element, index) => [
        element.id,
        pageId,
        element.type,
        element.content || null,
        element.imageSrc || null,
        element.imageAlt || null,
        JSON.stringify(element.styles),
        index
      ]);
      
      await db.query(
        `INSERT INTO site_custom_elements 
         (id, page_id, element_type, content, image_src, image_alt, styles, sort_order) 
         VALUES ?`,
        [values]
      );
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving custom elements:', error);
    res.status(500).json({ error: 'Failed to save custom elements' });
  }
});

app.get('/api/site-config/saved-configs', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT sc.*, sp.name as page_name 
      FROM site_saved_configs sc
      JOIN site_pages sp ON sc.page_id = sp.id
      ORDER BY sc.created_at DESC
    `);
    
    // Parse JSON fields
    const parsedRows = rows.map(row => ({
      ...row,
      config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config,
      customElements: typeof row.custom_elements === 'string' ? JSON.parse(row.custom_elements) : row.custom_elements
    }));
    
    res.json(parsedRows);
  } catch (error) {
    console.error('Error fetching saved configs:', error);
    res.status(500).json({ error: 'Failed to fetch saved configs' });
  }
});

app.post('/api/site-config/saved-configs', async (req, res) => {
  try {

    const { id, name, pageId, config, customElements } = req.body;
    
    const [result] = await db.query(
      `INSERT INTO site_saved_configs (id, name, page_id, config, custom_elements, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE 
       name = VALUES(name),
       page_id = VALUES(page_id),
       config = VALUES(config),
       custom_elements = VALUES(custom_elements)`,
      [id, name, pageId, JSON.stringify(config), JSON.stringify(customElements)]
    );
    
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error saving config:', error);
    res.status(500).json({ error: 'Failed to save config' });
  }
});

app.delete('/api/site-config/saved-configs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM site_saved_configs WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting saved config:', error);
    res.status(500).json({ error: 'Failed to delete saved config' });
  }
});

// Navbar Configuration API Endpoints
app.get('/api/site-config/navbar', async (req, res) => {
  try {
    const query = 'SELECT config FROM site_navbar_config ORDER BY id DESC LIMIT 1';
    const [rows] = await db.execute(query);
    
    if (rows.length > 0) {
      const config = typeof rows[0].config === 'string' 
        ? JSON.parse(rows[0].config) 
        : rows[0].config;
      res.json(config);
    } else {
      // Return default configuration if no config exists
      const defaultNavbarConfig = {
        bottomNavbar: {
          visible: true,
          showMenuOnly: false
        },
        floatingButtons: {
          visible: true
        }
      };
      res.json(defaultNavbarConfig);
    }
  } catch (error) {
    console.error('Error fetching navbar config:', error);
    res.status(500).json({ error: 'Failed to fetch navbar config' });
  }
});

app.post('/api/site-config/navbar', async (req, res) => {
  try {
    const config = req.body;
    
    // Insert or update navbar configuration
    const query = `
      INSERT INTO site_navbar_config (config) 
      VALUES (?) 
      ON DUPLICATE KEY UPDATE 
      config = VALUES(config),
      updated_at = CURRENT_TIMESTAMP
    `;
    
    await db.execute(query, [JSON.stringify(config)]);
    
    console.log('Navbar config updated:', config);
    res.json({ message: 'Navbar config updated successfully' });
  } catch (error) {
    console.error('Error updating navbar config:', error);
    res.status(500).json({ error: 'Failed to update navbar config' });
  }
});

// ======================================================== BANK SYSTEM ========================================================

// GET /api/bank/account/:userId - Lấy thông tin tài khoản ngân hàng
app.get('/api/bank/account/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    // Lấy thông tin tài khoản ngân hàng
    const [accountRows] = await db.query(`
      SELECT * FROM bank_accounts WHERE user_id = ?
    `, [userId]);

    if (!accountRows.length) {
      return res.status(404).json({ error: 'Chưa có tài khoản ngân hàng' });
    }

    const account = accountRows[0];

    // Tự động cộng lãi suất hàng ngày (compound interest)
    await calculateAndAddDailyInterest(userId, account);

    // Lấy lại thông tin tài khoản sau khi cộng lãi
    const [updatedAccountRows] = await db.query(`
      SELECT ba.*, u.is_vip,
              bir_peta.interest_rate as petagold_interest_rate
      FROM bank_accounts ba
      JOIN users u ON ba.user_id = u.id
      LEFT JOIN bank_interest_rates bir_peta ON bir_peta.currency_type = 'petagold' AND bir_peta.is_active = TRUE
      WHERE ba.user_id = ?
    `, [userId]);

    const updatedAccount = updatedAccountRows[0];

    res.json({
      ...updatedAccount,
      interest_collected_today: true // Luôn true vì lãi được tự động cộng
    });
  } catch (err) {
    console.error('Lỗi khi lấy thông tin tài khoản ngân hàng:', err);
    res.status(500).json({ error: 'Lỗi khi lấy thông tin tài khoản ngân hàng' });
  }
});

// Helper function để tính và cộng lãi suất hàng ngày
async function calculateAndAddDailyInterest(userId, account) {
  const today = new Date().toISOString().split('T')[0];
  
  // Kiểm tra xem đã cộng lãi hôm nay chưa
  const [interestRows] = await db.query(`
    SELECT * FROM bank_interest_logs 
    WHERE user_id = ? AND interest_date = ?
  `, [userId, today]);

  if (interestRows.length > 0) {
    return; // Đã cộng lãi hôm nay rồi
  }

  // Lấy thông tin VIP và lãi suất
  const [userRows] = await db.query(`
    SELECT is_vip FROM users WHERE id = ?
  `, [userId]);
  
  const isVip = userRows[0]?.is_vip || false;

  // Tính lãi kép cho Peta
  const petaInterest = (account.peta_balance * (account.interest_rate / 100)) / 365;

  // Tính lãi kép cho PetaGold (chỉ VIP)
  let petagoldInterest = 0;
  if (isVip && account.petagold_balance > 0) {
    const [rateRows] = await db.query(`
      SELECT interest_rate FROM bank_interest_rates 
      WHERE currency_type = 'petagold' AND is_active = TRUE
    `);
    
    if (rateRows.length > 0) {
      const petagoldRate = rateRows[0].interest_rate;
      petagoldInterest = (account.petagold_balance * (petagoldRate / 100)) / 365;
    }
  }

  if (petaInterest <= 0 && petagoldInterest <= 0) {
    return; // Không có lãi để cộng
  }

  // Cộng lãi vào tài khoản ngân hàng
  await db.query(`
    UPDATE bank_accounts 
    SET peta_balance = peta_balance + ?, petagold_balance = petagold_balance + ?
    WHERE user_id = ?
  `, [petaInterest, petagoldInterest, userId]);

  // Ghi log
  await db.query(`
    INSERT INTO bank_interest_logs (user_id, interest_date, peta_interest, petagold_interest)
    VALUES (?, ?, ?, ?)
  `, [userId, today, petaInterest, petagoldInterest]);
}

// POST /api/bank/create-account - Tạo tài khoản ngân hàng
app.post('/api/bank/create-account', async (req, res) => {
  const { userId } = req.body;

  try {
    // Kiểm tra xem đã có tài khoản chưa
    const [existingRows] = await db.query(`
      SELECT id FROM bank_accounts WHERE user_id = ?
    `, [userId]);

    if (existingRows.length > 0) {
      return res.status(400).json({ error: 'Đã có tài khoản ngân hàng' });
    }

    // Tạo tài khoản mới
    await db.query(`
      INSERT INTO bank_accounts (user_id, peta_balance, petagold_balance, interest_rate)
      VALUES (?, 0.00, 0.00, 5.00)
    `, [userId]);

    res.json({ success: true, message: 'Tạo tài khoản ngân hàng thành công' });
  } catch (err) {
    console.error('Lỗi khi tạo tài khoản ngân hàng:', err);
    res.status(500).json({ error: 'Lỗi khi tạo tài khoản ngân hàng' });
  }
});

// Note: collect-interest API removed - interest is now automatically added daily

// POST /api/bank/transaction - Thực hiện giao dịch (gửi/rút tiền)
app.post('/api/bank/transaction', async (req, res) => {
  const { userId, type, amount, currencyType } = req.body;

  try {
    // Validation
    if (!['deposit', 'withdraw'].includes(type)) {
      return res.status(400).json({ error: 'Loại giao dịch không hợp lệ' });
    }

    if (!['peta', 'petagold'].includes(currencyType)) {
      return res.status(400).json({ error: 'Loại tiền không hợp lệ' });
    }

    if (!amount || amount <= 0 || !Number.isInteger(amount)) {
      return res.status(400).json({ error: 'Số tiền không hợp lệ' });
    }

    // Lấy thông tin tài khoản ngân hàng
    const [accountRows] = await db.query(`
      SELECT * FROM bank_accounts WHERE user_id = ?
    `, [userId]);

    if (!accountRows.length) {
      return res.status(404).json({ error: 'Chưa có tài khoản ngân hàng' });
    }

    const account = accountRows[0];

    // Lấy thông tin user
    const [userRows] = await db.query(`
      SELECT peta, petagold FROM users WHERE id = ?
    `, [userId]);

    if (!userRows.length) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }

    const user = userRows[0];

    await db.query('START TRANSACTION');

    if (type === 'deposit') {
      // Gửi tiền vào ngân hàng
      const userBalance = currencyType === 'peta' ? user.peta : user.petagold;
      const bankBalance = currencyType === 'peta' ? account.peta_balance : account.petagold_balance;

      if (amount > userBalance) {
        await db.query('ROLLBACK');
        return res.status(400).json({ error: 'Không đủ tiền để gửi' });
      }

      // Trừ tiền từ user, cộng vào ngân hàng
      await db.query(`
        UPDATE users SET ${currencyType} = ${currencyType} - ? WHERE id = ?
      `, [amount, userId]);

      await db.query(`
        UPDATE bank_accounts SET ${currencyType}_balance = ${currencyType}_balance + ? WHERE user_id = ?
      `, [amount, userId]);

      // Ghi log giao dịch
      await db.query(`
        INSERT INTO bank_transactions (user_id, transaction_type, currency_type, amount, balance_before, balance_after)
        VALUES (?, 'deposit', ?, ?, ?, ?)
      `, [userId, currencyType, amount, bankBalance, bankBalance + amount]);

      res.json({
        success: true,
        message: `Đã gửi ${amount} ${currencyType === 'peta' ? 'Peta' : 'PetaGold'} vào ngân hàng`
      });

    } else if (type === 'withdraw') {
      // Rút tiền từ ngân hàng
      const bankBalance = currencyType === 'peta' ? account.peta_balance : account.petagold_balance;

      if (amount > bankBalance) {
        await db.query('ROLLBACK');
        return res.status(400).json({ error: 'Không đủ tiền trong tài khoản ngân hàng' });
      }

      // Trừ tiền từ ngân hàng, cộng vào user
      await db.query(`
        UPDATE bank_accounts SET ${currencyType}_balance = ${currencyType}_balance - ? WHERE user_id = ?
      `, [amount, userId]);

      await db.query(`
        UPDATE users SET ${currencyType} = ${currencyType} + ? WHERE id = ?
      `, [amount, userId]);

      // Ghi log giao dịch
      await db.query(`
        INSERT INTO bank_transactions (user_id, transaction_type, currency_type, amount, balance_before, balance_after)
        VALUES (?, 'withdraw', ?, ?, ?, ?)
      `, [userId, currencyType, amount, bankBalance, bankBalance - amount]);

      res.json({
        success: true,
        message: `Đã rút ${amount} ${currencyType === 'peta' ? 'Peta' : 'PetaGold'} từ ngân hàng`
      });
    }

    await db.query('COMMIT');
  } catch (err) {
    await db.query('ROLLBACK');
    console.error('Lỗi khi thực hiện giao dịch:', err);
    res.status(500).json({ error: 'Lỗi khi thực hiện giao dịch' });
  }
});

// GET /api/bank/transactions/:userId - Lấy lịch sử giao dịch
app.get('/api/bank/transactions/:userId', async (req, res) => {
  const { userId } = req.params;
  const { page = 1, limit = 20 } = req.query;

  try {
    const offset = (page - 1) * limit;

    const [transactions] = await db.query(`
      SELECT * FROM bank_transactions 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `, [userId, parseInt(limit), parseInt(offset)]);

    const [countRows] = await db.query(`
      SELECT COUNT(*) as total FROM bank_transactions WHERE user_id = ?
    `, [userId]);

    res.json({
      transactions,
      total: countRows[0].total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (err) {
    console.error('Lỗi khi lấy lịch sử giao dịch:', err);
    res.status(500).json({ error: 'Lỗi khi lấy lịch sử giao dịch' });
  }
});

// API Register
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    // Kiểm tra username đã tồn tại hay chưa
    pool.query(
      'SELECT * FROM users WHERE username = ?',
      [username],
      async (err, results) => {
        if (err) {
          console.error('Error checking username: ', err);
          return res.status(500).json({ message: 'Error checking username' });
        }

        if (results.length > 0) {
          // Username đã tồn tại
          return res.status(409).json({ message: 'Username đã được sử dụng' });
        }

        // Username chưa tồn tại, tiếp tục đăng ký
        const hashedPassword = await bcrypt.hash(password, 10); // Mã hóa mật khẩu
        pool.query(
          'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
          [username, hashedPassword, 'user'],
          (insertErr, insertResults) => {
            if (insertErr) {
              console.error('Error registering user: ', insertErr);
              return res.status(500).json({ message: 'Error registering user' });
            } else {
              return res.json({ message: 'Đăng ký thành công' });
            }
          }
        );
      }
    );
  } catch (err) {
    console.error('Error hashing password: ', err);
    return res.status(500).json({ message: 'Error hashing password' });
  }
});

// API Login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  pool.query(
    'SELECT * FROM users WHERE username = ?',
    [username],
    async (err, results) => {
      if (err) {
        console.error('Error logging in: ', err);
        res.status(500).json({ message: 'Error logging in' });
      } else {
        if (results.length > 0) {
          const user = results[0];
          const passwordMatch = await bcrypt.compare(password, user.password); // So sánh mật khẩu
          if (passwordMatch) {
            // Cập nhật online_status
            pool.query(
              'UPDATE users SET online_status = 1 WHERE username = ?',
              [username],
              (updateErr, updateResults) => {
                if (updateErr) {
                  console.error('Error updating online_status:', updateErr);
                  // Xử lý lỗi cập nhật online_status (tùy chọn)
                }

                const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'your-secret-key', {
                  expiresIn: '23h',
                });
                res.json({
                  message: 'User logged in successfully',
                  token: token,
                  hasPet: user.hasPet // Trả về hasPet status
                });
              }
            );
          } else {
            res.status(401).json({ message: 'Tài khoản hoặc mật khẩu không đúng' }); // Hiển thị ở Login page
          }
        } else {
          res.status(401).json({ message: 'Invalid credentials' });
        }
      }
    }
  );
});

// API Refresh Token
app.post('/refresh-token', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    // Verify the token (even if expired, we can still decode it)
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', { ignoreExpiration: true });
    
    // Check if user still exists and is active
    const [users] = await db.query('SELECT id, username, role, hasPet FROM users WHERE id = ?', [decoded.userId]);
    
    if (users.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }

    const user = users[0];
    const isAdmin = user.role === 'admin'; // ✅ Check role từ database
    
    // Generate new token
    const newToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'your-secret-key', {
      expiresIn: '23h',
    });

    res.json({
      message: 'Token refreshed successfully',
      token: newToken,
      isAdmin: isAdmin,
      hasPet: user.hasPet || false
    });
    
  } catch (err) {
    console.error('Error refreshing token:', err);
    res.status(401).json({ message: 'Invalid token' });
  }
});

// API Get User Profile
app.get('/api/user/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    const [users] = await db.query('SELECT id, username, role, hasPet, peta, petagold FROM users WHERE id = ?', [decoded.userId]);
    
    if (users.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }

    const user = users[0];
    
    res.json({
      userId: user.id,
      username: user.username,
      role: user.role,
      isAdmin: user.role === 'admin',
      hasPet: user.hasPet || false,
      peta: user.peta || 0,
      petagold: user.petagold || 0
    });
    
  } catch (err) {
    console.error('Error getting user profile:', err);
    res.status(401).json({ message: 'Invalid token' });
  }
});

// API Lấy Danh Sách Thú Cưng Của Người Dùng
app.get('/users/:userId/pets', (req, res) => {
  const userId = req.params.userId;
  const token = req.headers.authorization?.split(' ')[1]; // Lấy token từ header

  if (!token) {
      return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
      const decodedToken = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key'); // Xác thực token
      const tokenUserId = decodedToken.userId;

      // Kiểm tra xem user có quyền truy cập pets của userId này không
      if (tokenUserId !== parseInt(userId)) {
          return res.status(403).json({ message: 'Forbidden: You can only access your own pets' });
      }

      pool.query(`
        SELECT
          p.id,
          p.uuid,
          p.name,
          ps.name AS species_name,
          ps.image,
          p.level,
          p.current_exp,
          p.current_hp,
          p.hp,
          p.mp,
          p.str,
          p.def,
          p.intelligence,
          p.spd,
          p.final_stats
        FROM pets p
        JOIN pet_species ps ON p.pet_species_id = ps.id
        WHERE p.owner_id = ?
      `, [userId], (err, results) => {
        if (err) {
          console.error('Error fetching user pets: ', err);
          res.status(500).json({ message: 'Error fetching user pets' });
        } else {
          res.json(results);
        }
      });
  } catch (err) {
      console.error('Error verifying token: ', err);
      return res.status(401).json({ message: 'Invalid token' });
  }
});


/********************************************************************************************************************
*
ADMIN API
*

********************************************************************************************************************/

// API Get Pets (Admin) -> Suy nghĩ sau
app.get('/api/admin/pets', async (req, res) => {
  try {
    const [results] = await pool.promise().query(
      `SELECT 
        p.uuid, p.name, p.level, 
        ps.name AS species_name,
        u.username AS owner_name,
        p.iv_hp, p.iv_mp, p.iv_str, p.iv_def, p.iv_intelligence, p.iv_spd
       FROM pets p
       LEFT JOIN pet_species ps ON p.pet_species_id = ps.id
       LEFT JOIN users u ON p.owner_id = u.id
       ORDER BY p.created_date DESC`
    );

    res.json(results);
  } catch (err) {
    console.error('Error fetching all pets for admin:', err);
    res.status(500).json({ message: 'Server error fetching pets' });
  }
});

// API Create Pet Species (Admin)
app.post('/api/admin/pet-species', (req, res) => {
  const {
    name, image, type, description, rarity,
    base_hp, base_mp, base_str, base_def, base_intelligence, base_spd,
    evolve_to
  } = req.body;

  const sql = `
    INSERT INTO pet_species
    (name, image, type, description, rarity,
     base_hp, base_mp, base_str, base_def, base_intelligence, base_spd, evolve_to)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    name, image, type, description, rarity,
    base_hp, base_mp, base_str, base_def, base_intelligence, base_spd,
    evolve_to ? JSON.stringify(evolve_to) : null
  ];

  pool.query(sql, values, (err, results) => {
    if (err) {
      console.error('Error creating pet species:', err);
      res.status(500).json({ message: 'Error creating pet species' });
    } else {
      res.json({ message: 'Pet species created successfully', speciesId: results.insertId });
    }
  });
});

// API Get Pet Types (Admin)
app.get('/api/admin/pet-species', (req, res) => {
  pool.query('SELECT * FROM pet_species', (err, results) => {
    if (err) {
      console.error('Error fetching pet species: ', err);
      res.status(500).json({ message: 'Error fetching pet species' });
    } else {
      res.json(results);
    }
  });
});

// API Delete Pet Type (Admin)
app.delete('/api/admin/pet-species/:id', (req, res) => {
  const id = req.params.id;

  pool.query('DELETE FROM pet_species WHERE id = ?', [id], (err, results) => {
    if (err) {
      console.error('Error deleting pet species:', err);
      res.status(500).json({ message: 'Error deleting pet species' });
    } else {
      res.json({ message: 'Pet species deleted successfully' });
    }
  });
});

// API Update Pet Type (Admin)
app.put('/api/admin/pet-species/:id', (req, res) => {
  const id = req.params.id;
  const {
    name, image, type, description, rarity,
    base_hp, base_mp, base_str, base_def, base_intelligence, base_spd,
    evolve_to
  } = req.body;

  const sql = `
    UPDATE pet_species SET
      name = ?, image = ?, type = ?, description = ?, rarity = ?,
      base_hp = ?, base_mp = ?, base_str = ?, base_def = ?, base_intelligence = ?, base_spd = ?,
      evolve_to = ?
    WHERE id = ?
  `;

  const values = [
    name, image, type, description, rarity,
    base_hp, base_mp, base_str, base_def, base_intelligence, base_spd,
    evolve_to ? JSON.stringify(evolve_to) : null,
    id
  ];

  pool.query(sql, values, (err, results) => {
    if (err) {
      console.error('Error updating pet species:', err);
      res.status(500).json({ message: 'Error updating pet species' });
    } else {
      res.json({ message: 'Pet species updated successfully' });
    }
  });
});

// Pet species - download CSV (admin)
app.get('/api/admin/pet-species/csv', (req, res) => {
  pool.query('SELECT * FROM pet_species ORDER BY id', (err, results) => {
    if (err) {
      console.error('Error fetching pet species for CSV:', err);
      return res.status(500).json({ message: 'Error fetching pet species' });
    }
    const rows = results || [];
    const headers = ['id', 'name', 'image', 'type', 'description', 'rarity', 'base_hp', 'base_mp', 'base_str', 'base_def', 'base_intelligence', 'base_spd', 'evolve_to', 'created_at'];
    const escape = (v) => {
      if (v == null) return '';
      const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=pet_species.csv');
    res.send('\uFEFF' + csv);
  });
});

// Pet species - upload CSV (admin): UPDATE when id exists, else INSERT
app.post('/api/admin/pet-species/csv', uploadMemory.single('file'), (req, res) => {
  if (!req.file || !req.file.buffer) return res.status(400).json({ message: 'Thiếu file CSV' });
  const text = req.file.buffer.toString('utf8');
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return res.status(400).json({ message: 'CSV trống hoặc thiếu header' });
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
  const required = ['name', 'image'];
  if (!required.every(k => headers.includes(k))) return res.status(400).json({ message: 'CSV thiếu cột: name, image' });
  const num = (v, d) => (v !== '' && v != null && !isNaN(Number(v)) ? parseInt(v, 10) : d);
  let updated = 0, inserted = 0;
  const next = (idx) => {
    if (idx >= lines.length - 1) return res.json({ success: true, updated, inserted });
    const line = lines[idx + 1];
    const values = [];
    let cur = '', inQuoted = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQuoted = !inQuoted; continue; }
      if (!inQuoted && c === ',') { values.push(cur.trim()); cur = ''; continue; }
      cur += c;
    }
    values.push(cur.trim());
    const o = {};
    headers.forEach((h, i) => { o[h] = values[i]; });
    const idRaw = o.id != null && String(o.id).trim() !== '' ? parseInt(o.id, 10) : null;
    const id = (idRaw != null && !isNaN(idRaw)) ? idRaw : null;
    const evolveTo = (o.evolve_to != null && String(o.evolve_to).trim() !== '') ? String(o.evolve_to).trim() : null;
    const vals = [
      o.name ?? '', o.image ?? '', o.type ?? '', o.description ?? '', o.rarity ?? '',
      num(o.base_hp, 0), num(o.base_mp, 0), num(o.base_str, 0), num(o.base_def, 0),
      num(o.base_intelligence, 0), num(o.base_spd, 0), evolveTo
    ];
    if (id == null) {
      pool.query(
        'INSERT INTO pet_species (name, image, type, description, rarity, base_hp, base_mp, base_str, base_def, base_intelligence, base_spd, evolve_to) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        vals,
        (err2) => {
          if (err2) return res.status(500).json({ message: 'Lỗi thêm mới' });
          inserted++;
          next(idx + 1);
        }
      );
      return;
    }
    pool.query('SELECT 1 FROM pet_species WHERE id = ? LIMIT 1', [id], (err1, ex) => {
      if (err1) return res.status(500).json({ message: 'Lỗi kiểm tra id' });
      const doUpdate = ex && ex.length > 0;
      if (doUpdate) {
        pool.query(
          'UPDATE pet_species SET name=?, image=?, type=?, description=?, rarity=?, base_hp=?, base_mp=?, base_str=?, base_def=?, base_intelligence=?, base_spd=?, evolve_to=? WHERE id=?',
          [...vals, id],
          (err2) => {
            if (err2) return res.status(500).json({ message: 'Lỗi cập nhật' });
            updated++;
            next(idx + 1);
          }
        );
      } else {
        pool.query(
          'INSERT INTO pet_species (name, image, type, description, rarity, base_hp, base_mp, base_str, base_def, base_intelligence, base_spd, evolve_to) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          vals,
          (err2) => {
            if (err2) return res.status(500).json({ message: 'Lỗi thêm mới' });
            inserted++;
            next(idx + 1);
          }
        );
      }
    });
  };
  next(0);
});

// API Lấy Thông Tin Chi Tiết Thú Cưng Theo ID/UUID
app.get('/api/pets/:uuid', (req, res) => {
  const uuid = req.params.uuid;
  pool.query(`
      SELECT p.*, pt.name AS pet_types_name, pt.image
      FROM pets p
      JOIN pet_species pt ON p.pet_species_id = pt.id
      WHERE p.uuid = ?
  `, [uuid], (err, results) => {
      if (err) {
          console.error('Error fetching pet details: ', err);
          res.status(500).json({ message: 'Error fetching pet details' });
      } else {
          if (results.length > 0) {
              res.json(results[0]);
          } else {
              res.status(404).json({ message: 'Pet not found' });
          }
      }
  });
});

// API Delete Pet
app.delete('/api/admin/pets/:uuid', (req, res) => {
  const uuid = req.params.uuid;
  pool.query('DELETE FROM pets WHERE uuid = ?', [uuid], (err, results) => {
      if (err) {
          console.error('Error deleting pet: ', err);
          return res.status(500).json({ message: 'Error deleting pet' });
      } else if (results.affectedRows > 0) {
          res.json({ message: 'Pet deleted successfully' });
      } else {
          res.status(404).json({ message: 'Pet not found' });
      }
  });
});

// API Delete Pet (User)
app.delete('/api/pets/:uuid/release', (req, res) => {
  const uuid = req.params.uuid;
  const token = req.headers.authorization?.split(' ')[1]; // Lấy token từ header

  if (!token) {
      return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
      const decodedToken = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key'); // Xác thực token
      const userId = decodedToken.userId;

      // Kiểm tra xem thú cưng có thuộc sở hữu của người dùng này không
      pool.query('SELECT owner_id FROM pets WHERE uuid = ?', [uuid], (err, results) => {
          if (err) {
              console.error('Error checking pet ownership: ', err);
              return res.status(500).json({ message: 'Error checking pet ownership' });
          }

          if (results.length === 0) {
              return res.status(404).json({ message: 'Pet not found' });
          }

          const petOwnerId = results[0].owner_id;

          if (petOwnerId !== userId) {
              return res.status(403).json({ message: 'You do not own this pet' });
          }

          // Nếu là chủ sở hữu, tiến hành xóa (phóng thích)
          pool.query('DELETE FROM pets WHERE uuid = ?', [uuid], async (deleteErr, deleteResults) => {
              if (deleteErr) {
                  console.error('Error releasing pet: ', deleteErr);
                  return res.status(500).json({ message: 'Error releasing pet' });
              } else if (deleteResults.affectedRows > 0) {
                  // Check if user still has any pets after releasing this one
                  try {
                      const [remainingPets] = await pool.promise().query(
                          'SELECT COUNT(*) as count FROM pets WHERE owner_id = ?',
                          [userId]
                      );
                      
                      // Update hasPet status to FALSE if user has no pets left
                      if (remainingPets[0].count === 0) {
                          await pool.promise().query(
                              'UPDATE users SET hasPet = FALSE WHERE id = ?',
                              [userId]
                          );
                      }
                  } catch (updateErr) {
                      console.error('Error updating hasPet status:', updateErr);
                      // Don't fail the release operation if hasPet update fails
                  }
                  
                  res.json({ message: 'Pet released successfully' });
              } else {
                  res.status(404).json({ message: 'Pet not found (during deletion)' }); // Trường hợp hiếm
              }
          });
      });
  } catch (err) {
      console.error('Error verifying token: ', err);
      return res.status(401).json({ message: 'Invalid token' });
  }
});

// API Get Orphanage Pets (Rarity Common, Level 1) 

let orphanagePets = [];
app.get('/api/orphanage-pets', async (req, res) => {
  const level = 1;

  try {
    const [results] = await pool.promise().query(
      `SELECT id, name, image, type, rarity,
              base_hp AS hp, base_mp AS mp, base_str AS str,
              base_def AS def, base_intelligence AS intelligence, base_spd AS spd
       FROM pet_species WHERE rarity = 'Common'`
    );

    if (results.length === 0) {
      return res.status(404).json({ message: 'No common pets found' });
    }

    orphanagePets = [];
    for (let i = 0; i < 4; i++) {
      const petSpecies = results[Math.floor(Math.random() * results.length)];
      const iv = generateIVStats();
      const finalStats = calculateFinalStats({
        hp: petSpecies.hp,
        mp: petSpecies.mp,
        str: petSpecies.str,
        def: petSpecies.def,
        intelligence: petSpecies.intelligence,
        spd: petSpecies.spd
      }, iv, level);

      orphanagePets.push({
        tempId: uuidv4(),
        pet_species_id: petSpecies.id,
        name: petSpecies.name,
        image: petSpecies.image,
        type: petSpecies.type,
        rarity: petSpecies.rarity,
        level,
        ...iv,
        ...finalStats
      });
    }

    res.json(orphanagePets);
  } catch (err) {
    console.error('Error fetching orphanage pets:', err);
    res.status(500).json({ message: 'Server error while fetching pets' });
  }
});

app.post('/api/adopt-pet', async (req, res) => {
  const { tempId, owner_id, petName } = req.body;
  const token = req.headers.authorization?.split(' ')[1]; // Lấy token từ header

  if (!token) {
      return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
      const decodedToken = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key'); // Xác thực token
      const tokenUserId = decodedToken.userId;

      // Kiểm tra xem user có quyền adopt pet cho owner_id này không
      if (tokenUserId !== parseInt(owner_id)) {
          return res.status(403).json({ message: 'Forbidden: You can only adopt pets for yourself' });
      }

      const tempPet = orphanagePets.find(pet => pet.tempId === tempId);
      if (!tempPet) return res.status(400).json({ message: 'Invalid temporary pet ID' });

  const {
    pet_species_id, iv_hp, iv_mp, iv_str, iv_def,
    iv_intelligence, iv_spd, hp, mp, str, def, intelligence, spd
  } = tempPet;

  const petUuid = uuidv4();
  const level = 1;
  const createdDate = new Date();
  const max_hp = hp;
  const max_mp = mp;
  const finalStats = { hp, mp, str, def, intelligence, spd };

  try {
    const [speciesResult] = await pool.promise().query(
      'SELECT type FROM pet_species WHERE id = ?',
      [pet_species_id]
    );

    if (speciesResult.length === 0) {
      return res.status(400).json({ message: 'Invalid pet species ID' });
    }

    const type = speciesResult[0].type;

    await pool.promise().query(
      `INSERT INTO pets (
        uuid, name, hp, str, def, intelligence, spd, mp,
        owner_id, pet_species_id, level, max_hp, max_mp,
        created_date, final_stats,
        iv_hp, iv_mp, iv_str, iv_def, iv_intelligence, iv_spd
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        petUuid, petName, hp, str, def, intelligence, spd, mp,
        owner_id, pet_species_id, level, max_hp, max_mp,
        createdDate, JSON.stringify(finalStats),
        iv_hp, iv_mp, iv_str, iv_def, iv_intelligence, iv_spd
      ]
    );

    // Update user's hasPet status to TRUE when they adopt their first pet
    await pool.promise().query(
      'UPDATE users SET hasPet = TRUE WHERE id = ? AND hasPet = FALSE',
      [owner_id]
    );

    orphanagePets = orphanagePets.filter(pet => pet.tempId !== tempId);
    res.json({ message: 'Pet adopted successfully', uuid: petUuid });
  } catch (error) {
    console.error('Error adopting pet:', error);
    res.status(500).json({ message: 'Error adopting pet' });
  }
  } catch (err) {
      console.error('Error verifying token: ', err);
      return res.status(401).json({ message: 'Invalid token' });
  }
});



// API Get User Info
app.get('/users/:userId', (req, res) => {
  const userId = parseInt(req.params.userId); // Parse to integer

  if (isNaN(userId)) {
    res.status(400).json({ message: 'Invalid user ID' });
    return;
  }

  pool.query('SELECT username, peta, petagold, real_name, guild, title, ranking, online_status, birthday, role FROM users WHERE id = ?', [userId], (err, results) => {
    if (err) {
      console.error('Error fetching user info: ', err);
      res.status(500).json({ message: 'Error fetching user info' });
      return;
    }

    if (results.length === 0) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.json(results[0]);
  });
});

// API: Get user role
app.get('/api/users/:userId/role', (req, res) => {
  const userId = parseInt(req.params.userId);

  if (isNaN(userId)) {
    res.status(400).json({ message: 'Invalid user ID' });
    return;
  }

  pool.query('SELECT id, username, role FROM users WHERE id = ?', [userId], (err, results) => {
    if (err) {
      console.error('Error fetching user role: ', err);
      res.status(500).json({ message: 'Error fetching user role' });
      return;
    }

    if (results.length === 0) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.json({
      id: results[0].id,
      username: results[0].username,
      role: results[0].role
    });
  });
});

// API: Update user role (admin only)
app.put('/api/users/:userId/role', (req, res) => {
  const userId = parseInt(req.params.userId);
  const { role } = req.body;
  const { adminUserId } = req.body; // ID của admin thực hiện thay đổi

  if (isNaN(userId)) {
    res.status(400).json({ message: 'Invalid user ID' });
    return;
  }

  // Validate role
  const validRoles = ['user', 'admin', 'moderator'];
  if (!validRoles.includes(role)) {
    res.status(400).json({ message: 'Invalid role' });
    return;
  }

  // Check if adminUserId is admin
  pool.query('SELECT role FROM users WHERE id = ?', [adminUserId], (err, results) => {
    if (err) {
      console.error('Error checking admin role: ', err);
      res.status(500).json({ message: 'Error checking admin role' });
      return;
    }

    if (results.length === 0 || results[0].role !== 'admin') {
      res.status(403).json({ message: 'Only admins can change user roles' });
      return;
    }

    // Update user role
    pool.query('UPDATE users SET role = ? WHERE id = ?', [role, userId], (updateErr, updateResults) => {
      if (updateErr) {
        console.error('Error updating user role: ', updateErr);
        res.status(500).json({ message: 'Error updating user role' });
        return;
      }

      if (updateResults.affectedRows === 0) {
        res.status(404).json({ message: 'User not found' });
        return;
      }

      res.json({ 
        message: 'User role updated successfully',
        userId,
        newRole: role
      });
    });
  });
});

// API: Admin tạo pet thủ công
// API: Admin tạo pet thủ công (không cần owner_id và không cần type)
const expTable = require('../src/data/exp_table_petaria.json');

app.post('/api/admin/pets', async (req, res) => {
  let {
    name, pet_species_id, level = 1,
    iv_hp, iv_mp, iv_str, iv_def, iv_intelligence, iv_spd
  } = req.body;
  try {
    const [speciesResult] = await pool.promise().query(
      `SELECT base_hp AS hp, base_mp AS mp, base_str AS str, base_def AS def,
              base_intelligence AS intelligence, base_spd AS spd
       FROM pet_species WHERE id = ?`, [pet_species_id]
    );

    if (speciesResult.length === 0) {
      return res.status(400).json({ message: 'Invalid pet species ID' });
    }
    const base = speciesResult[0];
    base.hp = parseInt(base.hp);
    base.mp = parseInt(base.mp);
    base.str = parseInt(base.str);
    base.def = parseInt(base.def);
    base.intelligence = parseInt(base.intelligence);
    base.spd = parseInt(base.spd);
    level = parseInt(level || '1');
    const iv = {
      iv_hp: parseInt(iv_hp),
      iv_mp: parseInt(iv_mp),
      iv_str: parseInt(iv_str),
      iv_def: parseInt(iv_def),
      iv_intelligence: parseInt(iv_intelligence),
      iv_spd: parseInt(iv_spd)
    };

    // console.log('BASE STATS:', base, 'IV:', iv, 'LEVEL:', level);
    const final = calculateFinalStats(base, iv, level);
    // console.log('FINAL STATS:', final);
    const createdDate = new Date();
    const petUuid = uuidv4();
    const currentExp = expTable[level] || 0;

    await pool.promise().query(
      `INSERT INTO pets (
        uuid, name, hp, str, def, intelligence, spd, mp,
        pet_species_id, level, max_hp, max_mp,
        created_date, final_stats, current_exp,
        iv_hp, iv_mp, iv_str, iv_def, iv_intelligence, iv_spd
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      petUuid, name, final.hp, final.str, final.def, final.intelligence, final.spd, final.mp,
      pet_species_id, level, final.hp, final.mp,
      createdDate, JSON.stringify(final), currentExp,
      iv.iv_hp, iv.iv_mp, iv.iv_str, iv.iv_def, iv.iv_intelligence, iv.iv_spd,
      0, expToNext,
      JSON.stringify(stats),
      1
    ]);

    res.json({ message: 'Pet created successfully', uuid: petUuid });
  } catch (err) {
    console.error('Error creating pet manually:', err);
    res.status(500).json({ message: 'Server error when creating pet' });
  }
});

app.delete('/api/admin/pets/:uuid', async (req, res) => {
  const { uuid } = req.params;

  try {
    // Kiểm tra pet có tồn tại và chưa có chủ
    const [result] = await pool.promise().query(
      'SELECT * FROM pets WHERE uuid = ? AND owner_id IS NULL',
      [uuid]
    );

    if (result.length === 0) {
      return res.status(404).json({ message: 'Pet không tồn tại hoặc đã có chủ.' });
    }

    // Xoá pet
    await pool.promise().query('DELETE FROM pets WHERE uuid = ?', [uuid]);
    res.json({ message: 'Pet đã được xoá (admin).' });
  } catch (err) {
    console.error('Error deleting pet by admin:', err);
    res.status(500).json({ message: 'Lỗi server khi xoá pet' });
  }
});


/************************************* ITEMS ********************************************** */

// Admin - Tạo vật phẩm mới
app.post('/api/admin/items', (req, res) => {
  const { name, description, type, rarity, image_url, buy_price, sell_price } = req.body;

  pool.query(
    'INSERT INTO items (name, description, type, rarity, image_url, buy_price, sell_price) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [name, description, type, rarity, image_url, buy_price, sell_price],
    (err, results) => {
      if (err) {
        console.error('Error creating item:', err);
        return res.status(500).json({ message: 'Error creating item' });
      }
      res.json({ message: 'Item created successfully', id: results.insertId });
    }
  );
});

// Admin - Xem toàn bộ vật phẩm
app.get('/api/admin/items', (req, res) => {
  pool.query('SELECT * FROM items', (err, results) => {
    if (err) {
      console.error('Error fetching items:', err);
      return res.status(500).json({ message: 'Error fetching items' });
    }
    res.json(results);
  });
});


//Admin - Edit vật phẩm
app.put('/api/admin/items/:id', (req, res) => {
  const { id } = req.params;
  const { name, description, type, rarity, image_url, buy_price, sell_price } = req.body;

  const sql = `
    UPDATE items
    SET name = ?, description = ?, type = ?, rarity = ?, image_url = ?, buy_price = ?, sell_price = ?
    WHERE id = ?
  `;

  pool.query(sql, [name, description, type, rarity, image_url, buy_price, sell_price, id], (err, results) => {
    if (err) {
      console.error('Error updating item:', err);
      return res.status(500).json({ message: 'Error updating item' });
    }

    res.json({ message: 'Item updated successfully' });
  });
});

//Admin - Delete vật phẩm
app.delete('/api/admin/items/:id', (req, res) => {
  const { id } = req.params;

  pool.query('DELETE FROM items WHERE id = ?', [id], (err, results) => {
    if (err) {
      console.error('Error deleting item:', err);
      return res.status(500).json({ message: 'Error deleting item' });
    }

    res.json({ message: 'Item deleted successfully' });
  });
});

// Lấy toàn bộ equipment_data (schema mới: equipment_type, power_min, power_max, durability_max, magic_value, crit_rate, block_rate, element, effect_id)
app.get('/api/admin/equipment-stats', (req, res) => {
  const sql = `SELECT * FROM equipment_data`;
  pool.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching equipment data:', err);
      return res.status(500).json({ message: 'Error fetching equipment data' });
    }
    res.json(results);
  });
});

app.post('/api/admin/equipment-stats', (req, res) => {
  const {
    item_id,
    equipment_type = 'weapon',
    power_min,
    power_max,
    durability_max,
    magic_value,
    crit_rate,
    block_rate,
    element,
    effect_id,
  } = req.body;
  const sql = `INSERT INTO equipment_data (item_id, equipment_type, power_min, power_max, durability_max, magic_value, crit_rate, block_rate, element, effect_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE
                 equipment_type = VALUES(equipment_type),
                 power_min = VALUES(power_min),
                 power_max = VALUES(power_max),
                 durability_max = VALUES(durability_max),
                 magic_value = VALUES(magic_value),
                 crit_rate = VALUES(crit_rate),
                 block_rate = VALUES(block_rate),
                 element = VALUES(element),
                 effect_id = VALUES(effect_id)`;

  pool.query(
    sql,
    [
      item_id,
      equipment_type,
      power_min ?? null,
      power_max ?? null,
      durability_max ?? null,
      magic_value ?? null,
      crit_rate ?? null,
      block_rate ?? null,
      element ?? null,
      effect_id ?? null,
    ],
    (err, results) => {
      if (err) {
        console.error('Error saving equipment data:', err);
        return res.status(500).json({ message: 'Error saving equipment data' });
      }
      res.json({ message: 'Equipment data saved successfully' });
    }
  );
});

app.put('/api/admin/equipment-stats/:id', (req, res) => {
  const { id } = req.params;
  const {
    item_id,
    equipment_type,
    power_min,
    power_max,
    durability_max,
    magic_value,
    crit_rate,
    block_rate,
    element,
    effect_id,
  } = req.body;

  const sql = `UPDATE equipment_data
               SET item_id = ?, equipment_type = ?, power_min = ?, power_max = ?, durability_max = ?, magic_value = ?, crit_rate = ?, block_rate = ?, element = ?, effect_id = ?
               WHERE id = ?`;

  pool.query(
    sql,
    [
      item_id,
      equipment_type ?? 'weapon',
      power_min ?? null,
      power_max ?? null,
      durability_max ?? null,
      magic_value ?? null,
      crit_rate ?? null,
      block_rate ?? null,
      element ?? null,
      effect_id ?? null,
      id,
    ],
    (err, results) => {
      if (err) {
        console.error('Error updating equipment data:', err);
        return res.status(500).json({ message: 'Error updating equipment data' });
      }
      res.json({ message: 'Equipment data updated successfully' });
    }
  );
});

// get items 
app.get('/api/admin/item-effects', (req, res) => {
  const sql = `SELECT * FROM item_effects`;
  pool.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching item effects:', err);
      return res.status(500).json({ message: 'Error fetching item effects' });
    }
    res.json(results);
  });
});

// Get item effects for a specific item
app.get('/api/item-effects/:itemId', (req, res) => {
  const { itemId } = req.params;
  const sql = `SELECT * FROM item_effects WHERE item_id = ?`;
  pool.query(sql, [itemId], (err, results) => {
    if (err) {
      console.error('Error fetching item effects:', err);
      return res.status(500).json({ message: 'Error fetching item effects' });
    }
    res.json(results);
  });
});

// Get equipment data for a specific item (schema mới: equipment_type, magic_value, durability_max, ...)
app.get('/api/equipment-data/:itemId', (req, res) => {
  const { itemId } = req.params;
  const sql = `SELECT * FROM equipment_data WHERE item_id = ?`;
  pool.query(sql, [itemId], (err, results) => {
    if (err) {
      console.error('Error fetching equipment data:', err);
      return res.status(500).json({ message: 'Error fetching equipment data' });
    }
    if (results.length > 0) {
      res.json(results[0]);
    } else {
      res.status(404).json({ message: 'Equipment data not found' });
    }
  });
});

app.post('/api/admin/item-effects', (req, res) => {
  const {
    item_id, effect_target, effect_type,
    value_min, value_max, is_permanent, duration_turns
  } = req.body;

  const sql = `INSERT INTO item_effects 
    (item_id, effect_target, effect_type, value_min, value_max, is_permanent, duration_turns)
    VALUES (?, ?, ?, ?, ?, ?, ?)`;

  pool.query(sql, [
    item_id, effect_target, effect_type,
    value_min, value_max, is_permanent, duration_turns
  ], (err, results) => {
    if (err) {
      console.error('Error creating item effect:', err);
      return res.status(500).json({ message: 'Error creating item effect' });
    }
    res.json({ message: 'Item effect created successfully' });
  });
});

app.put('/api/admin/item-effects/:id', (req, res) => {
  const { id } = req.params;
  const {
    item_id, effect_target, effect_type,
    value_min, value_max, is_permanent, duration_turns
  } = req.body;

  const sql = `UPDATE item_effects SET 
    item_id = ?, effect_target = ?, effect_type = ?, 
    value_min = ?, value_max = ?, is_permanent = ?, duration_turns = ?
    WHERE id = ?`;

  pool.query(sql, [
    item_id, effect_target, effect_type,
    value_min, value_max, is_permanent, duration_turns, id
  ], (err, results) => {
    if (err) {
      console.error('Error updating item effect:', err);
      return res.status(500).json({ message: 'Error updating item effect' });
    }
    res.json({ message: 'Item effect updated successfully' });
  });
});


/************************************* SHOP ********************************************** */

// 1. API: Lấy danh sách cửa hàng: 
// Dành cho người chơi hoặc admin để hiện danh sách các shop.

app.get('/api/shops', async (req, res) => {
  try {
    const [shops] = await db.query('SELECT * FROM shop_definitions');
    res.json(shops); // shops là mảng kết quả thực tế
  } catch (err) {
    console.error('Lỗi khi query shop_definitions:', err);
    res.status(500).json({ error: 'Lỗi khi lấy danh sách cửa hàng' });
  }
});

// 2. API: Lấy danh sách item của 1 cửa hàng
// Trả về item đang được bán trong shop tương ứng với shop_code
app.get('/api/shop/:shop_code', async (req, res) => {
  const { shop_code } = req.params;

  try {
    const [shopRows] = await db.query(
      'SELECT id FROM shop_definitions WHERE code = ?',
      [shop_code]
    );

    if (!shopRows.length) {
      return res.status(404).json({ error: 'Shop không tồn tại' });
    }

    const shop = shopRows[0];

    const [items] = await db.query(`
      SELECT 
        si.id,
        si.item_id,
        si.shop_id,
        si.custom_price,
        si.currency_type,
        si.stock_limit,
        si.restock_interval,
        si.available_from,
        si.available_until,
        i.name,
        i.description,
        i.type,
        i.rarity,
        i.image_url,
        i.sell_price,
        COALESCE(si.custom_price, i.buy_price) AS price
      FROM shop_items si
      JOIN items i ON si.item_id = i.id
      WHERE si.shop_id = ?
      ORDER BY si.id DESC
    `, [shop.id]);

    res.json(items);
  } catch (err) {
    console.error('Lỗi khi lấy danh sách item trong shop:', err);
    res.status(500).json({ error: 'Lỗi server khi lấy item trong shop' });
  }
});

// 3.API Admin: Thêm item vào shop (bulk)
//Cho phép admin thêm nhiều item vào 1 cửa hàng cùng lúc
app.post('/api/admin/shop-items/bulk-add', async (req, res) => {
  const { shop_id, item_ids, custom_price, currency_type } = req.body;

  if (!shop_id || !Array.isArray(item_ids) || item_ids.length === 0) {
    return res.status(400).json({ error: 'Thiếu thông tin' });
  }

  try {
    const placeholders = item_ids.map(() => '(?, ?, ?, ?)').join(', ');
    const flatValues = item_ids.flatMap(itemId => [shop_id, itemId, custom_price ?? null, currency_type ?? 'peta']);

    const sql = `INSERT INTO shop_items (shop_id, item_id, custom_price, currency_type) VALUES ${placeholders}`;
    await db.query(sql, flatValues);

    res.json({ success: true });
  } catch (err) {
    console.error('Lỗi khi thêm item vào shop:', err);
    res.status(500).json({ error: 'Lỗi khi thêm item vào shop' });
  }
});



// User - Mua item

// POST /api/shop/buy
app.post('/api/shop/buy', async (req, res) => {
  const { shop_code, item_id, user_id, quantity = 1 } = req.body;

  try {
    // 1. Lấy shop ID từ code
    const [shopRows] = await db.query(`SELECT id FROM shop_definitions WHERE code = ?`, [shop_code]);
    if (!shopRows.length) return res.status(404).json({ error: 'Shop không tồn tại' });
    const shop = shopRows[0];

    // 2. Lấy thông tin item trong shop
    const [itemRows] = await db.query(`
    SELECT i.*, si.custom_price, si.currency_type, si.stock_limit
    FROM shop_items si
    JOIN items i ON si.item_id = i.id
    WHERE si.item_id = ? AND si.shop_id = ?
    `, [item_id, shop.id]);
    
    if (!itemRows.length) {
      return res.status(404).json({ error: 'Item không tồn tại trong shop' });
    }
    
    const itemRow = itemRows[0];

    if (itemRow.stock_limit == null || itemRow.stock_limit <= 0) {
      return res.status(400).json({ error: 'Vật phẩm đã hết hàng' });
    }

    const price = itemRow.custom_price ?? itemRow.buy_price;
    const currency = itemRow.currency_type;
    
    if (!currency || !['peta', 'petagold'].includes(currency)) {
      return res.status(400).json({ error: 'Loại tiền không hợp lệ' });
    }

    // 4. Lấy thông tin người dùng
    const [userRow] = await db.query(`SELECT peta, petagold FROM users WHERE id = ?`, [user_id]);
    if (!userRow) return res.status(404).json({ error: 'Người dùng không tồn tại' });

    const totalPrice = price * quantity;
    const userBalance = currency === 'peta' ? userRow.peta : userRow.petagold;
    if (userBalance < totalPrice) return res.status(400).json({ error: 'Không đủ tiền' });

    // 5. Trừ tiền
    await db.query(`UPDATE users SET ${currency} = ${currency} - ? WHERE id = ?`, [totalPrice, user_id]);

    // 6. Thêm item vào inventory
    if (itemRow.type === 'equipment') {
      const [equipInfo] = await db.query(
        'SELECT durability_max FROM equipment_data WHERE item_id = ?',
        [item_id]
      );

      const durability = (equipInfo.length > 0) ? (equipInfo[0].durability_max ?? 1) : 1;

      // Equipment items can only be bought one at a time
      for (let i = 0; i < quantity; i++) {
        await db.query(`
          INSERT INTO inventory (player_id, item_id, quantity, is_equipped, durability_left)
          VALUES (?, ?, 1, 0, ?)
        `, [user_id, item_id, durability]);
      }
    } else {
      const [invRows] = await db.query(`
        SELECT id, quantity FROM inventory
        WHERE player_id = ? AND item_id = ? AND is_equipped = 0
      `, [user_id, item_id]);

      if (invRows.length > 0) {
        const inv = invRows[0];
        await db.query(`UPDATE inventory SET quantity = quantity + ? WHERE id = ?`, [quantity, inv.id]);
      } else {
        await db.query(`
          INSERT INTO inventory (player_id, item_id, quantity)
          VALUES (?, ?, ?)
        `, [user_id, item_id, quantity]);
      }
    }

    // 7. Trừ stock nếu có
    if (itemRow.stock_limit !== null) {
      const result = await db.query(`
        UPDATE shop_items
        SET stock_limit = stock_limit - 1
        WHERE shop_id = ? AND item_id = ? AND stock_limit > 0
      `, [shop.id, item_id]);

      if (result.affectedRows === 0) {
        return res.status(400).json({ error: 'Không thể cập nhật stock (có thể đã hết hàng)' });
      }
    }

    res.json({ success: true, message: 'Mua thành công!' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi máy chủ khi xử lý mua vật phẩm' });
  }
});


// Admin - Cập nhật item trong shop (Edit)
app.put('/api/admin/shop-items/:shop_id/:item_id', async (req, res) => {
  const { shop_id, item_id } = req.params;
  let { custom_price, stock_limit, restock_interval, available_from, available_until } = req.body;

  try {
    // Nếu có ngày giờ, thì mặc định restock = none
    if (available_from || available_until) {
      restock_interval = 'none';
    }

    const sql = `
      UPDATE shop_items
      SET custom_price = ?, stock_limit = ?, restock_interval = ?, available_from = ?, available_until = ?
      WHERE shop_id = ? AND item_id = ?
    `;

    await db.query(sql, [
      custom_price || null,
      stock_limit || null,
      restock_interval || 'none',
      available_from || null,
      available_until || null,
      shop_id,
      item_id
    ]);

    res.json({ success: true });
  } catch (err) {
    console.error('Lỗi khi cập nhật shop item:', err);
    res.status(500).json({ error: 'Lỗi server khi cập nhật item trong shop' });
  }
});

//Admin - Delete items trong shop 
app.delete('/api/admin/shop-items/:shop_id/:item_id', async (req, res) => {
  const { shop_id, item_id } = req.params;

  try {
    const result = await db.query(`
      DELETE FROM shop_items
      WHERE shop_id = ? AND item_id = ?
    `, [shop_id, item_id]);

    if (result[0].affectedRows === 0) {
      return res.status(404).json({ error: 'Không tìm thấy item để xóa' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Lỗi khi xóa item khỏi shop:', err);
    res.status(500).json({ error: 'Lỗi server khi xóa item khỏi shop' });
  }
});


// User - Lấy thông tin items từ Inventory

app.get('/api/users/:userId/inventory', async (req, res) => {
  const { userId } = req.params;

  try {
    const [rows] = await db.query(`
        SELECT i.*, it.name, it.description, it.image_url, it.type, it.rarity, 
               it.sell_price, it.buy_price,
               p.name AS pet_name, p.level AS pet_level,
               ed.equipment_type, ed.magic_value AS power, ed.durability_max AS max_durability
        FROM inventory i
        JOIN items it ON i.item_id = it.id
        LEFT JOIN pets p ON i.equipped_pet_id = p.id
        LEFT JOIN equipment_data ed ON it.id = ed.item_id
        WHERE i.player_id = ?
    `, [userId]);

    res.json(rows);
  } catch (err) {
    console.error('Lỗi khi lấy inventory:', err);
    res.status(500).json({ error: 'Không thể lấy dữ liệu inventory' });
  }
});

// User - Bán ve chai item trong inventory (nhận peta theo items.sell_price)
app.post('/api/inventory/:id/sell', async (req, res) => {
  const { id } = req.params;
  const quantityRaw = req.body?.quantity;
  const quantity = parseInt(quantityRaw, 10);
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return res.status(400).json({ message: 'Số lượng bán không hợp lệ' });
  }

  let conn;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const userId = decoded.userId;

    conn = await db.getConnection();
    await conn.beginTransaction();

    const [invRows] = await conn.query(
      `SELECT i.id, i.player_id, i.quantity, i.is_equipped, it.sell_price, it.name
       FROM inventory i
       JOIN items it ON i.item_id = it.id
       WHERE i.id = ? AND i.player_id = ?
       LIMIT 1`,
      [id, userId]
    );

    if (!invRows.length) {
      await conn.rollback();
      return res.status(404).json({ message: 'Không tìm thấy vật phẩm trong kho' });
    }

    const inv = invRows[0];
    if (Number(inv.is_equipped) === 1) {
      await conn.rollback();
      return res.status(400).json({ message: 'Không thể bán vật phẩm đang trang bị' });
    }
    if (quantity > Number(inv.quantity)) {
      await conn.rollback();
      return res.status(400).json({ message: 'Số lượng bán vượt quá số lượng hiện có' });
    }

    const sellPrice = Number(inv.sell_price) || 0;
    const petaGained = sellPrice * quantity;
    const remain = Number(inv.quantity) - quantity;

    if (remain <= 0) {
      await conn.query('DELETE FROM inventory WHERE id = ?', [id]);
    } else {
      await conn.query('UPDATE inventory SET quantity = ? WHERE id = ?', [remain, id]);
    }

    if (petaGained > 0) {
      await conn.query('UPDATE users SET peta = peta + ? WHERE id = ?', [petaGained, userId]);
    }

    await conn.commit();

    res.json({
      success: true,
      message: `Đã bán ${quantity} ${inv.name || 'vật phẩm'} thành công`,
      peta_gained: petaGained,
      remaining_quantity: remain < 0 ? 0 : remain,
      removed: remain <= 0,
    });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error('Lỗi khi bán vật phẩm:', err);
    res.status(500).json({ message: 'Lỗi server khi bán vật phẩm' });
  } finally {
    if (conn) conn.release();
  }
});

// ======================================================== EQUIP ITEMS ========================================================
//Equip item cho pet
/* Điều kiện:
 Item phải thuộc user
 Item phải là equipment
 Item chưa được trang bị (is_equipped = 0)
 Pet là của user
 Pet chưa đủ 4 item đang gắn
*/ 
app.post('/api/pets/:petId/equip-item', async (req, res) => {
  const { petId } = req.params;
  const { inventory_id } = req.body;
  const maxItemsCanEquip = 4 ;

  try {
    // 1. Kiểm tra inventory item (phải chưa trang bị, không hỏng, còn bền)
    const [invRows] = await pool.promise().query(
      `SELECT i.*, it.type, i.player_id FROM inventory i
       JOIN items it ON i.item_id = it.id
       WHERE i.id = ? AND i.is_equipped = 0`,
      [inventory_id]
    );

    if (invRows.length === 0) {
      return res.status(400).json({ message: 'Item không tồn tại hoặc đã được trang bị' });
    }

    const item = invRows[0];
    if (item.type !== 'equipment') {
      return res.status(400).json({ message: 'Chỉ có thể trang bị item loại equipment' });
    }
    if (item.is_broken === 1 || item.is_broken === true) {
      return res.status(400).json({ message: 'Vật phẩm đã hỏng, không thể trang bị. Hãy sửa chữa trước.' });
    }
    const dur = item.durability_left != null ? parseInt(item.durability_left, 10) : 1;
    if (dur <= 0) {
      return res.status(400).json({ message: 'Vật phẩm đã hết độ bền, không thể trang bị. Hãy sửa chữa trước.' });
    }

    // 2. Kiểm tra pet tồn tại và thuộc cùng user
    const [petRows] = await pool.promise().query(
      'SELECT * FROM pets WHERE id = ? AND owner_id = ?',
      [petId, item.player_id]
    );

    if (petRows.length === 0) {
      return res.status(400).json({ message: 'Pet không tồn tại hoặc không thuộc user' });
    }

    // Pet hết máu thì không cho trang bị (tránh các ràng buộc/trigger liên quan current_hp)
    if ((petRows[0].current_hp ?? 0) <= 0) {
      return res.status(400).json({ message: 'Thú cưng quá mệt mỏi (HP = 0). Hãy cho ăn/nghỉ ngơi để hồi phục trước khi trang bị.' });
    }

    // 3. Kiểm tra số item đã được gắn (kể cả broken — broken vẫn chiếm slot đến khi gỡ)
    const [equippedCount] = await pool.promise().query(
      'SELECT COUNT(*) AS count FROM inventory WHERE equipped_pet_id = ? AND is_equipped = 1',
      [petId]
    );

    if (equippedCount[0].count >= maxItemsCanEquip) {
      return res.status(400).json({ message: 'Pet đã trang bị tối đa 4 item' });
    }

    // 3.5. Chuẩn hóa current_hp của pet (tránh vi phạm chk_current_hp_valid khi trigger/constraint kiểm tra)
    const pet = petRows[0];
    let maxHp = pet.max_hp != null ? Number(pet.max_hp) : null;
    if (pet.final_stats) {
      try {
        const fs = typeof pet.final_stats === 'string' ? JSON.parse(pet.final_stats) : pet.final_stats;
        if (fs && fs.hp != null) maxHp = Number(fs.hp);
      } catch (_) {}
    }
    const maxHpVal = maxHp != null && maxHp > 0 ? maxHp : 1;
    const curHp = pet.current_hp != null ? Number(pet.current_hp) : maxHpVal;
    const validHp = Math.max(0, Math.min(curHp, maxHpVal));
    await pool.promise().query(
      'UPDATE pets SET current_hp = ? WHERE id = ?',
      [validHp, petId]
    );

    // 4. Cập nhật inventory
    await pool.promise().query(
      'UPDATE inventory SET is_equipped = 1, equipped_pet_id = ? WHERE id = ?',
      [petId, inventory_id]
    );

    res.json({ message: 'Trang bị thành công' });

  } catch (err) {
    console.error('Lỗi khi trang bị item:', err);
    res.status(500).json({ message: 'Lỗi server khi trang bị item' });
  }
});

// API: Lấy danh sách item đã được trang bị cho pet với power và durability từ equipment_data
app.get('/api/pets/:petId/equipment', async (req, res) => {
  const { petId } = req.params;
  try {
    const [rows] = await pool.promise().query(
      `SELECT i.id, i.item_id, it.name AS item_name, it.image_url, it.description, it.type, it.rarity,
              i.durability_left,
              ed.equipment_type, ed.magic_value AS power, ed.power_min, ed.power_max,
              ed.durability_max AS max_durability, i.is_broken
       FROM inventory i
       JOIN items it ON i.item_id = it.id
       LEFT JOIN equipment_data ed ON it.id = ed.item_id
       WHERE i.equipped_pet_id = ? AND i.is_equipped = 1`,
      [petId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching equipped items for pet:', err);
    res.status(500).json({ message: 'Lỗi khi lấy danh sách item đã trang bị' });
  }
});

// API: Gỡ tất cả item broken/hết bền khỏi pet (sau trận Arena)
app.post('/api/pets/:petId/unequip-broken', async (req, res) => {
  // Repair/broken system removed: items are destroyed at durability 0.
  res.status(410).json({ message: 'Repair system removed. Broken equipment is destroyed automatically.' });
});

// API: Gỡ item khỏi pet (unequip)
app.post('/api/inventory/:id/unequip', async (req, res) => {
  const { id } = req.params;

  try {
    // Kiểm tra item tồn tại và đang được trang bị
    const [rows] = await db.query(
      'SELECT * FROM inventory WHERE id = ? AND is_equipped = 1',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Item không tồn tại hoặc chưa được trang bị' });
    }

    // Cập nhật trạng thái: tháo khỏi pet
    await db.query(
      'UPDATE inventory SET is_equipped = 0, equipped_pet_id = NULL WHERE id = ?',
      [id]
    );

    res.json({ message: 'Đã gỡ item khỏi pet thành công' });
  } catch (err) {
    console.error('Lỗi khi gỡ item:', err);
    res.status(500).json({ message: 'Lỗi server khi gỡ item' });
  }
});

// API: Cập nhật durability của equipment khi sử dụng trong battle
app.post('/api/inventory/:id/use-durability', async (req, res) => {
  const { id } = req.params;
  const { amount = 1 } = req.body;

  try {
    // Giảm durability. Nếu về 0 thì tháo khỏi pet + xóa khỏi inventory luôn.
    const [result] = await pool.promise().query(
      'UPDATE inventory SET durability_left = GREATEST(durability_left - ?, 0) WHERE id = ?',
      [amount, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Item không tồn tại' });
    }

    const [itemRows] = await pool.promise().query('SELECT durability_left FROM inventory WHERE id = ?', [id]);
    const durability_left = itemRows[0]?.durability_left ?? 0;
    if (Number(durability_left) <= 0) {
      // đảm bảo không còn gắn trên pet
      await pool.promise().query('DELETE FROM inventory WHERE id = ?', [id]);
      return res.json({
        message: 'Equipment đã hỏng và bị tiêu hủy',
        durability_left: 0,
        item_destroyed: true,
      });
    }

    return res.json({
      message: 'Durability đã được cập nhật',
      durability_left: Number(durability_left),
      item_destroyed: false,
    });

  } catch (err) {
    console.error('Error updating durability:', err);
    res.status(500).json({ message: 'Lỗi khi cập nhật durability' });
  }
});

/*==================================================== ARENA =========================================================================*/
// API: Admin tạo pet NPC từ species để dùng trong arena
app.post('/api/admin/arena-pet', async (req, res) => {
  let { pet_species_id, level, custom_name } = req.body;
  const adminId = req.user?.id || 6; // giả định admin là user id 1

  try {
    const [speciesRows] = await db.query(
      'SELECT * FROM pet_species WHERE id = ?',
      [pet_species_id]
    );
    if (!speciesRows.length) return res.status(404).json({ message: 'Pet species không tồn tại' });
    const species = speciesRows[0];

    // IV full 31
    const iv = { iv_hp: parseInt(31), iv_mp: parseInt(31), iv_str: parseInt(31), iv_def: parseInt(31), iv_intelligence: parseInt(31), iv_spd: parseInt(31) };

    const base = {
      hp: parseInt(species.base_hp),
      mp: parseInt(species.base_mp),
      str: parseInt(species.base_str),
      def: parseInt(species.base_def),
      intelligence: parseInt(species.base_intelligence),
      spd: parseInt(species.base_spd),
    };
    level = parseInt(level);
    console.log('BASE STATS:', base, 'IV:', iv, 'LEVEL:', level);
    const stats = calculateFinalStats(base, iv, level);
    console.log('FINAL STATS:', stats);
    const uuid = require('uuid').v4();
    const now = new Date();
    const expToNext = 100; // default hoặc dùng bảng exp

    await db.query(`
      INSERT INTO pets (uuid, name, owner_id, pet_species_id, level, created_date, 
        hp, max_hp, mp, max_mp, str, def, intelligence, spd,
        iv_hp, iv_mp, iv_str, iv_def, iv_intelligence, iv_spd, 
        current_exp, exp_to_next_level, final_stats)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      uuid,
      custom_name || species.name,
      adminId,
      species.id,
      level,
      now,
      stats.hp, stats.hp,
      stats.mp, stats.mp,
      stats.str, stats.def, stats.intelligence, stats.spd,
      iv.iv_hp, iv.iv_mp, iv.iv_str, iv.iv_def, iv.iv_intelligence, iv.iv_spd,
      0, expToNext,
      JSON.stringify(stats),
    ]);

    res.json({ message: 'Đã tạo NPC thành công!' });
  } catch (err) {
    console.error('Lỗi tạo arena pet:', err);
    res.status(500).json({ message: 'Lỗi khi tạo pet đấu trường' });
  }
});


// API: Lấy danh sách Boss/NPC làm đối thủ Arena (từ bảng boss_templates; location_id = 1 = Arena)
app.get('/api/arena/enemies', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT id, name, level, image_url AS image
      FROM boss_templates
      WHERE location_id = 1 OR location_id IS NULL
      ORDER BY level ASC
    `);
    const list = (rows || []).map((r) => ({ ...r, isBoss: true }));
    res.json(list);
  } catch (err) {
    console.error('Lỗi khi lấy danh sách Boss Arena:', err);
    res.status(500).json({ message: 'Lỗi server khi tải danh sách đối thủ' });
  }
});

// API: Chi tiết Boss (dùng cho Arena battle – trả về final_stats tương thích Pet, current_hp = max hp)
app.get('/api/bosses/:id', async (req, res) => {
  try {
    const bossId = parseInt(req.params.id, 10);
    if (!bossId) return res.status(400).json({ message: 'ID Boss không hợp lệ' });

    const [bossRows] = await db.query(
      'SELECT * FROM boss_templates WHERE id = ?',
      [bossId]
    );
    if (!bossRows || bossRows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy Boss' });
    }
    const row = bossRows[0];

    // Stat Boss cố định do admin/DB nhập, không tính công thức, không IV, không lên level
    const finalStats = {
      hp: parseInt(row.base_hp, 10) || 10,
      mp: parseInt(row.base_mp, 10) || 10,
      str: parseInt(row.base_str, 10) || 10,
      def: parseInt(row.base_def, 10) || 10,
      intelligence: parseInt(row.base_intelligence, 10) || 10,
      spd: parseInt(row.base_spd, 10) || 10,
    };
    const level = parseInt(row.level, 10) || 1;

    const [skillRows] = await db.query(
      `SELECT s.id, s.name, s.description, s.type, s.power_min, s.power_max, s.accuracy, s.mana_cost, bs.sort_order
       FROM boss_skills bs
       JOIN skills s ON bs.skill_id = s.id
       WHERE bs.boss_template_id = ?
       ORDER BY bs.sort_order ASC, s.id ASC`,
      [bossId]
    );
    const skills = (skillRows || []).map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type || 'attack',
      power_min: s.power_min != null ? parseInt(s.power_min, 10) : 80,
      power_max: s.power_max != null ? parseInt(s.power_max, 10) : 100,
      accuracy: s.accuracy != null ? parseInt(s.accuracy, 10) : 100,
      mana_cost: s.mana_cost != null ? parseInt(s.mana_cost, 10) : 0,
    }));

    const action_pattern = row.action_pattern
      ? (typeof row.action_pattern === 'string' ? JSON.parse(row.action_pattern) : row.action_pattern)
      : null;

    const boss = {
      id: row.id,
      name: row.name,
      level,
      image: row.image_url,
      image_url: row.image_url,
      final_stats: finalStats,
      current_hp: finalStats.hp,
      location_id: row.location_id,
      drop_table: row.drop_table ? (typeof row.drop_table === 'string' ? JSON.parse(row.drop_table) : row.drop_table) : null,
      respawn_minutes: row.respawn_minutes,
      skills,
      action_pattern: Array.isArray(action_pattern) ? action_pattern : null,
      isBoss: true,
    };
    res.json(boss);
  } catch (err) {
    console.error('Lỗi khi lấy chi tiết Boss:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ---------- Admin NPC/Boss: skills, boss_templates, boss_skills (CRUD + CSV) ----------
const checkAdminRoleNpc = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token required' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const [rows] = await db.query('SELECT role FROM users WHERE id = ?', [decoded.userId]);
    if (!rows.length || rows[0].role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    req.user = { userId: decoded.userId };
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Helper: parse CSV text (first line = headers)
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).filter(l => l.trim()).map(line => {
    const values = [];
    let cur = '', inQuoted = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQuoted = !inQuoted; continue; }
      if (!inQuoted && c === ',') { values.push(cur.trim()); cur = ''; continue; }
      cur += c;
    }
    values.push(cur.trim());
    return values;
  });
  return { headers, rows };
}

// Helper: escape CSV cell
function escapeCSV(val) {
  if (val == null) return '';
  const s = String(val);
  return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// Skills - list
app.get('/api/admin/skills', checkAdminRoleNpc, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM skills ORDER BY id');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Skills - create (type, power_min, power_max, accuracy cho Boss skill)
app.post('/api/admin/skills', checkAdminRoleNpc, async (req, res) => {
  try {
    const { name, description, power_multiplier, effect_type, mana_cost, type, power_min, power_max, accuracy } = req.body;
    const skillType = (type === 'defend' ? 'defend' : 'attack');
    const pMin = power_min != null ? parseInt(power_min, 10) : 80;
    const pMax = power_max != null ? parseInt(power_max, 10) : 100;
    const acc = accuracy != null ? Math.min(100, Math.max(0, parseInt(accuracy, 10))) : 100;
    await db.query(
      'INSERT INTO skills (name, description, power_multiplier, effect_type, mana_cost, type, power_min, power_max, accuracy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name || '', description || null, power_multiplier != null ? Number(power_multiplier) : 1, effect_type || null, mana_cost != null ? parseInt(mana_cost, 10) : 0, skillType, pMin, pMax, acc]
    );
    const [inserted] = await db.query('SELECT * FROM skills ORDER BY id DESC LIMIT 1');
    res.status(201).json(inserted[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Skills - update
app.put('/api/admin/skills/:id', checkAdminRoleNpc, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, description, power_multiplier, effect_type, mana_cost, type, power_min, power_max, accuracy } = req.body;
    const skillType = (type === 'defend' ? 'defend' : 'attack');
    const pMin = power_min != null ? parseInt(power_min, 10) : 80;
    const pMax = power_max != null ? parseInt(power_max, 10) : 100;
    const acc = accuracy != null ? Math.min(100, Math.max(0, parseInt(accuracy, 10))) : 100;
    await db.query(
      'UPDATE skills SET name=?, description=?, power_multiplier=?, effect_type=?, mana_cost=?, type=?, power_min=?, power_max=?, accuracy=? WHERE id=?',
      [name ?? '', description ?? null, power_multiplier != null ? Number(power_multiplier) : 1, effect_type ?? null, mana_cost != null ? parseInt(mana_cost, 10) : 0, skillType, pMin, pMax, acc, id]
    );
    const [rows] = await db.query('SELECT * FROM skills WHERE id=?', [id]);
    res.json(rows[0] || {});
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Skills - delete
app.delete('/api/admin/skills/:id', checkAdminRoleNpc, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db.query('DELETE FROM skills WHERE id=?', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Skills - download CSV
app.get('/api/admin/skills/csv', checkAdminRoleNpc, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM skills ORDER BY id');
    const headers = ['id', 'name', 'description', 'type', 'power_min', 'power_max', 'accuracy', 'power_multiplier', 'effect_type', 'mana_cost', 'created_at'];
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => escapeCSV(r[h])).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=skills.csv');
    res.send('\uFEFF' + csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Skills - upload CSV: chỉ UPDATE khi id có trong DB; id trống hoặc id không tồn tại → INSERT
app.post('/api/admin/skills/csv', checkAdminRoleNpc, uploadMemory.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) return res.status(400).json({ message: 'Thiếu file CSV' });
    const text = req.file.buffer.toString('utf8');
    const { headers, rows } = parseCSV(text);
    const required = ['name'];
    const h = headers.map(x => x.toLowerCase().trim());
    if (!required.every(k => h.includes(k))) return res.status(400).json({ message: 'CSV thiếu cột bắt buộc: ' + required.join(', ') });
    let updated = 0, inserted = 0;
    for (const row of rows) {
      const o = {};
      headers.forEach((col, i) => { o[col.toLowerCase().trim()] = row[i]; });
      const idRaw = o.id != null && String(o.id).trim() !== '' ? parseInt(o.id, 10) : null;
      const id = (idRaw != null && !isNaN(idRaw)) ? idRaw : null;
      let doUpdate = false;
      if (id != null) {
        const [ex] = await db.query('SELECT 1 FROM skills WHERE id = ? LIMIT 1', [id]);
        doUpdate = ex && ex.length > 0;
      }
      const skillType = (o.type === 'defend' ? 'defend' : 'attack');
      const pMin = o.power_min != null && o.power_min !== '' ? parseInt(o.power_min, 10) : 80;
      const pMax = o.power_max != null && o.power_max !== '' ? parseInt(o.power_max, 10) : 100;
      const acc = o.accuracy != null && o.accuracy !== '' ? Math.min(100, Math.max(0, parseInt(o.accuracy, 10))) : 100;
      if (doUpdate) {
        await db.query('UPDATE skills SET name=?, description=?, power_multiplier=?, effect_type=?, mana_cost=?, type=?, power_min=?, power_max=?, accuracy=? WHERE id=?', [
          o.name ?? '', o.description ?? null, o.power_multiplier != null ? Number(o.power_multiplier) : 1, o.effect_type ?? null, o.mana_cost != null ? parseInt(o.mana_cost, 10) : 0, skillType, pMin, pMax, acc, id
        ]);
        updated++;
      } else {
        await db.query('INSERT INTO skills (name, description, power_multiplier, effect_type, mana_cost, type, power_min, power_max, accuracy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [
          o.name ?? '', o.description ?? null, o.power_multiplier != null ? Number(o.power_multiplier) : 1, o.effect_type ?? null, o.mana_cost != null ? parseInt(o.mana_cost, 10) : 0, skillType, pMin, pMax, acc
        ]);
        inserted++;
      }
    }
    res.json({ success: true, updated, inserted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Boss templates - list
app.get('/api/admin/boss-templates', checkAdminRoleNpc, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM boss_templates ORDER BY id');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Helper: parse int hoặc trả về null nếu rỗng/NaN
const parseIntOrNull = (v, defaultValue) => {
  if (v === '' || v === undefined || v === null) return defaultValue ?? null;
  const n = parseInt(v, 10);
  return isNaN(n) ? (defaultValue ?? null) : n;
};

// Boss templates - create
app.post('/api/admin/boss-templates', checkAdminRoleNpc, async (req, res) => {
  try {
    const { name, image_url, level, base_hp, base_mp, base_str, base_def, base_intelligence, base_spd, accuracy, location_id, drop_table, respawn_minutes, action_pattern } = req.body;
    const dt = drop_table != null ? (typeof drop_table === 'string' ? drop_table : JSON.stringify(drop_table)) : null;
    const ap = action_pattern != null ? (typeof action_pattern === 'string' ? action_pattern : JSON.stringify(action_pattern)) : null;
    const locId = parseIntOrNull(location_id);
    const respawnVal = parseIntOrNull(respawn_minutes);
    await db.query(
      `INSERT INTO boss_templates (name, image_url, level, base_hp, base_mp, base_str, base_def, base_intelligence, base_spd, accuracy, location_id, drop_table, respawn_minutes, action_pattern)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name ?? '', image_url ?? '', parseIntOrNull(level, 1), parseIntOrNull(base_hp, 10), parseIntOrNull(base_mp, 10), parseIntOrNull(base_str, 10), parseIntOrNull(base_def, 10), parseIntOrNull(base_intelligence, 10), parseIntOrNull(base_spd, 10), parseIntOrNull(accuracy, 100), locId, dt, respawnVal, ap]
    );
    const [inserted] = await db.query('SELECT * FROM boss_templates ORDER BY id DESC LIMIT 1');
    res.status(201).json(inserted[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Boss templates - update
app.put('/api/admin/boss-templates/:id', checkAdminRoleNpc, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, image_url, level, base_hp, base_mp, base_str, base_def, base_intelligence, base_spd, accuracy, location_id, drop_table, respawn_minutes, action_pattern } = req.body;
    const dt = drop_table != null ? (typeof drop_table === 'string' ? drop_table : JSON.stringify(drop_table)) : undefined;
    const ap = action_pattern !== undefined ? (action_pattern == null ? null : (typeof action_pattern === 'string' ? action_pattern : JSON.stringify(action_pattern))) : undefined;
    const updates = [];
    const values = [];
    if (name !== undefined) { updates.push('name=?'); values.push(name); }
    if (image_url !== undefined) { updates.push('image_url=?'); values.push(image_url); }
    if (level !== undefined) { const v = parseIntOrNull(level, 1); if (v != null) { updates.push('level=?'); values.push(v); } }
    if (base_hp !== undefined) { const v = parseIntOrNull(base_hp, 10); if (v != null) { updates.push('base_hp=?'); values.push(v); } }
    if (base_mp !== undefined) { const v = parseIntOrNull(base_mp, 10); if (v != null) { updates.push('base_mp=?'); values.push(v); } }
    if (base_str !== undefined) { const v = parseIntOrNull(base_str, 10); if (v != null) { updates.push('base_str=?'); values.push(v); } }
    if (base_def !== undefined) { const v = parseIntOrNull(base_def, 10); if (v != null) { updates.push('base_def=?'); values.push(v); } }
    if (base_intelligence !== undefined) { const v = parseIntOrNull(base_intelligence, 10); if (v != null) { updates.push('base_intelligence=?'); values.push(v); } }
    if (base_spd !== undefined) { const v = parseIntOrNull(base_spd, 10); if (v != null) { updates.push('base_spd=?'); values.push(v); } }
    if (accuracy !== undefined) { const v = parseIntOrNull(accuracy, 100); if (v != null) { updates.push('accuracy=?'); values.push(v); } }
    if (location_id !== undefined) { updates.push('location_id=?'); values.push(parseIntOrNull(location_id)); }
    if (dt !== undefined) { updates.push('drop_table=?'); values.push(dt); }
    if (respawn_minutes !== undefined) { updates.push('respawn_minutes=?'); values.push(parseIntOrNull(respawn_minutes)); }
    if (ap !== undefined) { updates.push('action_pattern=?'); values.push(ap); }
    if (updates.length === 0) return res.json({});
    values.push(id);
    await db.query('UPDATE boss_templates SET ' + updates.join(', ') + ' WHERE id=?', values);
    const [rows] = await db.query('SELECT * FROM boss_templates WHERE id=?', [id]);
    res.json(rows[0] || {});
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Boss templates - delete
app.delete('/api/admin/boss-templates/:id', checkAdminRoleNpc, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db.query('DELETE FROM boss_templates WHERE id=?', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Boss templates - download CSV
app.get('/api/admin/boss-templates/csv', checkAdminRoleNpc, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM boss_templates ORDER BY id');
    const headers = ['id', 'name', 'image_url', 'level', 'base_hp', 'base_mp', 'base_str', 'base_def', 'base_intelligence', 'base_spd', 'accuracy', 'location_id', 'drop_table', 'respawn_minutes', 'created_at'];
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => escapeCSV(r[h] != null && typeof r[h] === 'object' ? JSON.stringify(r[h]) : r[h])).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=boss_templates.csv');
    res.send('\uFEFF' + csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Boss templates - upload CSV: chỉ UPDATE khi id có trong DB; id trống hoặc id không tồn tại → INSERT
app.post('/api/admin/boss-templates/csv', checkAdminRoleNpc, uploadMemory.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) return res.status(400).json({ message: 'Thiếu file CSV' });
    const text = req.file.buffer.toString('utf8');
    const { headers, rows } = parseCSV(text);
    const required = ['name', 'image_url'];
    const h = headers.map(x => x.toLowerCase().trim());
    if (!required.every(k => h.includes(k))) return res.status(400).json({ message: 'CSV thiếu cột: ' + required.join(', ') });
    let updated = 0, inserted = 0;
    const num = (v) => (v !== '' && v != null && !isNaN(Number(v)) ? parseInt(v, 10) : null);
    const numDef = (v, d) => (v !== '' && v != null && !isNaN(Number(v)) ? parseInt(v, 10) : d);
    for (const row of rows) {
      const o = {};
      headers.forEach((col, i) => { o[col.toLowerCase().trim()] = row[i]; });
      const idRaw = o.id != null && String(o.id).trim() !== '' ? parseInt(o.id, 10) : null;
      const id = (idRaw != null && !isNaN(idRaw)) ? idRaw : null;
      const dt = (o.drop_table && o.drop_table.trim()) ? o.drop_table.trim() : null;
      const ap = (o.action_pattern != null && String(o.action_pattern).trim() !== '') ? String(o.action_pattern).trim() : null;
      let doUpdate = false;
      if (id != null) {
        const [ex] = await db.query('SELECT 1 FROM boss_templates WHERE id = ? LIMIT 1', [id]);
        doUpdate = ex && ex.length > 0;
      }
      if (doUpdate) {
        await db.query(
          'UPDATE boss_templates SET name=?, image_url=?, level=?, base_hp=?, base_mp=?, base_str=?, base_def=?, base_intelligence=?, base_spd=?, accuracy=?, location_id=?, drop_table=?, respawn_minutes=?, action_pattern=? WHERE id=?',
          [o.name ?? '', o.image_url ?? '', numDef(o.level, 1), numDef(o.base_hp, 10), numDef(o.base_mp, 10), numDef(o.base_str, 10), numDef(o.base_def, 10), numDef(o.base_intelligence, 10), numDef(o.base_spd, 10), numDef(o.accuracy, 100), num(o.location_id), dt, num(o.respawn_minutes), ap, id]
        );
        updated++;
      } else {
        await db.query(
          `INSERT INTO boss_templates (name, image_url, level, base_hp, base_mp, base_str, base_def, base_intelligence, base_spd, accuracy, location_id, drop_table, respawn_minutes, action_pattern) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [o.name ?? '', o.image_url ?? '', numDef(o.level, 1), numDef(o.base_hp, 10), numDef(o.base_mp, 10), numDef(o.base_str, 10), numDef(o.base_def, 10), numDef(o.base_intelligence, 10), numDef(o.base_spd, 10), numDef(o.accuracy, 100), num(o.location_id), dt, num(o.respawn_minutes), ap]
        );
        inserted++;
      }
    }
    res.json({ success: true, updated, inserted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Boss skills - list
app.get('/api/admin/boss-skills', checkAdminRoleNpc, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM boss_skills ORDER BY id');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Boss skills - create
app.post('/api/admin/boss-skills', checkAdminRoleNpc, async (req, res) => {
  try {
    const { boss_template_id, skill_id, sort_order } = req.body;
    await db.query(
      'INSERT INTO boss_skills (boss_template_id, skill_id, sort_order) VALUES (?, ?, ?)',
      [parseInt(boss_template_id, 10), parseInt(skill_id, 10), sort_order != null ? parseInt(sort_order, 10) : 0]
    );
    const [inserted] = await db.query('SELECT * FROM boss_skills ORDER BY id DESC LIMIT 1');
    res.status(201).json(inserted[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Boss skills - update
app.put('/api/admin/boss-skills/:id', checkAdminRoleNpc, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { boss_template_id, skill_id, sort_order } = req.body;
    await db.query(
      'UPDATE boss_skills SET boss_template_id=?, skill_id=?, sort_order=? WHERE id=?',
      [parseInt(boss_template_id, 10), parseInt(skill_id, 10), sort_order != null ? parseInt(sort_order, 10) : 0, id]
    );
    const [rows] = await db.query('SELECT * FROM boss_skills WHERE id=?', [id]);
    res.json(rows[0] || {});
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Boss skills - delete
app.delete('/api/admin/boss-skills/:id', checkAdminRoleNpc, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db.query('DELETE FROM boss_skills WHERE id=?', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Boss skills - download CSV
app.get('/api/admin/boss-skills/csv', checkAdminRoleNpc, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM boss_skills ORDER BY id');
    const headers = ['id', 'boss_template_id', 'skill_id', 'sort_order'];
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => escapeCSV(r[h])).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=boss_skills.csv');
    res.send('\uFEFF' + csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Boss skills - upload CSV: chỉ UPDATE khi id có trong DB; id trống hoặc id không tồn tại → INSERT
app.post('/api/admin/boss-skills/csv', checkAdminRoleNpc, uploadMemory.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) return res.status(400).json({ message: 'Thiếu file CSV' });
    const text = req.file.buffer.toString('utf8');
    const { headers, rows } = parseCSV(text);
    const required = ['boss_template_id', 'skill_id'];
    const h = headers.map(x => x.toLowerCase().trim());
    if (!required.every(k => h.includes(k))) return res.status(400).json({ message: 'CSV thiếu cột: ' + required.join(', ') });
    let updated = 0, inserted = 0;
    for (const row of rows) {
      const o = {};
      headers.forEach((col, i) => { o[col.toLowerCase().trim()] = row[i]; });
      const idRaw = o.id != null && String(o.id).trim() !== '' ? parseInt(o.id, 10) : null;
      const id = (idRaw != null && !isNaN(idRaw)) ? idRaw : null;
      const btId = parseInt(o.boss_template_id, 10);
      const skId = parseInt(o.skill_id, 10);
      const so = o.sort_order != null && o.sort_order !== '' ? parseInt(o.sort_order, 10) : 0;
      let doUpdate = false;
      if (id != null) {
        const [ex] = await db.query('SELECT 1 FROM boss_skills WHERE id = ? LIMIT 1', [id]);
        doUpdate = ex && ex.length > 0;
      }
      if (doUpdate) {
        await db.query('UPDATE boss_skills SET boss_template_id=?, skill_id=?, sort_order=? WHERE id=?', [btId, skId, so, id]);
        updated++;
      } else {
        await db.query('INSERT INTO boss_skills (boss_template_id, skill_id, sort_order) VALUES (?, ?, ?)', [btId, skId, so]);
        inserted++;
      }
    }
    res.json({ success: true, updated, inserted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ---------- Admin Item Management (items, equipment_data, item_effects) CSV ----------
app.get('/api/admin/items/csv', checkAdminRoleNpc, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, name, description, type, rarity, image_url, buy_price, sell_price FROM items ORDER BY id');
    const headers = ['id', 'name', 'description', 'type', 'rarity', 'image_url', 'buy_price', 'sell_price'];
    const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => escapeCSV(r[h])).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=items.csv');
    res.send('\uFEFF' + csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

app.post('/api/admin/items/csv', checkAdminRoleNpc, uploadMemory.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) return res.status(400).json({ message: 'Thiếu file CSV' });
    const text = req.file.buffer.toString('utf8');
    const { headers, rows } = parseCSV(text);
    const required = ['name', 'type', 'rarity', 'image_url'];
    const h = headers.map((x) => x.toLowerCase().trim());
    if (!required.every((k) => h.includes(k))) return res.status(400).json({ message: 'CSV thiếu cột: ' + required.join(', ') });
    let updated = 0;
    let inserted = 0;
    for (const row of rows) {
      const o = {};
      headers.forEach((col, i) => { o[col.toLowerCase().trim()] = row[i]; });
      const idRaw = o.id != null && String(o.id).trim() !== '' ? parseInt(o.id, 10) : null;
      const id = idRaw != null && !isNaN(idRaw) ? idRaw : null;
      const buyPrice = o.buy_price != null && o.buy_price !== '' ? Number(o.buy_price) : 0;
      const sellPrice = o.sell_price != null && o.sell_price !== '' ? Number(o.sell_price) : 0;
      let doUpdate = false;
      if (id != null) {
        const [ex] = await db.query('SELECT 1 FROM items WHERE id = ? LIMIT 1', [id]);
        doUpdate = ex && ex.length > 0;
      }
      if (doUpdate) {
        await db.query(
          'UPDATE items SET name=?, description=?, type=?, rarity=?, image_url=?, buy_price=?, sell_price=? WHERE id=?',
          [o.name ?? '', o.description ?? '', o.type ?? 'misc', o.rarity ?? 'common', o.image_url ?? '', buyPrice, sellPrice, id]
        );
        updated++;
      } else {
        await db.query(
          'INSERT INTO items (name, description, type, rarity, image_url, buy_price, sell_price) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [o.name ?? '', o.description ?? '', o.type ?? 'misc', o.rarity ?? 'common', o.image_url ?? '', buyPrice, sellPrice]
        );
        inserted++;
      }
    }
    res.json({ success: true, updated, inserted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

app.get('/api/admin/equipment-stats/csv', checkAdminRoleNpc, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, item_id, equipment_type, power_min, power_max, durability_max, magic_value, crit_rate, block_rate, element, effect_id FROM equipment_data ORDER BY id');
    const headers = ['id', 'item_id', 'equipment_type', 'power_min', 'power_max', 'durability_max', 'magic_value', 'crit_rate', 'block_rate', 'element', 'effect_id'];
    const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => escapeCSV(r[h])).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=equipment_data.csv');
    res.send('\uFEFF' + csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

app.post('/api/admin/equipment-stats/csv', checkAdminRoleNpc, uploadMemory.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) return res.status(400).json({ message: 'Thiếu file CSV' });
    const text = req.file.buffer.toString('utf8');
    const { headers, rows } = parseCSV(text);
    const required = ['item_id'];
    const h = headers.map((x) => x.toLowerCase().trim());
    if (!required.every((k) => h.includes(k))) return res.status(400).json({ message: 'CSV thiếu cột: ' + required.join(', ') });
    let updated = 0;
    let inserted = 0;
    const toNum = (v) => (v != null && v !== '' && !isNaN(Number(v)) ? Number(v) : null);
    for (const row of rows) {
      const o = {};
      headers.forEach((col, i) => { o[col.toLowerCase().trim()] = row[i]; });
      const idRaw = o.id != null && String(o.id).trim() !== '' ? parseInt(o.id, 10) : null;
      const id = idRaw != null && !isNaN(idRaw) ? idRaw : null;
      const itemId = parseInt(o.item_id, 10);
      if (isNaN(itemId)) continue;
      let doUpdate = false;
      if (id != null) {
        const [ex] = await db.query('SELECT 1 FROM equipment_data WHERE id = ? LIMIT 1', [id]);
        doUpdate = ex && ex.length > 0;
      }
      const values = [
        itemId,
        o.equipment_type || 'weapon',
        toNum(o.power_min),
        toNum(o.power_max),
        toNum(o.durability_max),
        toNum(o.magic_value),
        toNum(o.crit_rate),
        toNum(o.block_rate),
        o.element || null,
        toNum(o.effect_id),
      ];
      if (doUpdate) {
        await db.query(
          'UPDATE equipment_data SET item_id=?, equipment_type=?, power_min=?, power_max=?, durability_max=?, magic_value=?, crit_rate=?, block_rate=?, element=?, effect_id=? WHERE id=?',
          [...values, id]
        );
        updated++;
      } else {
        await db.query(
          'INSERT INTO equipment_data (item_id, equipment_type, power_min, power_max, durability_max, magic_value, crit_rate, block_rate, element, effect_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          values
        );
        inserted++;
      }
    }
    res.json({ success: true, updated, inserted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

app.delete('/api/admin/equipment-stats/:id', checkAdminRoleNpc, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db.query('DELETE FROM equipment_data WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

app.get('/api/admin/item-effects/csv', checkAdminRoleNpc, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, item_id, effect_target, effect_type, value_min, value_max, is_permanent, duration_turns FROM item_effects ORDER BY id');
    const headers = ['id', 'item_id', 'effect_target', 'effect_type', 'value_min', 'value_max', 'is_permanent', 'duration_turns'];
    const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => escapeCSV(r[h])).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=item_effects.csv');
    res.send('\uFEFF' + csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

app.post('/api/admin/item-effects/csv', checkAdminRoleNpc, uploadMemory.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) return res.status(400).json({ message: 'Thiếu file CSV' });
    const text = req.file.buffer.toString('utf8');
    const { headers, rows } = parseCSV(text);
    const required = ['item_id', 'effect_target', 'effect_type'];
    const h = headers.map((x) => x.toLowerCase().trim());
    if (!required.every((k) => h.includes(k))) return res.status(400).json({ message: 'CSV thiếu cột: ' + required.join(', ') });
    let updated = 0;
    let inserted = 0;
    for (const row of rows) {
      const o = {};
      headers.forEach((col, i) => { o[col.toLowerCase().trim()] = row[i]; });
      const idRaw = o.id != null && String(o.id).trim() !== '' ? parseInt(o.id, 10) : null;
      const id = idRaw != null && !isNaN(idRaw) ? idRaw : null;
      const itemId = parseInt(o.item_id, 10);
      if (isNaN(itemId)) continue;
      const valueMin = o.value_min != null && o.value_min !== '' ? Number(o.value_min) : 0;
      const valueMax = o.value_max != null && o.value_max !== '' ? Number(o.value_max) : 0;
      const isPermanent = o.is_permanent === '1' || String(o.is_permanent).toLowerCase() === 'true';
      const durationTurns = o.duration_turns != null && o.duration_turns !== '' ? parseInt(o.duration_turns, 10) : 0;
      let doUpdate = false;
      if (id != null) {
        const [ex] = await db.query('SELECT 1 FROM item_effects WHERE id = ? LIMIT 1', [id]);
        doUpdate = ex && ex.length > 0;
      }
      if (doUpdate) {
        await db.query(
          'UPDATE item_effects SET item_id=?, effect_target=?, effect_type=?, value_min=?, value_max=?, is_permanent=?, duration_turns=? WHERE id=?',
          [itemId, o.effect_target ?? 'hp', o.effect_type ?? 'flat', valueMin, valueMax, isPermanent, durationTurns, id]
        );
        updated++;
      } else {
        await db.query(
          'INSERT INTO item_effects (item_id, effect_target, effect_type, value_min, value_max, is_permanent, duration_turns) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [itemId, o.effect_target ?? 'hp', o.effect_type ?? 'flat', valueMin, valueMax, isPermanent, durationTurns]
        );
        inserted++;
      }
    }
    res.json({ success: true, updated, inserted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

app.delete('/api/admin/item-effects/:id', checkAdminRoleNpc, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db.query('DELETE FROM item_effects WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});


// API ARENA: Mô phỏng 1 lượt tấn công
// Công thức Dmg_out chung; defender_current_def_dmg (nếu > 0) áp dụng counter_dmg / phản đòn.
// Khi isEnemyAttack và attacker có action_pattern + skills: Boss dùng skill (turnNumber bắt buộc).
// body: attacker, defender, movePower, moveName, isEnemyAttack, power_min, power_max, turnNumber, defender_current_def_dmg
app.post('/api/arena/simulate-turn', (req, res) => {
  const { attacker, defender, movePower, moveName, isEnemyAttack, power_min, power_max, turnNumber, defender_current_def_dmg } = req.body;

  try {
    if (isEnemyAttack && Array.isArray(attacker.skills) && attacker.skills.length > 0) {
      const turn = Math.max(1, parseInt(turnNumber, 10) || 1);
      const skill = getBossAction(attacker, turn, attacker.skills);
      if (skill) {
        const defDmg = defender_current_def_dmg != null ? Number(defender_current_def_dmg) : (defender.current_def_dmg != null ? Number(defender.current_def_dmg) : 0);
        if (defender && typeof defender === 'object') defender.current_def_dmg = defDmg;
        const result = simulateBossTurn(attacker, defender, skill);
        return res.json(result);
      }
    }

    const options = {
      power_min: power_min != null ? Number(power_min) : undefined,
      power_max: power_max != null ? Number(power_max) : undefined,
      defender_current_def_dmg: defender_current_def_dmg != null ? Number(defender_current_def_dmg) : 0,
    };
    const result = simulateTurn(attacker, defender, movePower, moveName, options);
    res.json(result);
  } catch (err) {
    console.error('Error during turn simulation:', err);
    res.status(500).json({ message: 'Lỗi khi mô phỏng lượt đánh' });
  }
});

// POST /api/arena/simulate-defend – Pet (hoặc đơn vị phòng thủ) dùng khiên: chỉ thiết lập def_dmg, không gây sát thương
// body: defenderUnit (người dùng khiên), enemy (đối thủ), shield_power_min, shield_power_max
app.post('/api/arena/simulate-defend', (req, res) => {
  const { defenderUnit, enemy, shield_power_min, shield_power_max } = req.body;
  try {
    const result = simulateDefendTurn(
      defenderUnit ?? req.body.pet,
      enemy ?? req.body.boss,
      shield_power_min != null ? Number(shield_power_min) : 0,
      shield_power_max != null ? Number(shield_power_max) : 0
    );
    res.json(result);
  } catch (err) {
    console.error('Error during defend simulation:', err);
    res.status(500).json({ message: 'Lỗi khi mô phỏng lượt phòng thủ' });
  }
});

/**
 * Tính loot từ drop_table JSON của Boss.
 * Mỗi item roll độc lập (0..100), nếu roll <= rate thì nhận, số lượng random [min_qty, max_qty].
 * @param {Array|string} dropTable - Mảng JSON hoặc chuỗi JSON từ boss_templates.drop_table
 * @returns {Array<{item_id: number, quantity: number, name: string}>}
 */
function calculateLoot(dropTable) {
  const drops = Array.isArray(dropTable)
    ? dropTable
    : (typeof dropTable === 'string' ? JSON.parse(dropTable) : []);
  const lootResult = [];
  for (const item of drops) {
    const rate = Number(item.rate);
    if (rate <= 0) continue;
    const roll = Math.random() * 100;
    if (roll <= rate) {
      const minQty = Math.max(0, parseInt(item.min_qty, 10) || 0);
      const maxQty = Math.max(minQty, parseInt(item.max_qty, 10) || minQty);
      const quantity = minQty === maxQty ? minQty : Math.floor(Math.random() * (maxQty - minQty + 1)) + minQty;
      if (quantity > 0) {
        lootResult.push({
          item_id: item.item_id != null ? parseInt(item.item_id, 10) : 0,
          quantity,
          name: item.name || (item.item_id === 0 ? 'Peta' : 'Item'),
        });
      }
    }
  }
  return lootResult;
}

/**
 * POST /api/arena/claim-loot
 * Khi thắng Boss, gọi API này để tính loot từ drop_table của Boss và cộng vào user (peta + inventory).
 * body: { bossId: number, petId: number }
 * Header: Authorization: Bearer <token>
 */
app.post('/api/arena/claim-loot', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const tokenUserId = decoded.userId;

    const { bossId, petId } = req.body;
    if (!bossId || !petId) return res.status(400).json({ message: 'Thiếu bossId hoặc petId' });

    const [petRows] = await db.query('SELECT id, owner_id FROM pets WHERE id = ?', [petId]);
    if (!petRows.length) return res.status(404).json({ message: 'Pet not found' });
    if (petRows[0].owner_id !== tokenUserId) return res.status(403).json({ message: 'Chỉ chủ pet mới được nhận loot' });

    const [bossRows] = await db.query('SELECT drop_table FROM boss_templates WHERE id = ?', [bossId]);
    if (!bossRows.length) return res.status(404).json({ message: 'Boss not found' });
    const dropTableRaw = bossRows[0].drop_table;
    const dropTable = dropTableRaw
      ? (typeof dropTableRaw === 'string' ? JSON.parse(dropTableRaw) : dropTableRaw)
      : [];
    if (!Array.isArray(dropTable) || dropTable.length === 0) {
      return res.json({ success: true, loot: [], message: 'Boss không có bảng rơi đồ' });
    }

    const loot = calculateLoot(dropTable);
    const userId = tokenUserId;

    for (const entry of loot) {
      if (entry.item_id === 0) {
        await db.query('UPDATE users SET peta = peta + ? WHERE id = ?', [entry.quantity, userId]);
        continue;
      }
      const itemId = entry.item_id;
      const quantity = entry.quantity;
      const [itemRows] = await db.query('SELECT id, type FROM items WHERE id = ?', [itemId]);
      if (!itemRows.length) continue;
      const itemRow = itemRows[0];
      if (itemRow.type === 'equipment') {
        const [equipInfo] = await db.query('SELECT durability_max FROM equipment_data WHERE item_id = ?', [itemId]);
        const durability = (equipInfo.length > 0) ? (equipInfo[0].durability_max ?? 1) : 1;
        for (let i = 0; i < quantity; i++) {
          await db.query(
            `INSERT INTO inventory (player_id, item_id, quantity, is_equipped, durability_left) VALUES (?, ?, 1, 0, ?)`,
            [userId, itemId, durability]
          );
        }
      } else {
        const [invRows] = await db.query(
          'SELECT id, quantity FROM inventory WHERE player_id = ? AND item_id = ? AND (is_equipped = 0 OR is_equipped IS NULL)',
          [userId, itemId]
        );
        if (invRows.length > 0) {
          await db.query('UPDATE inventory SET quantity = quantity + ? WHERE id = ?', [quantity, invRows[0].id]);
        } else {
          await db.query('INSERT INTO inventory (player_id, item_id, quantity) VALUES (?, ?, ?)', [userId, itemId, quantity]);
        }
      }
    }

    res.json({ success: true, loot });
  } catch (err) {
    if (err.name === 'JsonWebTokenError') return res.status(401).json({ message: 'Invalid token' });
    console.error('Error claiming arena loot:', err);
    res.status(500).json({ message: 'Lỗi khi nhận thưởng Boss' });
  }
});

// ---------- Arena Match State (Redis) ----------
function getUserIdFromToken(req) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    return decoded.userId;
  } catch (_) {
    return null;
  }
}

async function finalizeMatchInMySQL(matchState, winner) {
  const conn = await pool.promise().getConnection();
  try {
    await conn.beginTransaction();
    const petId = matchState.pet_id;
    const playerHp = Math.max(0, matchState.player?.current_hp ?? 0);
    if (winner === 'enemy') {
      await conn.query('UPDATE pets SET current_hp = 0 WHERE id = ?', [petId]);
    } else {
      await conn.query('UPDATE pets SET current_hp = ? WHERE id = ?', [playerHp, petId]);
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

// POST /api/arena/match/start — Check HP, check active match, init Redis
app.post('/api/arena/match/start', async (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const redis = getRedis();
  if (!redis) return res.status(503).json({ message: 'Match service temporarily unavailable' });

  const { petId, bossId } = req.body;
  if (!petId || !bossId) return res.status(400).json({ message: 'Thiếu petId hoặc bossId' });

  try {
    const [petRows] = await db.query(
      'SELECT p.*, ps.name AS species_name, ps.image AS species_image FROM pets p JOIN pet_species ps ON p.pet_species_id = ps.id WHERE p.id = ? AND p.owner_id = ?',
      [petId, userId]
    );
    if (!petRows.length) return res.status(404).json({ message: 'Pet not found' });
    const pet = petRows[0];
    const currentHp = pet.current_hp != null ? parseInt(pet.current_hp, 10) : (pet.hp != null ? parseInt(pet.hp, 10) : 0);
    if (currentHp <= 0) {
      return res.status(400).json({ message: 'Thú cưng quá mệt mỏi, hãy cho ăn/nghỉ ngơi để hồi phục.' });
    }

    const key = REDIS_MATCH_PREFIX + userId;
    const existing = await redis.get(key);
    if (existing) {
      const matchData = JSON.parse(existing);
      return res.status(400).json({
        code: 'ACTIVE_MATCH',
        message: 'Bạn đang có trận đấu dang dở. Hãy quay lại tiếp tục.',
        match: matchData,
      });
    }

    const [bossRows] = await db.query('SELECT * FROM boss_templates WHERE id = ?', [bossId]);
    if (!bossRows.length) return res.status(404).json({ message: 'Boss not found' });
    const row = bossRows[0];
    const bossFinalStats = {
      hp: parseInt(row.base_hp, 10) || 10,
      mp: parseInt(row.base_mp, 10) || 10,
      str: parseInt(row.base_str, 10) || 10,
      def: parseInt(row.base_def, 10) || 10,
      intelligence: parseInt(row.base_intelligence, 10) || 10,
      spd: parseInt(row.base_spd, 10) || 10,
    };
    const [skillRows] = await db.query(
      `SELECT s.id, s.name, s.type, s.power_min, s.power_max, s.accuracy, s.mana_cost FROM boss_skills bs JOIN skills s ON bs.skill_id = s.id WHERE bs.boss_template_id = ? ORDER BY bs.sort_order ASC`,
      [bossId]
    );
    const skills = (skillRows || []).map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type || 'attack',
      power_min: s.power_min != null ? parseInt(s.power_min, 10) : 80,
      power_max: s.power_max != null ? parseInt(s.power_max, 10) : 100,
      accuracy: s.accuracy != null ? parseInt(s.accuracy, 10) : 100,
      mana_cost: s.mana_cost != null ? parseInt(s.mana_cost, 10) : 0,
    }));
    const action_pattern = row.action_pattern ? (typeof row.action_pattern === 'string' ? JSON.parse(row.action_pattern) : row.action_pattern) : null;
    const enemy = {
      id: row.id,
      name: row.name,
      level: parseInt(row.level, 10) || 1,
      image: row.image_url,
      final_stats: bossFinalStats,
      current_hp: bossFinalStats.hp,
      current_mp: bossFinalStats.mp,
      current_def_dmg: 0,
      skills,
      action_pattern: Array.isArray(action_pattern) ? action_pattern : null,
      isBoss: true,
    };

    let finalStats = pet.final_stats;
    if (typeof finalStats === 'string') finalStats = JSON.parse(finalStats || '{}');
    if (!finalStats || typeof finalStats !== 'object') finalStats = { hp: pet.hp, mp: pet.mp, str: pet.str, def: pet.def, intelligence: pet.intelligence, spd: pet.spd };
    const player = {
      id: pet.id,
      name: pet.name,
      level: parseInt(pet.level, 10) || 1,
      image: pet.species_image || pet.image,
      final_stats: finalStats,
      current_hp: currentHp,
      current_mp: pet.mp != null ? parseInt(pet.mp, 10) : finalStats.mp,
      current_def_dmg: 0,
      current_exp: pet.current_exp,
    };

    const [equipRows] = await db.query(
      `SELECT i.id, i.item_id, it.name AS item_name, it.image_url, i.durability_left, ed.power_min, ed.power_max, ed.equipment_type, ed.magic_value, ed.durability_max
       FROM inventory i JOIN items it ON i.item_id = it.id LEFT JOIN equipment_data ed ON it.id = ed.item_id
       WHERE i.equipped_pet_id = ? AND i.is_equipped = 1`,
      [petId]
    );
    const equipment = (equipRows || []).map((e) => ({
      id: e.id,
      item_id: e.item_id,
      item_name: e.item_name,
      image_url: e.image_url || '',
      durability_left: e.durability_left != null ? parseInt(e.durability_left, 10) : 1,
      max_durability: e.durability_max != null ? parseInt(e.durability_max, 10) : 1,
      power_min: e.power_min != null ? parseInt(e.power_min, 10) : 0,
      power_max: e.power_max != null ? parseInt(e.power_max, 10) : 0,
      equipment_type: e.equipment_type || 'weapon',
      magic_value: e.magic_value != null ? parseInt(e.magic_value, 10) : 0,
    }));

    const matchState = {
      userId,
      pet_id: parseInt(petId, 10),
      boss_id: parseInt(bossId, 10),
      player,
      enemy,
      equipment,
      turn_count: 0,
      history: [],
      finished: false,
      result: null,
    };
    await redis.set(key, JSON.stringify(matchState), { EX: REDIS_MATCH_TTL });
    res.json(matchState);
  } catch (err) {
    console.error('Error arena match start:', err);
    res.status(500).json({ message: 'Lỗi khởi tạo trận đấu' });
  }
});

// GET /api/arena/match/status — Reconnect: trả về trận đấu đang dang dở
app.get('/api/arena/match/status', async (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const redis = getRedis();
  if (!redis) return res.status(503).json({ message: 'Match service temporarily unavailable' });

  try {
    const key = REDIS_MATCH_PREFIX + userId;
    const data = await redis.get(key);
    if (!data) return res.status(404).json({ message: 'No active match' });
    res.json(JSON.parse(data));
  } catch (err) {
    console.error('Error arena match status:', err);
    res.status(500).json({ message: 'Lỗi kiểm tra trận đấu' });
  }
});

// POST /api/arena/match/terminate — User rời đi: force loss, lưu HP pet, xóa Redis
app.post('/api/arena/match/terminate', async (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const redis = getRedis();
  if (!redis) return res.status(503).json({ message: 'Match service temporarily unavailable' });

  try {
    const key = REDIS_MATCH_PREFIX + userId;
    const data = await redis.get(key);
    if (!data) return res.status(404).json({ message: 'No active match' });
    const matchState = JSON.parse(data);
    const playerHp = Math.max(0, matchState.player?.current_hp ?? 0);
    await db.query('UPDATE pets SET current_hp = ? WHERE id = ?', [playerHp, matchState.pet_id]);
    await redis.del(key);
    res.json({ forceLoss: true, message: 'Trận đấu đã kết thúc (rời đi).' });
  } catch (err) {
    console.error('Error arena match terminate:', err);
    res.status(500).json({ message: 'Lỗi kết thúc trận đấu' });
  }
});

// POST /api/arena/match/turn — Xử lý 1 lượt (player action + enemy action), chỉ dùng Redis rồi finalize khi hết trận
app.post('/api/arena/match/turn', async (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const redis = getRedis();
  if (!redis) return res.status(503).json({ message: 'Match service temporarily unavailable' });

  const key = REDIS_MATCH_PREFIX + userId;
  const { action, itemId, power_min, power_max, moveName } = req.body || {};

  try {
    const data = await redis.get(key);
    if (!data) return res.status(404).json({ message: 'Match not found' });
    const state = JSON.parse(data);
    const player = state.player;
    const enemy = state.enemy;
    const NORMAL_POWER_MIN = 7;
    const NORMAL_POWER_MAX = 10;

    // Thứ tự đánh theo speed: SPD cao hơn đánh trước
    const playerSpd = player.final_stats?.spd ?? player.spd ?? 0;
    const enemySpd = enemy.final_stats?.spd ?? enemy.spd ?? 0;
    const playerGoesFirst = playerSpd >= enemySpd;

    const runEnemyTurn = async () => {
      const turnNum = state.turn_count || 1;
      const skill = getBossAction(enemy, turnNum, enemy.skills);
      if (skill) {
        const defDmg = player.current_def_dmg ?? 0;
        if (typeof player === 'object') player.current_def_dmg = defDmg;
        const bossResult = simulateBossTurn(enemy, player, skill);
        const logMsg = bossResult.isBossDefend
          ? `${enemy.name} dùng ${skill.name} (Phòng thủ).`
          : (bossResult.miss ? `${enemy.name} dùng ${skill.name} nhưng trượt!` : `${enemy.name} dùng ${bossResult.moveUsed}, gây ${bossResult.damage || 0} sát thương.`);
        state.history.push({ text: logMsg, type: 'enemy_attack' });
        if (bossResult.defender_hp_after != null) player.current_hp = bossResult.defender_hp_after;
        if (bossResult.attacker_hp_after != null) enemy.current_hp = bossResult.attacker_hp_after;
        if (bossResult.bossDefDmg != null) enemy.current_def_dmg = bossResult.bossDefDmg;
        if (bossResult.defender_current_def_dmg === 0 && typeof player.current_def_dmg === 'number') player.current_def_dmg = 0;
      }
    };

    const runPlayerAction = async () => {
      let result;
      if (action === 'defend_shield' || action === 'defend_basic') {
        const powerMin = action === 'defend_shield' && power_min != null ? Number(power_min) : NORMAL_POWER_MIN;
        const powerMax = action === 'defend_shield' && power_max != null ? Number(power_max) : NORMAL_POWER_MAX;
        result = simulateDefendTurn(player, enemy, powerMin, powerMax);
        state.history.push({ text: result.logMessage || `${player.name} sử dụng Phòng thủ.`, type: 'defense' });
        player.current_def_dmg = result.defDmg ?? 0;
        if (action === 'defend_shield' && itemId) {
          const inv = state.equipment.find((e) => e.id === itemId);
          if (inv && inv.durability_left > 0) {
            inv.durability_left = Math.max(0, inv.durability_left - 1);
            await db.query('UPDATE inventory SET durability_left = GREATEST(durability_left - 1, 0) WHERE id = ?', [itemId]);
            if (inv.durability_left <= 0) {
              await db.query('DELETE FROM inventory WHERE id = ?', [itemId]);
              state.equipment = (state.equipment || []).filter((e) => e.id !== itemId);
              state.history.push({ text: `${inv.item_name || 'Equipment'} đã hỏng và bị tiêu hủy.`, type: 'default' });
            }
          }
        }
      } else {
        const isAttackItem = action === 'attack_item' && itemId != null;
        let powerMin = NORMAL_POWER_MIN;
        let powerMax = NORMAL_POWER_MAX;
        let move = 'Normal Attack';
        if (isAttackItem) {
          const inv = state.equipment.find((e) => e.id === itemId);
          if (!inv || inv.durability_left <= 0) return res.status(400).json({ message: 'Item không khả dụng' });
          powerMin = inv.power_min != null ? inv.power_min : 0;
          powerMax = inv.power_max != null ? inv.power_max : 0;
          move = inv.item_name || 'Weapon';
        } else {
          move = 'Normal Attack';
        }
        result = simulateTurn(
          player,
          enemy,
          isAttackItem ? 10 : 10,
          move,
          { power_min: powerMin, power_max: powerMax, defender_current_def_dmg: enemy.current_def_dmg ?? 0 }
        );
        if (result.reflectedDamage > 0) {
          state.history.push({ text: `${result.attacker} đánh, ${result.defender} phản đòn ${result.reflectedDamage} sát thương!`, type: 'enemy_attack' });
        } else {
          state.history.push({ text: `${result.attacker} dùng ${result.moveUsed}${result.critical ? ' (CRIT)' : ''}, gây ${result.damage} sát thương.`, type: 'player_attack' });
        }
        enemy.current_hp = result.defender_hp_after ?? Math.max(0, (enemy.current_hp ?? enemy.final_stats?.hp) - (result.damage || 0));
        enemy.current_def_dmg = 0;
        if (result.attacker_hp_after != null) player.current_hp = result.attacker_hp_after;
        if (isAttackItem && itemId) {
          const inv = state.equipment.find((e) => e.id === itemId);
          if (inv) {
            inv.durability_left = Math.max(0, (inv.durability_left || 1) - 1);
            await db.query('UPDATE inventory SET durability_left = GREATEST(durability_left - 1, 0) WHERE id = ?', [itemId]);
            if (inv.durability_left <= 0) {
              await db.query('DELETE FROM inventory WHERE id = ?', [itemId]);
              state.equipment = (state.equipment || []).filter((e) => e.id !== itemId);
              state.history.push({ text: `${inv.item_name || 'Equipment'} đã hỏng và bị tiêu hủy.`, type: 'default' });
            }
          }
        }
      }
    };

    state.turn_count = (state.turn_count || 0) + 1;

    if (playerGoesFirst) {
      await runPlayerAction();
      if ((enemy.current_hp ?? 0) <= 0) {
        state.finished = true;
        state.result = 'win';
        await finalizeMatchInMySQL(state, 'player');
        await redis.del(key);
        return res.json(state);
      }
      if ((player.current_hp ?? 0) <= 0) {
        state.finished = true;
        state.result = 'lose';
        await finalizeMatchInMySQL(state, 'enemy');
        await redis.del(key);
        return res.json(state);
      }
      await runEnemyTurn();
    } else {
      await runEnemyTurn();
      if ((player.current_hp ?? 0) <= 0) {
        state.finished = true;
        state.result = 'lose';
        await finalizeMatchInMySQL(state, 'enemy');
        await redis.del(key);
        return res.json(state);
      }
      await runPlayerAction();
      if ((enemy.current_hp ?? 0) <= 0) {
        state.finished = true;
        state.result = 'win';
        await finalizeMatchInMySQL(state, 'player');
        await redis.del(key);
        return res.json(state);
      }
    }

    if ((player.current_hp ?? 0) <= 0) {
      state.finished = true;
      state.result = 'lose';
      await finalizeMatchInMySQL(state, 'enemy');
      await redis.del(key);
      return res.json(state);
    }

    await redis.set(key, JSON.stringify(state), { EX: REDIS_MATCH_TTL });
    res.json(state);
  } catch (err) {
    console.error('Error arena match turn:', err);
    res.status(500).json({ message: 'Lỗi xử lý lượt đấu' });
  }
});

// API ARENA: Mô phỏng toàn bộ trận đấu (PvE). Cả hai bên dùng Dmg_out với power_min/power_max.
// body: playerPet, enemyPet, playerMovePower, playerMoveName, enemyMovePower, enemyMoveName, playerPowerMin, playerPowerMax, enemyPowerMin, enemyPowerMax
app.post('/api/arena/simulate-full', (req, res) => {
  const {
    playerPet, enemyPet,
    playerMovePower = 10, playerMoveName = 'Tackle',
    enemyMovePower = 10, enemyMoveName = 'Bite',
    playerPowerMin, playerPowerMax,
    enemyPowerMin, enemyPowerMax,
  } = req.body;

  try {
    const options = {
      playerPowerMin: playerPowerMin != null ? Number(playerPowerMin) : undefined,
      playerPowerMax: playerPowerMax != null ? Number(playerPowerMax) : undefined,
      enemyPowerMin: enemyPowerMin != null ? Number(enemyPowerMin) : undefined,
      enemyPowerMax: enemyPowerMax != null ? Number(enemyPowerMax) : undefined,
    };
    const result = simulateFullBattle(
      playerPet, enemyPet,
      playerMovePower, playerMoveName,
      enemyMovePower, enemyMoveName,
      options
    );
    res.json(result);
  } catch (err) {
    console.error('Error during full battle simulation:', err);
    res.status(500).json({ message: 'Lỗi khi mô phỏng trận đấu' });
  }
});


function randomIntInclusive(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// EXP battle mới:
// - Boss / quái: Exp = Level enemy * R, với R random 300..500
function calculateBattleExpGain(enemyLevel) {
  const lvl = Math.max(1, parseInt(enemyLevel, 10) || 1);
  const r = randomIntInclusive(300, 500);
  return lvl * r;
}

// ✅ API cộng EXP khi thắng trận
app.post('/api/pets/:id/gain-exp', async (req, res) => {
  const petId = req.params.id;
  const { source, enemy_level, custom_amount } = req.body;

  try {
    const [rows] = await pool.promise().query('SELECT * FROM pets WHERE id = ?', [petId]);
    if (!rows.length) return res.status(404).json({ message: 'Pet not found' });

    const pet = rows[0];

    if (pet.owner_id == null) {
      return res.status(403).json({ message: 'Pet không có chủ không được cộng EXP' });
    }

    const gain = custom_amount !== null ? custom_amount : calculateBattleExpGain(enemy_level);
    let newExp = pet.current_exp + gain;
    let newLevel = pet.level;

    while (expTable[newLevel + 1] && newExp >= expTable[newLevel + 1]) {
      newLevel++;
    }

    // ✅ Recalculate stats khi level up
    let updatedStats = null;
    if (newLevel > pet.level) {
      // Lấy base stats từ pet_species
      const [speciesRows] = await pool.promise().query(
        'SELECT base_hp, base_mp, base_str, base_def, base_intelligence, base_spd FROM pet_species WHERE id = ?',
        [pet.pet_species_id]
      );
      
      if (speciesRows.length > 0) {
        const species = speciesRows[0];
        const base = {
          hp: parseInt(species.base_hp),
          mp: parseInt(species.base_mp),
          str: parseInt(species.base_str),
          def: parseInt(species.base_def),
          intelligence: parseInt(species.base_intelligence),
          spd: parseInt(species.base_spd),
        };
        
        const iv = {
          iv_hp: pet.iv_hp,
          iv_mp: pet.iv_mp,
          iv_str: pet.iv_str,
          iv_def: pet.iv_def,
          iv_intelligence: pet.iv_intelligence,
          iv_spd: pet.iv_spd,
        };
        
        updatedStats = calculateFinalStats(base, iv, newLevel);
      }
    }

    // Update database với stats mới nếu level up
    if (updatedStats) {
      await pool.promise().query(
        `UPDATE pets SET 
          current_exp = ?, 
          level = ?, 
          hp = ?, 
          max_hp = ?, 
          mp = ?, 
          max_mp = ?, 
          str = ?, 
          def = ?, 
          intelligence = ?, 
          spd = ?, 
          final_stats = ? 
        WHERE id = ?`,
        [
          newExp, newLevel,
          updatedStats.hp, updatedStats.hp,
          updatedStats.mp, updatedStats.mp,
          updatedStats.str, updatedStats.def, updatedStats.intelligence, updatedStats.spd,
          JSON.stringify(updatedStats),
          petId
        ]
      );
    } else {
      // Chỉ update exp nếu không level up
      await pool.promise().query(
        'UPDATE pets SET current_exp = ? WHERE id = ?',
        [newExp, petId]
      );
    }

    res.json({ 
      id: petId, 
      level: newLevel, 
      current_exp: newExp, 
      gained: gain, 
      source,
      stats_updated: !!updatedStats,
      new_stats: updatedStats,
      old_stats: updatedStats ? {
        hp: pet.hp,
        mp: pet.mp,
        str: pet.str,
        def: pet.def,
        intelligence: pet.intelligence,
        spd: pet.spd
      } : null
    });
  } catch (err) {
    console.error('Lỗi cộng EXP:', err);
    res.status(500).json({ message: 'Server error cộng EXP' });
  }
});

// API: Sửa chữa equipment bị hỏng bằng Repair Kit
app.post('/api/inventory/:id/repair-with-kit', async (req, res) => {
  res.status(410).json({ message: 'Repair system removed. Equipment is destroyed at 0 durability.' });
});

// Hàm tính hiệu quả repair dựa trên rarity
function getRepairEffectiveness(repairKitRarity, equipmentRarity) {
  const effectivenessMap = {
    common: {
      common: 100,
      uncommon: 50,
      rare: 10,
      epic: 0,
      legendary: 0
    },
    rare: {
      common: 100,
      uncommon: 75,
      rare: 50,
      epic: 10,
      legendary: 0
    },
    epic: {
      common: 100,
      uncommon: 85,
      rare: 70,
      epic: 50,
      legendary: 10
    },
    legendary: {
      common: 100,
      uncommon: 100,
      rare: 100,
      epic: 100,
      legendary: 100
    }
  };

  return effectivenessMap[repairKitRarity]?.[equipmentRarity] || 0;
}

// API: Sửa chữa equipment bằng Blacksmith (trả tiền)
app.post('/api/inventory/:id/repair-with-blacksmith', async (req, res) => {
  res.status(410).json({ message: 'Repair system removed. Equipment is destroyed at 0 durability.' });
});

// API: Lấy danh sách equipment bị hỏng của user
app.get('/api/users/:userId/broken-equipment', async (req, res) => {
  res.status(410).json({ message: 'Repair system removed. Equipment is destroyed at 0 durability.' });
});

// ==================== HUNGER STATUS SYSTEM ====================

// API: Lấy thông tin hunger status của pet
app.get('/api/pets/:petId/hunger-status', async (req, res) => {
  const { petId } = req.params;

  try {
    const [rows] = await pool.promise().query(
      `SELECT id, name, hunger_status, hunger_battles, hp, owner_id
       FROM pets WHERE id = ?`,
      [petId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Pet không tồn tại' });
    }

    const pet = rows[0];
    
    // Chuyển đổi status number thành text
    const statusText = getHungerStatusText(pet.hunger_status);
    const canBattle = pet.hunger_status >= 1 && pet.hp > 0;

    res.json({
      pet_id: pet.id,
      pet_name: pet.name,
      hunger_status: pet.hunger_status,
      hunger_status_text: statusText,
      hunger_battles: pet.hunger_battles,
      can_battle: canBattle,
      hp: pet.hp
    });
  } catch (err) {
    console.error('Error fetching pet hunger status:', err);
    res.status(500).json({ message: 'Lỗi khi lấy thông tin hunger status' });
  }
});

// API: Kiểm tra pet có thể đấu không
app.get('/api/pets/:petId/battle-ready', async (req, res) => {
  const { petId } = req.params;

  try {
    const [rows] = await pool.promise().query(
      `SELECT id, name, hunger_status, hunger_battles, hp
       FROM pets WHERE id = ?`,
      [petId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Pet không tồn tại' });
    }

    const pet = rows[0];
    
    // Kiểm tra điều kiện đấu
    const canBattle = pet.hunger_status >= 1 && pet.hp > 0;
    const reasons = [];
    
    if (pet.hunger_status === 0) reasons.push('Pet đang chết đói (cần hồi máu)');
    if (pet.hp <= 0) reasons.push('Pet đã hết máu');

    res.json({
      can_battle: canBattle,
      reasons: reasons,
      hunger_status: pet.hunger_status,
      hunger_status_text: getHungerStatusText(pet.hunger_status),
      hunger_battles: pet.hunger_battles,
      hp: pet.hp
    });
  } catch (err) {
    console.error('Error checking pet battle readiness:', err);
    res.status(500).json({ message: 'Lỗi khi kiểm tra pet' });
  }
});

// API: Sử dụng food item để hồi phục hunger status
app.post('/api/pets/:petId/feed', async (req, res) => {
  const { petId } = req.params;
  const { itemId, userId } = req.body;

  try {
    // Kiểm tra item có trong inventory không
    const [inventoryRows] = await pool.promise().query(
      'SELECT * FROM inventory WHERE item_id = ? AND player_id = ? AND quantity > 0',
      [itemId, userId]
    );

    if (inventoryRows.length === 0) {
      return res.status(400).json({ message: 'Food item không có trong inventory' });
    }

    // Lấy thông tin food recovery
    const [foodRows] = await pool.promise().query(
      'SELECT * FROM food_recovery_items WHERE item_id = ?',
      [itemId]
    );

    if (foodRows.length === 0) {
      return res.status(400).json({ message: 'Item không phải food item' });
    }

    // Lấy thông tin pet
    const [petRows] = await pool.promise().query(
      'SELECT * FROM pets WHERE id = ? AND owner_id = ?',
      [petId, userId]
    );

    if (petRows.length === 0) {
      return res.status(404).json({ message: 'Pet không tồn tại hoặc không thuộc sở hữu' });
    }

    const pet = petRows[0];
    const food = foodRows[0];
    
    // Tính toán status mới
    const oldStatus = pet.hunger_status;
    const newStatus = Math.min(3, oldStatus + food.recovery_amount);
    const oldBattles = pet.hunger_battles;
    const newBattles = 0; // Reset battles sau khi ăn

    // Cập nhật pet
    await pool.promise().query(
      'UPDATE pets SET hunger_status = ?, hunger_battles = ? WHERE id = ?',
      [newStatus, newBattles, petId]
    );

    // Lưu vào history
    await pool.promise().query(
      'INSERT INTO hunger_status_history (pet_id, old_status, new_status, old_battles, new_battles, change_reason, food_item_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [petId, oldStatus, newStatus, oldBattles, newBattles, 'feeding', itemId]
    );

    // Giảm số lượng item
    await pool.promise().query(
      'UPDATE inventory SET quantity = quantity - 1 WHERE item_id = ? AND player_id = ?',
      [itemId, userId]
    );

    // Xóa item nếu hết
    await pool.promise().query(
      'DELETE FROM inventory WHERE item_id = ? AND player_id = ? AND quantity <= 0',
      [itemId, userId]
    );

    res.json({
      message: 'Cho pet ăn thành công',
      old_status: oldStatus,
      new_status: newStatus,
      old_status_text: getHungerStatusText(oldStatus),
      new_status_text: getHungerStatusText(newStatus),
      recovery_amount: food.recovery_amount,
      battles_reset: true
    });

  } catch (err) {
    console.error('Error feeding pet:', err);
    res.status(500).json({ message: 'Lỗi khi cho pet ăn' });
  }
});

// API: Cập nhật hunger status sau battle
app.post('/api/pets/:petId/update-hunger-after-battle', async (req, res) => {
  const { petId } = req.params;

  try {
    const [petRows] = await pool.promise().query(
      'SELECT * FROM pets WHERE id = ?',
      [petId]
    );

    if (petRows.length === 0) {
      return res.status(404).json({ message: 'Pet không tồn tại' });
    }

    const pet = petRows[0];
    const oldStatus = pet.hunger_status;
    const oldBattles = pet.hunger_battles;
    let newStatus = oldStatus;
    let newBattles = oldBattles + 1;
    
    // Logic giảm status dựa trên số trận
    if (oldStatus === 3 && newBattles >= 25) { // Mập mạp -> Hơi đói (25 trận)
      newStatus = 2;
      newBattles = 0;
    } else if (oldStatus === 2 && newBattles >= 15) { // Hơi đói -> Đói (15 trận)
      newStatus = 1;
      newBattles = 0;
    } else if (oldStatus === 1 && newBattles >= 10) { // Đói -> Chết đói (10 trận)
      newStatus = 0;
      newBattles = 0;
      // Set HP về 0 khi chết đói
      await pool.promise().query(
        'UPDATE pets SET hp = 0 WHERE id = ?',
        [petId]
      );
    }

    // Cập nhật status
    await pool.promise().query(
      'UPDATE pets SET hunger_status = ?, hunger_battles = ? WHERE id = ?',
      [newStatus, newBattles, petId]
    );

    // Lưu vào history nếu có thay đổi
    if (oldStatus !== newStatus) {
      await pool.promise().query(
        'INSERT INTO hunger_status_history (pet_id, old_status, new_status, old_battles, new_battles, change_reason) VALUES (?, ?, ?, ?, ?, ?)',
        [petId, oldStatus, newStatus, oldBattles, newBattles, 'battle']
      );
    }

    res.json({
      message: 'Cập nhật hunger status sau battle thành công',
      old_status: oldStatus,
      new_status: newStatus,
      old_status_text: getHungerStatusText(oldStatus),
      new_status_text: getHungerStatusText(newStatus),
      old_battles: oldBattles,
      new_battles: newBattles,
      status_changed: oldStatus !== newStatus
    });

  } catch (err) {
    console.error('Error updating pet hunger status after battle:', err);
    res.status(500).json({ message: 'Lỗi khi cập nhật hunger status' });
  }
});

// Hàm helper để chuyển đổi status number thành text
function getHungerStatusText(status) {
  switch (status) {
    case 0: return 'Chết đói';
    case 1: return 'Đói';
    case 2: return 'Hơi đói';
    case 3: return 'Mập mạp';
    default: return 'Không xác định';
  }
}

// ======================================================== MAIL SYSTEM ========================================================

// GET /api/mails/:userId - Lấy danh sách mail của user
app.get('/api/mails/:userId', async (req, res) => {
  const { userId } = req.params;
  const { filter = 'all' } = req.query; // all, unread, claimed, unclaimed, system, admin, user

  try {
    let whereClause = 'WHERE m.user_id = ?';
    const params = [userId];

    switch (filter) {
      case 'unread':
        whereClause += ' AND m.is_read = FALSE';
        break;
      case 'claimed':
        whereClause += ' AND m.is_claimed = TRUE';
        break;
      case 'unclaimed':
        whereClause += ' AND m.is_claimed = FALSE';
        break;
      case 'system':
        whereClause += ' AND m.sender_type = "system"';
        break;
      case 'admin':
        whereClause += ' AND m.sender_type = "admin"';
        break;
      case 'user':
        whereClause += ' AND m.sender_type = "user"';
        break;
    }

    const [mails] = await db.query(`
      SELECT 
        m.*,
        u.username as sender_username
      FROM mails m
      LEFT JOIN users u ON m.sender_id = u.id
      ${whereClause}
      ORDER BY m.created_at DESC
      LIMIT 100
    `, params);

    res.json(mails);
  } catch (err) {
    console.error('Lỗi khi lấy danh sách mail:', err);
    res.status(500).json({ error: 'Không thể lấy danh sách mail' });
  }
});

// POST /api/mails/claim/:mailId - Claim 1 mail
app.post('/api/mails/claim/:mailId', async (req, res) => {
  const { mailId } = req.params;
  const { userId } = req.body;

  try {
    // 1. Lấy thông tin mail
    const [mailRows] = await db.query(`
      SELECT * FROM mails WHERE id = ? AND user_id = ? AND is_claimed = FALSE
    `, [mailId, userId]);

    if (!mailRows.length) {
      return res.status(404).json({ error: 'Mail không tồn tại hoặc đã claim' });
    }

    const mail = mailRows[0];
    let rewards;
    try {
      // Handle case where attached_rewards is already an object
      if (typeof mail.attached_rewards === 'object') {
        rewards = mail.attached_rewards;
      } else {
        // Handle case where attached_rewards is a string
        rewards = JSON.parse(mail.attached_rewards || '{}');
      }
    } catch (error) {
      console.error('Error parsing rewards for mail:', mail.id, error);
      rewards = {};
    }

    // 2. Cập nhật currency nếu có
    if (rewards.peta) {
      await db.query(`UPDATE users SET peta = peta + ? WHERE id = ?`, [rewards.peta, userId]);
    }
    if (rewards.peta_gold) {
      await db.query(`UPDATE users SET petagold = petagold + ? WHERE id = ?`, [rewards.peta_gold, userId]);
    }

    // 3. Thêm items vào inventory nếu có
    if (rewards.items && rewards.items.length > 0) {
      for (const item of rewards.items) {
        const [invRows] = await db.query(`
          SELECT id, quantity FROM inventory 
          WHERE player_id = ? AND item_id = ? AND is_equipped = 0
        `, [userId, item.item_id]);

        if (invRows.length > 0) {
          // Cập nhật quantity nếu item đã có
          await db.query(`
            UPDATE inventory SET quantity = quantity + ? WHERE id = ?
          `, [item.quantity, invRows[0].id]);
        } else {
          // Thêm item mới
          await db.query(`
            INSERT INTO inventory (player_id, item_id, quantity) VALUES (?, ?, ?)
          `, [userId, item.item_id, item.quantity]);
        }
      }
    }

    // 4. Thêm spirits vào user_spirits nếu có
    if (rewards.spirits && rewards.spirits.length > 0) {
      for (const spirit of rewards.spirits) {
        for (let i = 0; i < spirit.quantity; i++) {
          await db.query(`
            INSERT INTO user_spirits (user_id, spirit_id, is_equipped, equipped_pet_id)
            VALUES (?, ?, FALSE, NULL)
          `, [userId, spirit.spirit_id]);
        }
      }
    }

    // 5. Thêm pets nếu có
    if (rewards.pets && rewards.pets.length > 0) {
      for (const pet of rewards.pets) {
        for (let i = 0; i < pet.quantity; i++) {
          // Lấy thông tin pet từ database
          const [petRows] = await db.query(`
            SELECT * FROM pets WHERE id = ?
          `, [pet.pet_id]);
          
          if (petRows.length > 0) {
            const originalPet = petRows[0];
            // Tạo pet mới cho user
            await db.query(`
              INSERT INTO pets (owner_id, species_id, name, level, exp, hp, mp, str, def, spd, intelligence, 
                              iv_hp, iv_mp, iv_str, iv_def, iv_spd, iv_intelligence, image, is_deployed)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE)
            `, [
              userId, originalPet.species_id, originalPet.name, originalPet.level, originalPet.exp,
              originalPet.hp, originalPet.mp, originalPet.str, originalPet.def, originalPet.spd, originalPet.intelligence,
              originalPet.iv_hp, originalPet.iv_mp, originalPet.iv_str, originalPet.iv_def, originalPet.iv_spd, originalPet.iv_intelligence,
              originalPet.image
            ]);
          }
        }
      }
    }

    // 4. Đánh dấu mail đã claim
    await db.query(`
      UPDATE mails SET is_claimed = TRUE WHERE id = ?
    `, [mailId]);

    res.json({ 
      success: true, 
      message: 'Claim thành công!',
      rewards: rewards
    });

  } catch (err) {
    console.error('Lỗi khi claim mail:', err);
    res.status(500).json({ error: 'Lỗi khi claim mail' });
  }
});

// POST /api/mails/claim-all/:userId - Claim tất cả mail chưa claim
app.post('/api/mails/claim-all/:userId', async (req, res) => {
  const { userId } = req.params;
  const { userId: bodyUserId } = req.body;
  
  // Sử dụng userId từ body nếu có, không thì dùng params
  const targetUserId = bodyUserId || userId;

  try {
    // 1. Lấy tất cả mail chưa claim
    const [mails] = await db.query(`
      SELECT * FROM mails WHERE user_id = ? AND is_claimed = FALSE
    `, [targetUserId]);

    let totalPeta = 0;
    let totalPetaGold = 0;
    const itemsToAdd = {};
    const spiritsToAdd = {};
    const petsToAdd = {};

    // 2. Tính tổng rewards
    for (const mail of mails) {
      let rewards;
      try {
        // Handle case where attached_rewards is already an object
        if (typeof mail.attached_rewards === 'object') {
          rewards = mail.attached_rewards;
        } else {
          // Handle case where attached_rewards is a string
          rewards = JSON.parse(mail.attached_rewards || '{}');
        }
      } catch (error) {
        console.error('Error parsing rewards for mail:', mail.id, error);
        rewards = {};
      }
      
      if (rewards.peta) totalPeta += rewards.peta;
      if (rewards.peta_gold) totalPetaGold += rewards.peta_gold;
      
      if (rewards.items) {
        for (const item of rewards.items) {
          const key = item.item_id;
          itemsToAdd[key] = (itemsToAdd[key] || 0) + item.quantity;
        }
      }

      if (rewards.spirits) {
        for (const spirit of rewards.spirits) {
          const key = spirit.spirit_id;
          spiritsToAdd[key] = (spiritsToAdd[key] || 0) + spirit.quantity;
        }
      }

      if (rewards.pets) {
        for (const pet of rewards.pets) {
          const key = pet.pet_id;
          petsToAdd[key] = (petsToAdd[key] || 0) + pet.quantity;
        }
      }
    }

    // 3. Cập nhật currency
    if (totalPeta > 0) {
      await db.query(`UPDATE users SET peta = peta + ? WHERE id = ?`, [totalPeta, targetUserId]);
    }
    if (totalPetaGold > 0) {
      await db.query(`UPDATE users SET petagold = petagold + ? WHERE id = ?`, [totalPetaGold, targetUserId]);
    }

    // 4. Thêm items
    for (const [itemId, quantity] of Object.entries(itemsToAdd)) {
      const [invRows] = await db.query(`
        SELECT id, quantity FROM inventory 
        WHERE player_id = ? AND item_id = ? AND is_equipped = 0
      `, [targetUserId, itemId]);

      if (invRows.length > 0) {
        await db.query(`
          UPDATE inventory SET quantity = quantity + ? WHERE id = ?
        `, [quantity, invRows[0].id]);
      } else {
        await db.query(`
          INSERT INTO inventory (player_id, item_id, quantity) VALUES (?, ?, ?)
        `, [targetUserId, itemId, quantity]);
      }
    }

    // 5. Thêm spirits
    for (const [spiritId, quantity] of Object.entries(spiritsToAdd)) {
      for (let i = 0; i < quantity; i++) {
        await db.query(`
          INSERT INTO user_spirits (user_id, spirit_id, is_equipped, equipped_pet_id)
          VALUES (?, ?, FALSE, NULL)
        `, [targetUserId, spiritId]);
      }
    }

    // 6. Thêm pets
    for (const [petId, quantity] of Object.entries(petsToAdd)) {
      for (let i = 0; i < quantity; i++) {
        // Lấy thông tin pet từ database
        const [petRows] = await db.query(`
          SELECT * FROM pets WHERE id = ?
        `, [petId]);
        
        if (petRows.length > 0) {
          const originalPet = petRows[0];
          // Tạo pet mới cho user
          await db.query(`
            INSERT INTO pets (owner_id, species_id, name, level, exp, hp, mp, str, def, spd, intelligence, 
                            iv_hp, iv_mp, iv_str, iv_def, iv_spd, iv_intelligence, image, is_deployed)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE)
          `, [
            targetUserId, originalPet.species_id, originalPet.name, originalPet.level, originalPet.exp,
            originalPet.hp, originalPet.mp, originalPet.str, originalPet.def, originalPet.spd, originalPet.intelligence,
            originalPet.iv_hp, originalPet.iv_mp, originalPet.iv_str, originalPet.iv_def, originalPet.iv_spd, originalPet.iv_intelligence,
            originalPet.image
          ]);
        }
      }
    }

    // 5. Đánh dấu tất cả mail đã claim
    await db.query(`
      UPDATE mails SET is_claimed = TRUE WHERE user_id = ? AND is_claimed = FALSE
    `, [targetUserId]);

    res.json({ 
      success: true, 
      message: `Claim thành công ${mails.length} mail!`,
      totalPeta,
      totalPetaGold,
      totalItems: Object.keys(itemsToAdd).length,
      totalSpirits: Object.keys(spiritsToAdd).length,
      totalPets: Object.keys(petsToAdd).length
    });

  } catch (err) {
    console.error('Lỗi khi claim all mail:', err);
    res.status(500).json({ error: 'Lỗi khi claim tất cả mail' });
  }
});

// PUT /api/mails/:mailId/read - Đánh dấu đã đọc
app.put('/api/mails/:mailId/read', async (req, res) => {
  const { mailId } = req.params;
  const { userId } = req.body;

  try {
    const result = await db.query(`
      UPDATE mails SET is_read = TRUE 
      WHERE id = ? AND user_id = ?
    `, [mailId, userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Mail không tồn tại' });
    }

    res.json({ success: true, message: 'Đã đánh dấu đọc' });
  } catch (err) {
    console.error('Lỗi khi đánh dấu đọc:', err);
    res.status(500).json({ error: 'Lỗi khi đánh dấu đọc' });
  }
});

// DELETE /api/mails/:mailId - Xóa mail
app.delete('/api/mails/:mailId', async (req, res) => {
  const { mailId } = req.params;
  const { userId } = req.body;

  try {
    const result = await db.query(`
      DELETE FROM mails WHERE id = ? AND user_id = ?
    `, [mailId, userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Mail không tồn tại' });
    }

    res.json({ success: true, message: 'Đã xóa mail' });
  } catch (err) {
    console.error('Lỗi khi xóa mail:', err);
    res.status(500).json({ error: 'Lỗi khi xóa mail' });
  }
});

// GET /api/mails/:userId/unread-count - Đếm mail chưa đọc
app.get('/api/mails/:userId/unread-count', async (req, res) => {
  const { userId } = req.params;

  try {
    const [result] = await db.query(`
      SELECT 
        COUNT(*) as total_unread,
        COUNT(CASE WHEN is_claimed = FALSE THEN 1 END) as unclaimed_count
      FROM mails 
      WHERE user_id = ? AND is_read = FALSE
    `, [userId]);

    res.json({
      unread_count: result[0].total_unread,
      unclaimed_count: result[0].unclaimed_count
    });
  } catch (err) {
    console.error('Lỗi khi đếm mail:', err);
    res.status(500).json({ error: 'Lỗi khi đếm mail' });
  }
});

// ======================================================== ADMIN MAIL APIs ========================================================

// POST /api/admin/mails/send - Admin gửi mail
app.post('/api/admin/mails/send', async (req, res) => {
  const { 
    user_id, 
    sender_name, 
    subject, 
    message, 
    attached_rewards,
    expire_days = 30 
  } = req.body;

  try {
    const expireAt = new Date();
    expireAt.setDate(expireAt.getDate() + expire_days);

    const rewardsJson = attached_rewards ? JSON.stringify(attached_rewards) : null;
    
    await db.query(`
      INSERT INTO mails (user_id, sender_type, sender_name, subject, message, attached_rewards, expire_at)
      VALUES (?, 'admin', ?, ?, ?, ?, ?)
    `, [user_id, sender_name, subject, message, rewardsJson, expireAt]);

    res.json({ success: true, message: 'Gửi mail thành công!' });
  } catch (err) {
    console.error('Lỗi khi gửi mail:', err);
    res.status(500).json({ error: 'Lỗi khi gửi mail' });
  }
});

// ======================================================== MAIL CLEANUP ========================================================

// Auto cleanup expired mails (có thể chạy bằng cron job)
app.post('/api/admin/mails/cleanup', async (req, res) => {
  try {
    const result = await db.query(`
      DELETE FROM mails 
      WHERE expire_at < NOW() 
      OR (is_read = TRUE AND is_claimed = TRUE AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY))
    `);

    res.json({ 
      success: true, 
      message: `Đã xóa ${result.affectedRows} mail`,
      deleted_count: result.affectedRows
    });
  } catch (err) {
    console.error('Lỗi khi cleanup mail:', err);
    res.status(500).json({ error: 'Lỗi khi cleanup mail' });
  }
});

// ======================================================== ADMIN PETS API ========================================================

// GET /api/admin/pets - Lấy danh sách tất cả pets cho admin
app.get('/api/admin/pets', async (req, res) => {
  try {
    const [pets] = await db.query(`
      SELECT p.*, ps.name as species_name
      FROM pets p
      LEFT JOIN pet_species ps ON p.species_id = ps.id
      ORDER BY p.level DESC, p.name ASC
    `);

    res.json(pets);
  } catch (err) {
    console.error('Lỗi khi lấy danh sách pets:', err);
    res.status(500).json({ error: 'Lỗi khi lấy danh sách pets' });
  }
});

// ======================================================== SPIRIT SYSTEM APIs ========================================================

// GET /api/spirits - Lấy danh sách tất cả Linh Thú
app.get('/api/spirits', async (req, res) => {
  try {
    const [spirits] = await db.query(`
      SELECT s.*, 
             COUNT(ss.id) as stats_count
      FROM spirits s
      LEFT JOIN spirit_stats ss ON s.id = ss.spirit_id
      GROUP BY s.id
      ORDER BY s.rarity DESC, s.name ASC
    `);

    // Lấy stats cho từng spirit
    for (let spirit of spirits) {
      const [stats] = await db.query(`
        SELECT stat_type, stat_value, stat_modifier
        FROM spirit_stats 
        WHERE spirit_id = ?
        ORDER BY stat_type
      `, [spirit.id]);
      spirit.stats = stats;
    }

    res.json(spirits);
  } catch (err) {
    console.error('Lỗi khi lấy danh sách spirits:', err);
    res.status(500).json({ error: 'Lỗi khi lấy danh sách spirits' });
  }
});

// GET /api/users/:userId/spirits - Lấy Linh Thú của user
app.get('/api/users/:userId/spirits', async (req, res) => {
  const { userId } = req.params;
  
  try {
    const [userSpirits] = await db.query(`
      SELECT us.*, s.name, s.description, s.image_url, s.rarity, s.max_stats_count,
             p.name as equipped_pet_name
      FROM user_spirits us
      JOIN spirits s ON us.spirit_id = s.id
      LEFT JOIN pets p ON us.equipped_pet_id = p.id
      WHERE us.user_id = ?
      ORDER BY us.is_equipped DESC, s.rarity DESC, s.name ASC
    `, [userId]);

    // Lấy stats cho từng spirit
    for (let userSpirit of userSpirits) {
      const [stats] = await db.query(`
        SELECT stat_type, stat_value, stat_modifier
        FROM spirit_stats 
        WHERE spirit_id = ?
        ORDER BY stat_type
      `, [userSpirit.spirit_id]);
      userSpirit.stats = stats;
    }

    res.json(userSpirits);
  } catch (err) {
    console.error('Lỗi khi lấy spirits của user:', err);
    res.status(500).json({ error: 'Lỗi khi lấy spirits của user' });
  }
});

// GET /api/pets/:petId/spirits - Lấy Linh Thú đang trang bị của pet
app.get('/api/pets/:petId/spirits', async (req, res) => {
  const { petId } = req.params;
  
  try {
    const [equippedSpirits] = await db.query(`
      SELECT us.*, s.name, s.description, s.image_url, s.rarity, s.max_stats_count
      FROM user_spirits us
      JOIN spirits s ON us.spirit_id = s.id
      WHERE us.equipped_pet_id = ? AND us.is_equipped = 1
      ORDER BY s.rarity DESC, s.name ASC
    `, [petId]);

    // Lấy stats cho từng spirit
    for (let spirit of equippedSpirits) {
      const [stats] = await db.query(`
        SELECT stat_type, stat_value, stat_modifier
        FROM spirit_stats 
        WHERE spirit_id = ?
        ORDER BY stat_type
      `, [spirit.spirit_id]);
      spirit.stats = stats;
    }

    res.json(equippedSpirits);
  } catch (err) {
    console.error('Lỗi khi lấy spirits của pet:', err);
    res.status(500).json({ error: 'Lỗi khi lấy spirits của pet' });
  }
});

// POST /api/spirits/equip - Trang bị Linh Thú cho pet
app.post('/api/spirits/equip', async (req, res) => {
  const { userSpiritId, petId } = req.body;
  
  try {
    // Kiểm tra xem pet có phải của user không
    const [petCheck] = await db.query(`
      SELECT owner_id FROM pets WHERE id = ?
    `, [petId]);
    
    if (petCheck.length === 0) {
      return res.status(404).json({ error: 'Pet không tồn tại' });
    }

    // Kiểm tra xem user spirit có tồn tại và thuộc về user không
    const [userSpiritCheck] = await db.query(`
      SELECT us.*, s.max_stats_count,
             (SELECT COUNT(*) FROM user_spirits WHERE equipped_pet_id = ? AND is_equipped = 1) as current_spirits_count
      FROM user_spirits us
      JOIN spirits s ON us.spirit_id = s.id
      WHERE us.id = ? AND us.user_id = ?
    `, [petId, userSpiritId, petCheck[0].owner_id]);

    if (userSpiritCheck.length === 0) {
      return res.status(404).json({ error: 'Linh Thú không tồn tại hoặc không thuộc về bạn' });
    }

    const spirit = userSpiritCheck[0];
    
    // Kiểm tra giới hạn số lượng spirits (tối đa 4)
    if (spirit.current_spirits_count >= 4) {
      return res.status(400).json({ error: 'Pet đã trang bị tối đa 4 Linh Thú' });
    }

    // Kiểm tra xem spirit đã được trang bị chưa
    if (spirit.is_equipped) {
      return res.status(400).json({ error: 'Linh Thú này đã được trang bị' });
    }

    // Trang bị spirit
    await db.query(`
      UPDATE user_spirits 
      SET equipped_pet_id = ?, is_equipped = 1
      WHERE id = ?
    `, [petId, userSpiritId]);

    // ✅ Cập nhật pet stats sau khi equip spirit
    await db.query('CALL recalculate_pet_stats(?)', [petId]);

    res.json({ 
      success: true, 
      message: 'Trang bị Linh Thú thành công!',
      spirit_id: spirit.spirit_id
    });
  } catch (err) {
    console.error('Lỗi khi trang bị spirit:', err);
    res.status(500).json({ error: 'Lỗi khi trang bị spirit' });
  }
});

// POST /api/spirits/unequip - Tháo Linh Thú khỏi pet
app.post('/api/spirits/unequip', async (req, res) => {
  const { userSpiritId } = req.body;
  
  try {
    // Kiểm tra xem user spirit có tồn tại và đang được trang bị không
    const [userSpiritCheck] = await db.query(`
      SELECT * FROM user_spirits WHERE id = ? AND is_equipped = 1
    `, [userSpiritId]);

    if (userSpiritCheck.length === 0) {
      return res.status(404).json({ error: 'Linh Thú không tồn tại hoặc chưa được trang bị' });
    }

    const petId = userSpiritCheck[0].equipped_pet_id;

    // Chuẩn hóa current_hp để tránh vi phạm chk_current_hp_valid khi hệ thống recalculation/trigger chạy
    if (petId != null) {
      const [petRows] = await db.query('SELECT id, current_hp, max_hp, final_stats FROM pets WHERE id = ?', [petId]);
      if (petRows.length > 0) {
        const pet = petRows[0];
        let maxHp = pet.max_hp != null ? Number(pet.max_hp) : null;
        if (pet.final_stats) {
          try {
            const fs = typeof pet.final_stats === 'string' ? JSON.parse(pet.final_stats) : pet.final_stats;
            if (fs && fs.hp != null) maxHp = Number(fs.hp);
          } catch (_) {}
        }
        const maxHpVal = maxHp != null && maxHp > 0 ? maxHp : 1;
        const curHp = pet.current_hp != null ? Number(pet.current_hp) : maxHpVal;
        const validHp = Math.max(0, Math.min(curHp, maxHpVal));
        await db.query('UPDATE pets SET current_hp = ? WHERE id = ?', [validHp, petId]);
      }
    }
    
    // Tháo spirit
    await db.query(`
      UPDATE user_spirits 
      SET equipped_pet_id = NULL, is_equipped = 0
      WHERE id = ?
    `, [userSpiritId]);

    // ✅ Cập nhật pet stats sau khi unequip spirit
    await db.query('CALL recalculate_pet_stats(?)', [petId]);

    res.json({ 
      success: true, 
      message: 'Tháo Linh Thú thành công!',
      spirit_id: userSpiritCheck[0].spirit_id
    });
  } catch (err) {
    console.error('Lỗi khi tháo spirit:', err);
    res.status(500).json({ error: 'Lỗi khi tháo spirit' });
  }
});

// POST /api/spirits/claim - Nhận Linh Thú (từ shop, mail, etc.)
app.post('/api/spirits/claim', async (req, res) => {
  const { userId, spiritId } = req.body;
  
  try {
    // Kiểm tra xem spirit có tồn tại không
    const [spiritCheck] = await db.query(`
      SELECT * FROM spirits WHERE id = ?
    `, [spiritId]);

    if (spiritCheck.length === 0) {
      return res.status(404).json({ error: 'Linh Thú không tồn tại' });
    }

    // Kiểm tra xem user đã có spirit này chưa
    const [existingSpirit] = await db.query(`
      SELECT * FROM user_spirits WHERE user_id = ? AND spirit_id = ?
    `, [userId, spiritId]);

    if (existingSpirit.length > 0) {
      return res.status(400).json({ error: 'Bạn đã sở hữu Linh Thú này rồi' });
    }

    // Thêm spirit cho user
    await db.query(`
      INSERT INTO user_spirits (user_id, spirit_id, is_equipped, equipped_pet_id)
      VALUES (?, ?, 0, NULL)
    `, [userId, spiritId]);

    res.json({ 
      success: true, 
      message: 'Nhận Linh Thú thành công!',
      spirit_id: spiritId
    });
  } catch (err) {
    console.error('Lỗi khi nhận spirit:', err);
    res.status(500).json({ error: 'Lỗi khi nhận spirit' });
  }
});

// ======================================================== ADMIN SPIRIT APIs ========================================================

// GET /api/admin/spirits - Danh sách Linh Thú cho admin (kèm stats)
app.get('/api/admin/spirits', checkAdminRoleNpc, async (req, res) => {
  try {
    const [spirits] = await db.query(`
      SELECT s.*, COUNT(ss.id) AS stats_count
      FROM spirits s
      LEFT JOIN spirit_stats ss ON s.id = ss.spirit_id
      GROUP BY s.id
      ORDER BY s.id
    `);
    for (const spirit of spirits) {
      const [stats] = await db.query(
        'SELECT stat_type, stat_value, stat_modifier FROM spirit_stats WHERE spirit_id = ? ORDER BY stat_type',
        [spirit.id]
      );
      spirit.stats = stats;
    }
    res.json(spirits);
  } catch (err) {
    console.error('Lỗi khi lấy danh sách spirits (admin):', err);
    res.status(500).json({ error: 'Lỗi khi lấy danh sách spirits' });
  }
});

// POST /api/admin/spirits - Tạo Linh Thú mới
app.post('/api/admin/spirits', checkAdminRoleNpc, async (req, res) => {
  const { name, description, image_url, rarity, max_stats_count, stats } = req.body;
  
  try {
    // Tạo spirit mới
    const [result] = await db.query(`
      INSERT INTO spirits (name, description, image_url, rarity, max_stats_count)
      VALUES (?, ?, ?, ?, ?)
    `, [name, description, image_url, rarity, max_stats_count]);

    const spiritId = result.insertId;

    // Thêm stats cho spirit
    if (stats && Array.isArray(stats)) {
      for (let stat of stats) {
        await db.query(`
          INSERT INTO spirit_stats (spirit_id, stat_type, stat_value, stat_modifier)
          VALUES (?, ?, ?, ?)
        `, [spiritId, stat.stat_type, stat.stat_value, stat.stat_modifier || 'flat']);
      }
    }

    res.json({ 
      success: true, 
      message: 'Tạo Linh Thú thành công!',
      spirit_id: spiritId
    });
  } catch (err) {
    console.error('Lỗi khi tạo spirit:', err);
    res.status(500).json({ error: 'Lỗi khi tạo spirit' });
  }
});

// PUT /api/admin/spirits/:id - Cập nhật Linh Thú
app.put('/api/admin/spirits/:id', checkAdminRoleNpc, async (req, res) => {
  const { id } = req.params;
  const { name, description, image_url, rarity, max_stats_count, stats } = req.body;
  
  try {
    // Cập nhật thông tin cơ bản
    await db.query(`
      UPDATE spirits 
      SET name = ?, description = ?, image_url = ?, rarity = ?, max_stats_count = ?
      WHERE id = ?
    `, [name, description, image_url, rarity, max_stats_count, id]);

    // Xóa stats cũ và thêm stats mới
    await db.query(`DELETE FROM spirit_stats WHERE spirit_id = ?`, [id]);

    if (stats && Array.isArray(stats)) {
      for (let stat of stats) {
        await db.query(`
          INSERT INTO spirit_stats (spirit_id, stat_type, stat_value, stat_modifier)
          VALUES (?, ?, ?, ?)
        `, [id, stat.stat_type, stat.stat_value, stat.stat_modifier || 'flat']);
      }
    }

    res.json({ 
      success: true, 
      message: 'Cập nhật Linh Thú thành công!',
      spirit_id: id
    });
  } catch (err) {
    console.error('Lỗi khi cập nhật spirit:', err);
    res.status(500).json({ error: 'Lỗi khi cập nhật spirit' });
  }
});

// DELETE /api/admin/spirits/:id - Xóa Linh Thú
app.delete('/api/admin/spirits/:id', checkAdminRoleNpc, async (req, res) => {
  const { id } = req.params;
  
  try {
    // Kiểm tra xem có user nào đang sở hữu spirit này không
    const [userSpirits] = await db.query(`
      SELECT COUNT(*) as count FROM user_spirits WHERE spirit_id = ?
    `, [id]);

    if (userSpirits[0].count > 0) {
      return res.status(400).json({ 
        error: 'Không thể xóa Linh Thú này vì có người chơi đang sở hữu' 
      });
    }

    // Xóa stats trước
    await db.query(`DELETE FROM spirit_stats WHERE spirit_id = ?`, [id]);
    
    // Xóa spirit
    await db.query(`DELETE FROM spirits WHERE id = ?`, [id]);

    res.json({ 
      success: true, 
      message: 'Xóa Linh Thú thành công!'
    });
  } catch (err) {
    console.error('Lỗi khi xóa spirit:', err);
    res.status(500).json({ error: 'Lỗi khi xóa spirit' });
  }
});

// GET /api/admin/spirits/:id - Lấy chi tiết Linh Thú cho admin
app.get('/api/admin/spirits/:id', checkAdminRoleNpc, async (req, res) => {
  const { id } = req.params;
  
  try {
    const [spirits] = await db.query(`
      SELECT * FROM spirits WHERE id = ?
    `, [id]);

    if (spirits.length === 0) {
      return res.status(404).json({ error: 'Linh Thú không tồn tại' });
    }

    const spirit = spirits[0];

    // Lấy stats
    const [stats] = await db.query(`
      SELECT stat_type, stat_value, stat_modifier
      FROM spirit_stats 
      WHERE spirit_id = ?
      ORDER BY stat_type
    `, [id]);

    spirit.stats = stats;

    res.json(spirit);
  } catch (err) {
    console.error('Lỗi khi lấy chi tiết spirit:', err);
    res.status(500).json({ error: 'Lỗi khi lấy chi tiết spirit' });
  }
});

// GET /api/admin/spirits/csv - Tải CSV spirits
app.get('/api/admin/spirits/csv', checkAdminRoleNpc, async (req, res) => {
  try {
    const [spirits] = await db.query('SELECT * FROM spirits ORDER BY id');
    const headers = ['id', 'name', 'description', 'image_url', 'rarity', 'max_stats_count', 'stats_json'];
    const lines = [headers.join(',')];
    for (const spirit of spirits) {
      const [stats] = await db.query(
        'SELECT stat_type, stat_value, stat_modifier FROM spirit_stats WHERE spirit_id = ? ORDER BY stat_type',
        [spirit.id]
      );
      const row = {
        ...spirit,
        stats_json: JSON.stringify(stats || []),
      };
      lines.push(headers.map((h) => escapeCSV(row[h])).join(','));
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=spirits.csv');
    res.send('\uFEFF' + lines.join('\n'));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// POST /api/admin/spirits/csv - Upload CSV spirits
app.post('/api/admin/spirits/csv', checkAdminRoleNpc, uploadMemory.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) return res.status(400).json({ message: 'Thiếu file CSV' });
    const text = req.file.buffer.toString('utf8');
    const { headers, rows } = parseCSV(text);
    const required = ['name', 'image_url'];
    const h = headers.map((x) => x.toLowerCase().trim());
    if (!required.every((k) => h.includes(k))) return res.status(400).json({ message: 'CSV thiếu cột: ' + required.join(', ') });
    let updated = 0;
    let inserted = 0;

    for (const row of rows) {
      const o = {};
      headers.forEach((col, i) => { o[col.toLowerCase().trim()] = row[i]; });
      const idRaw = o.id != null && String(o.id).trim() !== '' ? parseInt(o.id, 10) : null;
      const id = idRaw != null && !isNaN(idRaw) ? idRaw : null;
      const maxStatsCount = o.max_stats_count != null && o.max_stats_count !== '' ? parseInt(o.max_stats_count, 10) : 2;
      let stats = [];
      if (o.stats_json && String(o.stats_json).trim()) {
        try {
          const parsed = JSON.parse(o.stats_json);
          if (Array.isArray(parsed)) stats = parsed;
        } catch (_) {}
      }

      let doUpdate = false;
      if (id != null) {
        const [ex] = await db.query('SELECT 1 FROM spirits WHERE id = ? LIMIT 1', [id]);
        doUpdate = ex && ex.length > 0;
      }

      let spiritId = id;
      if (doUpdate) {
        await db.query(
          'UPDATE spirits SET name=?, description=?, image_url=?, rarity=?, max_stats_count=? WHERE id=?',
          [o.name ?? '', o.description ?? '', o.image_url ?? '', o.rarity ?? 'common', isNaN(maxStatsCount) ? 2 : maxStatsCount, id]
        );
        await db.query('DELETE FROM spirit_stats WHERE spirit_id = ?', [id]);
        updated++;
      } else {
        const [ins] = await db.query(
          'INSERT INTO spirits (name, description, image_url, rarity, max_stats_count) VALUES (?, ?, ?, ?, ?)',
          [o.name ?? '', o.description ?? '', o.image_url ?? '', o.rarity ?? 'common', isNaN(maxStatsCount) ? 2 : maxStatsCount]
        );
        spiritId = ins.insertId;
        inserted++;
      }

      if (Array.isArray(stats)) {
        for (const stat of stats) {
          await db.query(
            'INSERT INTO spirit_stats (spirit_id, stat_type, stat_value, stat_modifier) VALUES (?, ?, ?, ?)',
            [
              spiritId,
              stat.stat_type ?? 'hp',
              stat.stat_value != null && !isNaN(Number(stat.stat_value)) ? Number(stat.stat_value) : 0,
              stat.stat_modifier === 'percentage' ? 'percentage' : 'flat',
            ]
          );
        }
      }
    }

    res.json({ success: true, updated, inserted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ======================================================== SPIRIT STATS CALCULATION ========================================================

// Hàm tính toán stats từ spirits cho pet
async function calculateSpiritStats(petId) {
  try {
    const [equippedSpirits] = await db.query(`
      SELECT us.spirit_id, ss.stat_type, ss.stat_value, ss.stat_modifier
      FROM user_spirits us
      JOIN spirit_stats ss ON us.spirit_id = ss.spirit_id
      WHERE us.equipped_pet_id = ? AND us.is_equipped = 1
    `, [petId]);

    const spiritStats = {
      hp: 0,
      mp: 0,
      str: 0,
      def: 0,
      spd: 0,
      intelligence: 0
    };

    for (let spiritStat of equippedSpirits) {
      const statType = spiritStat.stat_type;
      const value = spiritStat.stat_value;
      const modifier = spiritStat.stat_modifier;

      if (modifier === 'percentage') {
        // Percentage modifier sẽ được tính sau khi có base stats
        spiritStats[`${statType}_percent`] = (spiritStats[`${statType}_percent`] || 0) + value;
      } else {
        // Flat modifier
        spiritStats[statType] += value;
      }
    }

    return spiritStats;
  } catch (err) {
    console.error('Lỗi khi tính toán spirit stats:', err);
    return {
      hp: 0, mp: 0, str: 0, def: 0, spd: 0, intelligence: 0
    };
  }
}

// Export function để sử dụng trong battle engine
module.exports = {
  calculateSpiritStats
};


// Trong server.js - Thêm API mới để lấy battle stats
app.get('/api/pets/:petId/battle-stats', async (req, res) => {
  const { petId } = req.params;
  
  try {
    // Lấy pet data với stats đã được tính toán (cached)
    const [petRows] = await db.query(`
      SELECT p.*, ps.name as species_name, ps.image
      FROM pets p
      JOIN pet_species ps ON p.pet_species_id = ps.id
      WHERE p.id = ?
    `, [petId]);
    
    if (!petRows.length) {
      return res.status(404).json({ message: 'Pet not found' });
    }
    
    const pet = petRows[0];
    
    // Lấy equipment (chỉ để hiển thị, không tính vào stats)
    const [equipmentRows] = await db.query(`
      SELECT i.id, i.item_id, it.name AS item_name, it.image_url, i.durability_left,
             ed.equipment_type, ed.magic_value AS power, ed.durability_max AS max_durability, i.is_broken
      FROM inventory i
      JOIN items it ON i.item_id = it.id
      LEFT JOIN equipment_data ed ON it.id = ed.item_id
      WHERE i.equipped_pet_id = ? AND i.is_equipped = 1 AND i.is_broken = 0
    `, [petId]);
    
    // Lấy spirits
    const [spiritRows] = await db.query(`
      SELECT us.*, s.name, s.description, s.image_url, s.rarity
      FROM user_spirits us
      JOIN spirits s ON us.spirit_id = s.id
      WHERE us.equipped_pet_id = ? AND us.is_equipped = 1
    `, [petId]);
    
    // Base stats: ưu tiên final_stats (JSON) trong DB, fallback sang cột hp/str/def...
    let baseStats = { hp: pet.hp, mp: pet.mp, str: pet.str, def: pet.def, spd: pet.spd, intelligence: pet.intelligence };
    if (pet.final_stats) {
      try {
        const parsed = typeof pet.final_stats === 'string' ? JSON.parse(pet.final_stats) : pet.final_stats;
        if (parsed && typeof parsed === 'object') {
          baseStats = {
            hp: parsed.hp ?? baseStats.hp,
            mp: parsed.mp ?? baseStats.mp,
            str: parsed.str ?? baseStats.str,
            def: parsed.def ?? baseStats.def,
            spd: parsed.spd ?? baseStats.spd,
            intelligence: parsed.intelligence ?? baseStats.intelligence,
          };
        }
      } catch (_) {}
    }
    // Cộng bonus từ linh thú (spirit) để ra battle stats dùng trong trận đấu
    const spiritBonus = await calculateSpiritStats(petId);
    const statKeys = ['hp', 'mp', 'str', 'def', 'spd', 'intelligence'];
    const battleStats = {};
    for (const key of statKeys) {
      const base = Number(baseStats[key]) || 0;
      const flat = Number(spiritBonus[key]) || 0;
      const pct = Number(spiritBonus[`${key}_percent`]) || 0;
      battleStats[key] = Math.max(0, Math.floor(base + flat + (base * pct / 100)));
    }
    
    res.json({
      pet: { ...pet, final_stats: battleStats },
      equipment: equipmentRows,
      spirits: spiritRows,
      battle_stats: battleStats
    });
    
  } catch (err) {
    console.error('Error getting battle stats:', err);
    res.status(500).json({ message: 'Error getting battle stats' });
  }
});


// Sử dụng vật phẩm
app.post('/api/pets/:petId/use-item', async (req, res) => {
  const { petId } = req.params;
  const { item_id, quantity = 1, userId } = req.body;

  try {
    // 1. Kiểm tra pet thuộc về user
    const [petRows] = await db.query('SELECT * FROM pets WHERE id = ? AND owner_id = ?', [petId, userId]);
    if (!petRows.length) {
      return res.status(404).json({ message: 'Pet not found' });
    }

    // 2. Kiểm tra inventory có item không
    const [inventoryRows] = await db.query('SELECT * FROM inventory WHERE player_id = ? AND item_id = ? AND quantity >= ?', 
      [userId, item_id, quantity]);
    if (!inventoryRows.length) {
      return res.status(400).json({ message: 'Not enough items' });
    }

    // 3. Lấy thông tin item và effect
    const [itemRows] = await db.query('SELECT * FROM items WHERE id = ?', [item_id]);
    const [effectRows] = await db.query('SELECT * FROM item_effects WHERE item_id = ?', [item_id]);

    if (!itemRows.length || !effectRows.length) {
      return res.status(400).json({ message: 'Invalid item' });
    }

    // 4. Xử lý theo loại item
    let levelUpResult = null;
    if (itemRows[0].type === 'consumable') {
      levelUpResult = await handleConsumableItem(petId, item_id, effectRows[0], quantity, userId);
    } else if (itemRows[0].type === 'booster') {
      await handleBoosterItem(petId, item_id, effectRows[0], quantity, userId);
    } else if (itemRows[0].type === 'food') {
      levelUpResult = await handleFoodItem(petId, item_id, effectRows[0], quantity, userId);
    }

    // 5. Trừ item khỏi inventory
    await db.query('UPDATE inventory SET quantity = quantity - ? WHERE player_id = ? AND item_id = ?', 
      [quantity, userId, item_id]);

    // 6. Xóa item nếu quantity <= 0
    const [checkResult] = await db.query('SELECT quantity FROM inventory WHERE player_id = ? AND item_id = ?', 
      [userId, item_id]);
    if (checkResult.length > 0 && checkResult[0].quantity <= 0) {
      await db.query('DELETE FROM inventory WHERE player_id = ? AND item_id = ? AND quantity <= 0', 
        [userId, item_id]);
    }

    res.json({ 
      message: 'Item used successfully',
      exp_gained: effectRows[0].effect_target === 'exp' ? effectRows[0].value_min * quantity : 0,
      level_up: levelUpResult ? levelUpResult.level_up : false,
      old_level: levelUpResult ? levelUpResult.old_level : null,
      new_level: levelUpResult ? levelUpResult.new_level : null,
      stats_updated: levelUpResult ? levelUpResult.stats_updated : false,
      new_stats: levelUpResult ? levelUpResult.new_stats : null
    });
  } catch (error) {
    console.error('Error using item:', error);
    res.status(500).json({ message: 'Error using item' });
  }
});

// Helper functions
async function handleConsumableItem(petId, itemId, effect, quantity, userId) {
  if (effect.effect_target === 'exp') {
    // Sử dụng logic level up có sẵn
    return await handleExpGainWithLevelUp(petId, effect.value_min * quantity);
  } else if (effect.effect_target === 'hp') {
    // Hồi HP
    await pool.promise().query('UPDATE pets SET hp = LEAST(max_hp, hp + ?) WHERE id = ?', 
      [effect.value_min * quantity, petId]);
    return null;
  } else if (effect.effect_target === 'str' || effect.effect_target === 'def' || 
             effect.effect_target === 'spd' || effect.effect_target === 'intelligence') {
    // Tăng stat tạm thời hoặc vĩnh viễn
    const statField = effect.effect_target;
    if (effect.effect_type === 'percent') {
      await pool.promise().query(`UPDATE pets SET ${statField}_added = ${statField}_added + ? WHERE id = ?`, 
        [effect.value_min, petId]);
    } else if (effect.effect_type === 'flat') {
      await pool.promise().query(`UPDATE pets SET ${statField}_added = ${statField}_added + ? WHERE id = ?`, 
        [effect.value_min, petId]);
    }
    return null;
  }
  return null;
}

async function handleBoosterItem(petId, itemId, effect, quantity, userId) {
  // Kiểm tra usage limit
  const [usage] = await pool.promise().query('SELECT * FROM pet_item_usage WHERE pet_id = ? AND item_id = ?', [petId, itemId]);
  
  if (!usage.length) {
    // Tạo record mới
    await pool.promise().query('INSERT INTO pet_item_usage (pet_id, item_id, used_count, max_usage) VALUES (?, ?, 1, ?)', 
      [petId, itemId, effect.max_usage]);
  } else {
    if (usage[0].used_count >= usage[0].max_usage) {
      throw new Error('Usage limit reached');
    }
    // Cập nhật usage count
    await pool.promise().query('UPDATE pet_item_usage SET used_count = used_count + 1, last_used = NOW() WHERE id = ?', 
      [usage[0].id]);
  }

  // Tăng stat vĩnh viễn
  const statField = effect.effect_target;
  if (effect.effect_type === 'percent') {
    await pool.promise().query(`UPDATE pets SET ${statField}_added = ${statField}_added + ? WHERE id = ?`, 
      [effect.value_min, petId]);
  }
}

async function handleFoodItem(petId, itemId, effect, quantity, userId) {
  // Xử lý food item - có thể tăng HP, EXP hoặc stats
  if (effect.effect_target === 'exp') {
    // Sử dụng logic level up có sẵn
    return await handleExpGainWithLevelUp(petId, effect.value_min * quantity);
  } else if (effect.effect_target === 'hp') {
    // Hồi HP
    await pool.promise().query('UPDATE pets SET hp = LEAST(max_hp, hp + ?) WHERE id = ?', 
      [effect.value_min * quantity, petId]);
    return null;
  } else if (effect.effect_target === 'str' || effect.effect_target === 'def' || 
             effect.effect_target === 'spd' || effect.effect_target === 'intelligence') {
    // Tăng stat
    const statField = effect.effect_target;
    if (effect.effect_type === 'percent') {
      await pool.promise().query(`UPDATE pets SET ${statField}_added = ${statField}_added + ? WHERE id = ?`, 
        [effect.value_min, petId]);
    } else if (effect.effect_type === 'flat') {
      await pool.promise().query(`UPDATE pets SET ${statField}_added = ${statField}_added + ? WHERE id = ?`, 
        [effect.value_min, petId]);
    }
    return null;
  }
  return null;
}

// Helper function để xử lý EXP với logic level up
async function handleExpGainWithLevelUp(petId, expGain) {
  try {
    // Lấy thông tin pet hiện tại
    const [petRows] = await pool.promise().query('SELECT * FROM pets WHERE id = ?', [petId]);
    if (!petRows.length) {
      throw new Error('Pet not found');
    }

    const pet = petRows[0];
    let newExp = pet.current_exp + expGain;
    let newLevel = pet.level;

    // Kiểm tra level up
    while (expTable[newLevel + 1] && newExp >= expTable[newLevel + 1]) {
      newLevel++;
    }

    // Recalculate stats nếu level up
    let updatedStats = null;
    if (newLevel > pet.level) {
      // Lấy base stats từ pet_species
      const [speciesRows] = await pool.promise().query(
        'SELECT base_hp, base_mp, base_str, base_def, base_intelligence, base_spd FROM pet_species WHERE id = ?',
        [pet.pet_species_id]
      );
      
      if (speciesRows.length > 0) {
        const species = speciesRows[0];
        const base = {
          hp: parseInt(species.base_hp),
          mp: parseInt(species.base_mp),
          str: parseInt(species.base_str),
          def: parseInt(species.base_def),
          intelligence: parseInt(species.base_intelligence),
          spd: parseInt(species.base_spd),
        };
        
        const iv = {
          iv_hp: pet.iv_hp,
          iv_mp: pet.iv_mp,
          iv_str: pet.iv_str,
          iv_def: pet.iv_def,
          iv_intelligence: pet.iv_intelligence,
          iv_spd: pet.iv_spd,
        };
        
        updatedStats = calculateFinalStats(base, iv, newLevel);
      }
    }

    // Update database với stats mới nếu level up
    if (updatedStats) {
      await pool.promise().query(
        `UPDATE pets SET 
          current_exp = ?, 
          level = ?, 
          hp = ?, 
          max_hp = ?, 
          mp = ?, 
          max_mp = ?, 
          str = ?, 
          def = ?, 
          intelligence = ?, 
          spd = ?, 
          final_stats = ? 
        WHERE id = ?`,
        [
          newExp, newLevel,
          updatedStats.hp, updatedStats.hp,
          updatedStats.mp, updatedStats.mp,
          updatedStats.str, updatedStats.def, updatedStats.intelligence, updatedStats.spd,
          JSON.stringify(updatedStats),
          petId
        ]
      );
    } else {
      // Chỉ update exp nếu không level up
      await pool.promise().query(
        'UPDATE pets SET current_exp = ? WHERE id = ?',
        [newExp, petId]
      );
    }

    console.log(`Pet ${petId} gained ${expGain} EXP. Level: ${pet.level} -> ${newLevel}`);
    if (updatedStats) {
      console.log(`Stats updated for level up:`, updatedStats);
    }
    
    return {
      level_up: newLevel > pet.level,
      old_level: pet.level,
      new_level: newLevel,
      exp_gained: expGain,
      stats_updated: !!updatedStats,
      new_stats: updatedStats
    };
  } catch (error) {
    console.error('Error in handleExpGainWithLevelUp:', error);
    throw error;
  }
}

// Admin API endpoints

// Middleware để check admin role
const checkAdminRole = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const [rows] = await db.query('SELECT role FROM users WHERE id = ?', [decoded.userId]);
    
    if (!rows.length || rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    req.user = { userId: decoded.userId };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// POST /api/admin/mails/system-send - System auto send mail (single user)
app.post('/api/admin/mails/system-send', checkAdminRole, async (req, res) => {
  const { 
    user_id, 
    subject, 
    message, 
    attached_rewards,
    expire_days = 7 
  } = req.body;

  try {
    // Check if user exists
    const [userCheck] = await db.query('SELECT id FROM users WHERE id = ?', [user_id]);
    
    if (userCheck.length === 0) {
      return res.status(404).json({ error: `User ID ${user_id} không tồn tại` });
    }

    const expireAt = new Date();
    expireAt.setDate(expireAt.getDate() + expire_days);

    const rewardsJson = attached_rewards ? JSON.stringify(attached_rewards) : null;
    
    await db.query(`
      INSERT INTO mails (user_id, sender_type, sender_name, subject, message, attached_rewards, expire_at)
      VALUES (?, 'system', 'Hệ thống', ?, ?, ?, ?)
    `, [user_id, subject, message, rewardsJson, expireAt]);

    res.json({ success: true, message: 'Gửi system mail thành công!' });
  } catch (err) {
    console.error('Lỗi khi gửi system mail:', err);
    res.status(500).json({ error: 'Lỗi khi gửi system mail', details: err.message });
  }
});

// POST /api/admin/mails/broadcast - Send mail to all users
app.post('/api/admin/mails/broadcast', checkAdminRole, async (req, res) => {
  const { 
    subject, 
    message, 
    attached_rewards,
    expire_days = 7 
  } = req.body;

  try {
    // Get all users
    const [allUsers] = await db.query('SELECT id FROM users');
    
    if (allUsers.length === 0) {
      return res.status(404).json({ error: 'Không có user nào trong hệ thống' });
    }

    const expireAt = new Date();
    expireAt.setDate(expireAt.getDate() + expire_days);

    const rewardsJson = attached_rewards ? JSON.stringify(attached_rewards) : null;
    
    let sentCount = 0;
    let errorCount = 0;

    // Send mail to each user
    for (const user of allUsers) {
      try {
        await db.query(`
          INSERT INTO mails (user_id, sender_type, sender_name, subject, message, attached_rewards, expire_at)
          VALUES (?, 'system', 'Hệ thống', ?, ?, ?, ?)
        `, [user.id, subject, message, rewardsJson, expireAt]);
        sentCount++;
      } catch (err) {
        console.error(`Error sending mail to user ${user.id}:`, err);
        errorCount++;
      }
    }

    res.json({ 
      success: true, 
      message: `Gửi mail thành công đến ${sentCount}/${allUsers.length} users`,
      sent_count: sentCount,
      error_count: errorCount,
      total_users: allUsers.length
    });
  } catch (err) {
    console.error('Lỗi khi broadcast mail:', err);
    res.status(500).json({ error: 'Lỗi khi broadcast mail', details: err.message });
  }
});

// GET /api/admin/bank/interest-rates - Lấy lãi suất hiện tại
app.get('/api/admin/bank/interest-rates', checkAdminRole, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT currency_type, interest_rate, is_active
      FROM bank_interest_rates
      ORDER BY currency_type, is_active DESC
    `);

    const rates = {
      peta: { normal: 5.00, vip: 8.00 },
      petagold: { normal: 0.00, vip: 5.00 }
    };

    rows.forEach(row => {
      if (row.currency_type === 'peta') {
        if (row.is_active) rates.peta.normal = row.interest_rate;
        else rates.peta.vip = row.interest_rate;
      } else if (row.currency_type === 'petagold') {
        if (row.is_active) rates.petagold.normal = row.interest_rate;
        else rates.petagold.vip = row.interest_rate;
      }
    });

    res.json(rates);
  } catch (err) {
    console.error('Error fetching interest rates:', err);
    res.status(500).json({ error: 'Failed to fetch interest rates' });
  }
});

// PUT /api/admin/bank/interest-rates - Cập nhật lãi suất
app.put('/api/admin/bank/interest-rates', checkAdminRole, async (req, res) => {
  const { currency_type, user_type, interest_rate } = req.body;

  try {
    const isActive = user_type === 'normal';
    
    await db.query(`
      UPDATE bank_interest_rates 
      SET interest_rate = ?, updated_at = NOW()
      WHERE currency_type = ? AND is_active = ?
    `, [interest_rate, currency_type, isActive]);

    res.json({ message: 'Interest rate updated successfully' });
  } catch (err) {
    console.error('Error updating interest rate:', err);
    res.status(500).json({ error: 'Failed to update interest rate' });
  }
});

// GET /api/admin/users - Lấy danh sách users với pagination
app.get('/api/admin/users', checkAdminRole, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Get total count
    const [countRows] = await db.query(`
      SELECT COUNT(*) as total FROM users
    `);
    const totalUsers = countRows[0].total;
    const totalPages = Math.ceil(totalUsers / limit);

    // Get users with pagination
    const [rows] = await db.query(`
      SELECT id, username, role, is_vip, registration_date as created_at
      FROM users
      ORDER BY registration_date DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    res.json({
      users: rows,
      currentPage: page,
      totalPages: totalPages,
      totalUsers: totalUsers,
      usersPerPage: limit
    });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// PUT /api/admin/users/:userId/role - Cập nhật role user
app.put('/api/admin/users/:userId/role', checkAdminRole, async (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;

  try {
    await db.query(`
      UPDATE users 
      SET role = ?
      WHERE id = ?
    `, [role, userId]);

    res.json({ message: 'User role updated successfully' });
  } catch (err) {
    console.error('Error updating user role:', err);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// PUT /api/admin/users/:userId/vip - Toggle VIP status
app.put('/api/admin/users/:userId/vip', checkAdminRole, async (req, res) => {
  const { userId } = req.params;
  const { is_vip } = req.body;

  try {
    await db.query(`
      UPDATE users 
      SET is_vip = ?
      WHERE id = ?
    `, [is_vip, userId]);

    res.json({ message: 'VIP status updated successfully' });
  } catch (err) {
    console.error('Error updating VIP status:', err);
    res.status(500).json({ error: 'Failed to update VIP status' });
  }
});

// ================================ ADMIN SHOP MANAGEMENT ================================

// GET /api/admin/shops - Lấy danh sách shops cho admin
app.get('/api/admin/shops', checkAdminRole, async (req, res) => {
  try {
    const [shops] = await db.query(`
      SELECT * FROM shop_definitions 
      ORDER BY parent_category, sort_order
    `);
    res.json(shops);
  } catch (error) {
    console.error('Error fetching shops:', error);
    res.status(500).json({ error: 'Failed to fetch shops' });
  }
});

// POST /api/admin/shops/add - Thêm shop mới
app.post('/api/admin/shops/add', checkAdminRole, async (req, res) => {
  const { name, code, description, type_filter, currency_type, parent_category, sort_order } = req.body;

  try {
    // Check if code already exists
    const [existing] = await db.query('SELECT id FROM shop_definitions WHERE code = ?', [code]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Shop code already exists' });
    }

    await db.query(`
      INSERT INTO shop_definitions (name, code, description, type_filter, currency_type, parent_category, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [name, code, description, type_filter, currency_type, parent_category, sort_order]);

    res.json({ message: 'Shop added successfully' });
  } catch (error) {
    console.error('Error adding shop:', error);
    res.status(500).json({ error: 'Failed to add shop' });
  }
});

// GET /api/admin/shop/:shop_code - Lấy items của shop cho admin
app.get('/api/admin/shop/:shop_code', checkAdminRole, async (req, res) => {
  const { shop_code } = req.params;

  try {
    const [shopRows] = await db.query(
      'SELECT id FROM shop_definitions WHERE code = ?',
      [shop_code]
    );

    if (!shopRows.length) {
      return res.status(404).json({ error: 'Shop không tồn tại' });
    }

    const shop = shopRows[0];

    const [items] = await db.query(`
      SELECT 
        si.*,
        i.name,
        i.image_url,
        i.sell_price,
        i.type,
        sd.code as shop_code,
        sd.name as shop_name,
        sd.currency_type as shop_currency
      FROM shop_items si
      JOIN items i ON si.item_id = i.id
      JOIN shop_definitions sd ON si.shop_id = sd.id
      WHERE si.shop_id = ?
      ORDER BY si.id DESC
    `, [shop.id]);

    res.json(items);
  } catch (error) {
    console.error('Error fetching shop items:', error);
    res.status(500).json({ error: 'Failed to fetch shop items' });
  }
});

// POST /api/admin/shop-items/add - Thêm item vào shop
app.post('/api/admin/shop-items/add', checkAdminRole, async (req, res) => {
  const { shop_code, item_id, custom_price, currency_type, stock_limit, restock_interval, available_from, available_until } = req.body;

  try {
    // Get shop ID
    const [shopRows] = await db.query('SELECT id FROM shop_definitions WHERE code = ?', [shop_code]);
    if (!shopRows.length) {
      return res.status(404).json({ error: 'Shop không tồn tại' });
    }
    const shopId = shopRows[0].id;

    // Check if item already exists in shop
    const [existing] = await db.query('SELECT id FROM shop_items WHERE shop_id = ? AND item_id = ?', [shopId, item_id]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Item already exists in this shop' });
    }

    await db.query(`
      INSERT INTO shop_items (shop_id, item_id, custom_price, currency_type, stock_limit, restock_interval, available_from, available_until)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [shopId, item_id, custom_price, currency_type, stock_limit || 9999, restock_interval, available_from, available_until]);

    res.json({ message: 'Item added to shop successfully' });
  } catch (error) {
    console.error('Error adding item to shop:', error);
    res.status(500).json({ error: 'Failed to add item to shop' });
  }
});

// PUT /api/admin/shop-items/:shop_id/:item_id - Cập nhật item trong shop
app.put('/api/admin/shop-items/:shop_id/:item_id', checkAdminRole, async (req, res) => {
  const { shop_id, item_id } = req.params;
  const { custom_price, currency_type, stock_limit, restock_interval, available_from, available_until } = req.body;

  try {
    await db.query(`
      UPDATE shop_items 
      SET custom_price = ?, currency_type = ?, stock_limit = ?, restock_interval = ?, available_from = ?, available_until = ?
      WHERE shop_id = ? AND item_id = ?
    `, [custom_price, currency_type, stock_limit || 9999, restock_interval, available_from, available_until, shop_id, item_id]);

    res.json({ message: 'Item updated successfully' });
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// DELETE /api/admin/shop-items/:shop_id/:item_id - Xóa item khỏi shop
app.delete('/api/admin/shop-items/:shop_id/:item_id', checkAdminRole, async (req, res) => {
  const { shop_id, item_id } = req.params;

  console.log('🗑️ Admin deleting item:', {
    shop_id,
    item_id
  });

  try {
    const [result] = await db.query('DELETE FROM shop_items WHERE shop_id = ? AND item_id = ?', [shop_id, item_id]);
    
    console.log('📊 Delete result:', {
      affectedRows: result.affectedRows,
      shop_id,
      item_id
    });
    
    if (result.affectedRows === 0) {
      console.log('❌ No rows affected - item not found');
      return res.status(404).json({ error: 'Item not found in shop' });
    }

    res.json({ message: 'Item removed from shop successfully' });
  } catch (error) {
    console.error('Error removing item from shop:', error);
    res.status(500).json({ error: 'Failed to remove item from shop' });
  }
});

// PUT /api/admin/shops/:shop_id/restock-interval - Cập nhật restock interval cho shop
app.put('/api/admin/shops/:shop_id/restock-interval', checkAdminRole, async (req, res) => {
  const { shop_id } = req.params;
  const { shop_restock_interval } = req.body;

  try {
    await db.query(`
      UPDATE shop_definitions 
      SET shop_restock_interval = ?
      WHERE id = ?
    `, [shop_restock_interval, shop_id]);

    res.json({ message: 'Shop restock interval updated successfully' });
  } catch (error) {
    console.error('Error updating shop restock interval:', error);
    res.status(500).json({ error: 'Failed to update shop restock interval' });
  }
});

// GET /api/admin/shops/:shop_id/restock-interval - Lấy restock interval của shop
app.get('/api/admin/shops/:shop_id/restock-interval', checkAdminRole, async (req, res) => {
  const { shop_id } = req.params;

  try {
    const [rows] = await db.query(`
      SELECT shop_restock_interval 
      FROM shop_definitions 
      WHERE id = ?
    `, [shop_id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    res.json({ shop_restock_interval: rows[0].shop_restock_interval });
  } catch (error) {
    console.error('Error fetching shop restock interval:', error);
    res.status(500).json({ error: 'Failed to fetch shop restock interval' });
  }
});

// GET /api/admin/items - Lấy danh sách tất cả items cho admin
app.get('/api/admin/items', checkAdminRole, async (req, res) => {
  try {
    const [items] = await db.query(`
      SELECT id, name, image_url, sell_price, type, description
      FROM items 
      ORDER BY type, name
    `);
    res.json(items);
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// GET /api/shop/:shop_code/last-restock - Lấy thời gian restock cuối cùng của shop
app.get('/api/shop/:shop_code/last-restock', async (req, res) => {
  const { shop_code } = req.params;

  try {
    const [rows] = await db.query(`
      SELECT last_restock_time 
      FROM shop_definitions 
      WHERE code = ?
    `, [shop_code]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    res.json({ 
      last_restock_time: rows[0].last_restock_time,
      shop_code: shop_code 
    });
  } catch (error) {
    console.error('Error fetching last restock time:', error);
    res.status(500).json({ error: 'Failed to fetch last restock time' });
  }
});

// PUT /api/admin/shops/:shop_id/last-restock - Cập nhật thời gian restock cuối cùng (admin only)
app.put('/api/admin/shops/:shop_id/last-restock', checkAdminRole, async (req, res) => {
  const { shop_id } = req.params;
  const { last_restock_time } = req.body;

  try {
    await db.query(`
      UPDATE shop_definitions 
      SET last_restock_time = ?
      WHERE id = ?
    `, [last_restock_time, shop_id]);

    res.json({ message: 'Last restock time updated successfully' });
  } catch (error) {
    console.error('Error updating last restock time:', error);
    res.status(500).json({ error: 'Failed to update last restock time' });
  }
});

// ================================ GLOBAL CONFIG MANAGEMENT ================================

// GET /api/admin/global-config - Lấy tất cả global config
app.get('/api/admin/global-config', checkAdminRole, async (req, res) => {
  try {
    const [configs] = await db.query(`
      SELECT config_key, config_value, description, updated_at
      FROM global_config 
      ORDER BY config_key
    `);
    
    // Convert array to object for easier access
    const configObject = {};
    configs.forEach(config => {
      configObject[config.config_key] = {
        value: config.config_value,
        description: config.description,
        updated_at: config.updated_at
      };
    });
    
    res.json(configObject);
  } catch (error) {
    console.error('Error fetching global config:', error);
    res.status(500).json({ error: 'Failed to fetch global config' });
  }
});

// PUT /api/admin/global-config/:config_key - Cập nhật global config
app.put('/api/admin/global-config/:config_key', checkAdminRole, async (req, res) => {
  const { config_key } = req.params;
  const { config_value } = req.body;

  try {
    await db.query(`
      UPDATE global_config 
      SET config_value = ?, updated_at = CURRENT_TIMESTAMP
      WHERE config_key = ?
    `, [config_value, config_key]);

    res.json({ message: 'Global config updated successfully' });
  } catch (error) {
    console.error('Error updating global config:', error);
    res.status(500).json({ error: 'Failed to update global config' });
  }
});

// GET /api/global-reset-time - Lấy global reset time (public endpoint)
app.get('/api/global-reset-time', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT config_value 
      FROM global_config 
      WHERE config_key = 'global_reset_time'
    `);

    if (rows.length === 0) {
      return res.json({ global_reset_time: '06:00' }); // Default fallback
    }

    res.json({ global_reset_time: rows[0].config_value });
  } catch (error) {
    console.error('Error fetching global reset time:', error);
    res.status(500).json({ error: 'Failed to fetch global reset time' });
  }
});

// ========================================
// PERSISTENT HP SYSTEM API ENDPOINTS
// ========================================

// POST /api/pets/:petId/update-hp - Update pet's current HP
app.post('/api/pets/:petId/update-hp', async (req, res) => {
  const { petId } = req.params;
  const { current_hp } = req.body;

  try {
    // Validate current_hp
    if (current_hp === undefined || current_hp < 0) {
      return res.status(400).json({ error: 'Invalid current_hp value' });
    }

    // Get pet's max_hp to validate
    const [petRows] = await db.query(
      'SELECT final_stats FROM pets WHERE id = ?',
      [petId]
    );

    if (petRows.length === 0) {
      return res.status(404).json({ error: 'Pet not found' });
    }

    const pet = petRows[0];
    const maxHp = JSON.parse(pet.final_stats).hp;
    
    // Ensure current_hp doesn't exceed max_hp
    const validCurrentHp = Math.min(current_hp, maxHp);

    // Update current_hp
    await db.query(
      'UPDATE pets SET current_hp = ? WHERE id = ?',
      [validCurrentHp, petId]
    );

    res.json({ 
      message: 'HP updated successfully',
      pet_id: petId,
      current_hp: validCurrentHp,
      max_hp: maxHp
    });
  } catch (error) {
    console.error('Error updating pet HP:', error);
    res.status(500).json({ error: 'Failed to update pet HP' });
  }
});

// GET /api/pets/:petId/current-hp - Get pet's current HP
app.get('/api/pets/:petId/current-hp', async (req, res) => {
  const { petId } = req.params;

  try {
    const [rows] = await db.query(
      'SELECT id, name, current_hp, final_stats FROM pets WHERE id = ?',
      [petId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Pet not found' });
    }

    const pet = rows[0];
    const finalStats = JSON.parse(pet.final_stats);
    const maxHp = finalStats.hp;

    res.json({
      pet_id: pet.id,
      name: pet.name,
      current_hp: pet.current_hp || maxHp,
      max_hp: maxHp,
      hp_percentage: Math.round(((pet.current_hp || maxHp) / maxHp) * 100)
    });
  } catch (error) {
    console.error('Error fetching pet HP:', error);
    res.status(500).json({ error: 'Failed to fetch pet HP' });
  }
});

// ========================================
// HEALIA RIVER API ENDPOINTS
// ========================================

// GET /api/healia-river/status - Check if user can use Healia River
app.get('/api/healia-river/status', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const userId = decoded.userId;

    // Check if user is in battle
    const [battleRows] = await db.query(
      'SELECT id FROM one_player_battles2 WHERE userid = ?',
      [userId]
    );

    if (battleRows.length > 0) {
      return res.json({
        canUse: false,
        reason: 'battle',
        message: 'You cannot use this while you\'re in a battle.'
      });
    }

    // Check if user is VIP
    const [userRows] = await db.query(
      'SELECT is_vip FROM users WHERE id = ?',
      [userId]
    );
    const isVip = userRows.length > 0 && userRows[0].is_vip;

    // Check cooldown (15 min for VIP, 30 min for normal)
    const [cooldownRows] = await db.query(
      'SELECT last_used FROM user_cooldowns WHERE user_id = ? AND action_type = ?',
      [userId, 'healia_river']
    );

    if (cooldownRows.length === 0) {
      return res.json({
        canUse: true,
        timeLeft: 0,
        nextAvailable: null
      });
    }

    const lastUsed = new Date(cooldownRows[0].last_used);
    const now = new Date();
    const cooldownMs = isVip ? 15 * 60 * 1000 : 30 * 60 * 1000; // 15 min VIP, 30 min normal
    const timeLeft = Math.max(0, cooldownMs - (now - lastUsed));

    if (timeLeft === 0) {
      return res.json({
        canUse: true,
        timeLeft: 0,
        nextAvailable: null
      });
    }

    const nextAvailable = new Date(now.getTime() + timeLeft);
    const cooldownMinutes = isVip ? 15 : 30;

    return res.json({
      canUse: false,
      reason: 'cooldown',
      timeLeft: Math.ceil(timeLeft / 1000), // seconds
      nextAvailable: nextAvailable.toISOString(),
      message: `You can only drink the water from the fountain every ${cooldownMinutes} minutes. Please come back after`
    });
  } catch (error) {
    console.error('Error checking Healia River status:', error);
    res.status(500).json({ error: 'Failed to check Healia River status' });
  }
});

// POST /api/healia-river/heal - Use Healia River to heal pets
app.post('/api/healia-river/heal', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const userId = decoded.userId;

    // Check if user is in battle
    const [battleRows] = await db.query(
      'SELECT id FROM one_player_battles2 WHERE userid = ?',
      [userId]
    );

    if (battleRows.length > 0) {
      return res.status(400).json({ 
        error: 'You cannot use this while you\'re in a battle.' 
      });
    }

    // Check if user is VIP
    const [userRows] = await db.query(
      'SELECT is_vip FROM users WHERE id = ?',
      [userId]
    );
    const isVip = userRows.length > 0 && userRows[0].is_vip;

    // Check cooldown (15 min for VIP, 30 min for normal)
    const [cooldownRows] = await db.query(
      'SELECT last_used FROM user_cooldowns WHERE user_id = ? AND action_type = ?',
      [userId, 'healia_river']
    );

    if (cooldownRows.length > 0) {
      const lastUsed = new Date(cooldownRows[0].last_used);
      const now = new Date();
      const cooldownMs = isVip ? 15 * 60 * 1000 : 30 * 60 * 1000; // 15 min VIP, 30 min normal
      const timeLeft = Math.max(0, cooldownMs - (now - lastUsed));

      if (timeLeft > 0) {
        const cooldownMinutes = isVip ? 15 : 30;
        return res.status(400).json({ 
          error: `You can only drink the water from the fountain every ${cooldownMinutes} minutes. Please come back later.` 
        });
      }
    }

    // Get user's pets (có owner_id = user)
    console.log('Getting pets for user:', userId);
    const [petRows] = await db.query(
      'SELECT id, name, current_hp, final_stats FROM pets WHERE owner_id = ?',
      [userId]
    );
    console.log('Found pets:', petRows.length);

    if (petRows.length === 0) {
      return res.status(400).json({ 
        error: 'You don\'t have any pets to heal.' 
      });
    }

    // Random heal logic (80% chance: heal 85% maxHP, 20% chance: full heal)
    const randHeal = Math.floor(Math.random() * 5) + 1;
    let isFullHeal = false;

    if (randHeal <= 4) {
      // 80% chance: heal 85% of maxHP
      for (const pet of petRows) {
        // Handle both JSON string and object
        let finalStats;
        if (typeof pet.final_stats === 'string') {
          finalStats = JSON.parse(pet.final_stats);
        } else {
          finalStats = pet.final_stats;
        }
        
        const maxHp = finalStats.hp;
        const currentHp = pet.current_hp || maxHp;
        const healAmount = Math.floor(maxHp * 0.85); // 85% of maxHP
        const newHp = Math.min(currentHp + healAmount, maxHp);
        
        await db.query(
          'UPDATE pets SET current_hp = ? WHERE id = ?',
          [newHp, pet.id]
        );
      }
    } else {
      // 20% chance: full heal
      isFullHeal = true;
      
      for (const pet of petRows) {
        // Handle both JSON string and object
        let finalStats;
        if (typeof pet.final_stats === 'string') {
          finalStats = JSON.parse(pet.final_stats);
        } else {
          finalStats = pet.final_stats;
        }
        
        const maxHp = finalStats.hp;
        
        await db.query(
          'UPDATE pets SET current_hp = ? WHERE id = ?',
          [maxHp, pet.id]
        );
      }
    }

    // Update cooldown
    const now = new Date();
    if (cooldownRows.length > 0) {
      await db.query(
        'UPDATE user_cooldowns SET last_used = ? WHERE user_id = ? AND action_type = ?',
        [now, userId, 'healia_river']
      );
    } else {
      await db.query(
        'INSERT INTO user_cooldowns (user_id, action_type, last_used) VALUES (?, ?, ?)',
        [userId, 'healia_river', now]
      );
    }

    res.json({
      success: true,
      isFullHeal,
      message: isFullHeal 
        ? 'All of your pets have been fully healed!'
        : 'All of your pets have been healed a part!',
      nextAvailable: new Date(now.getTime() + (isVip ? 15 * 60 * 1000 : 30 * 60 * 1000)).toISOString()
    });
  } catch (error) {
    console.error('Error using Healia River:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    res.status(500).json({ 
      error: 'Failed to use Healia River',
      details: error.message,
      code: error.code
    });
  }
});

// ========================================
// RESTAURANT API (Nhà hàng - cho thú cưng ăn, hồi hunger_status)
// ========================================
// POST /api/restaurant/feed - Tốn 1 Peta, cho tất cả thú cưng ăn no (hunger_status = 3, hunger_battles = 0)
app.post('/api/restaurant/feed', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Cần đăng nhập để sử dụng Nhà hàng.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const userId = decoded.userId;

    const [userRows] = await db.query('SELECT id, peta FROM users WHERE id = ?', [userId]);
    if (userRows.length === 0) {
      return res.status(401).json({ error: 'Người dùng không tồn tại.' });
    }
    const user = userRows[0];
    const petaBalance = Number(user.peta) || 0;
    if (petaBalance < 1) {
      return res.status(400).json({ error: 'Bạn không đủ Peta. Cần 1 Peta để dùng menu.' });
    }

    const [petRows] = await db.query(
      'SELECT id FROM pets WHERE owner_id = ?',
      [userId]
    );
    if (petRows.length === 0) {
      return res.status(400).json({ error: 'Bạn chưa có thú cưng nào để cho ăn.' });
    }

    const HUNGER_FULL = 3;
    const HUNGER_BATTLES_RESET = 0;
    for (const pet of petRows) {
      await db.query(
        'UPDATE pets SET hunger_status = ?, hunger_battles = ? WHERE id = ?',
        [HUNGER_FULL, HUNGER_BATTLES_RESET, pet.id]
      );
    }

    await db.query('UPDATE users SET peta = peta - 1 WHERE id = ?', [userId]);

    res.json({
      success: true,
      message: 'Tất cả thú cưng đã được cho ăn no (trạng thái mập mạp)!',
      petaRemaining: petaBalance - 1,
      petsFed: petRows.length
    });
  } catch (err) {
    console.error('Restaurant feed error:', err);
    res.status(500).json({ error: 'Lỗi server khi sử dụng Nhà hàng.' });
  }
});

(async () => {
  await initRedis();
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
})();