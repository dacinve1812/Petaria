const {
  randomFactor,
  isCriticalHit,
  isDodged,
  calculateDamage,
  simulateTurn,
  simulateFullBattle
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

function calculateFinalStats(base, iv, level, ev = null) {
  const getStat = (b, i, e = 0) =>
    Math.floor(((2 * b + i + Math.floor(e / 4)) * level) / 100) + 5;

  const getHP = (b, i, e = 0) =>
    Math.floor(((2 * b + i + Math.floor(e / 4)) * level) / 100) + level + 10;
    

  return {
    hp: getHP(base.hp, iv.iv_hp),
    mp: getHP(base.mp, iv.iv_mp),
    str: getStat(base.str, iv.iv_str),
    def: getStat(base.def, iv.iv_def),
    intelligence: getStat(base.intelligence, iv.iv_intelligence),
    spd: getStat(base.spd, iv.iv_spd)
  };
}
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = 5000; // Chọn cổng cho backend


const mysql = require('mysql2'); // Hoặc const { Pool } = require('pg');

const pool = mysql.createPool({ // Hoặc const pool = new Pool({
  host: 'localhost',
  user: 'root',
  password: 'X1nCh4o0127!',
  database: 'petaria',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const db = pool.promise();

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

//Lấy stats của equipment-stats
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
  const { item_id, power, durability } = req.body;
  const sql = `INSERT INTO equipment_data (item_id, power, durability)
               VALUES (?, ?, ?)
               ON DUPLICATE KEY UPDATE power = VALUES(power), durability = VALUES(durability)`;

  pool.query(sql, [item_id, power, durability], (err, results) => {
    if (err) {
      console.error('Error saving equipment data:', err);
      return res.status(500).json({ message: 'Error saving equipment data' });
    }
    res.json({ message: 'Equipment data saved successfully' });
  });
});

app.put('/api/admin/equipment-stats/:id', (req, res) => {
  const { id } = req.params;
  const { item_id, power, durability } = req.body;

  const sql = `UPDATE equipment_data
               SET item_id = ?, power = ?, durability = ?
               WHERE id = ?`;

  pool.query(sql, [item_id, power, durability, id], (err, results) => {
    if (err) {
      console.error('Error updating equipment data:', err);
      return res.status(500).json({ message: 'Error updating equipment data' });
    }
    res.json({ message: 'Equipment data updated successfully' });
  });
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
        i.id, i.name, i.description, i.type, i.rarity, i.image_url,
        COALESCE(si.custom_price, i.buy_price) AS price,
        si.currency_type, si.stock_limit, si.available_from, si.available_until
      FROM shop_items si
      JOIN items i ON si.item_id = i.id
      WHERE si.shop_id = ?
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
  const { shop_code, item_id, user_id } = req.body;

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

    const userBalance = currency === 'peta' ? userRow.peta : userRow.petagold;
    if (userBalance < price) return res.status(400).json({ error: 'Không đủ tiền' });

    // 5. Trừ tiền
    await db.query(`UPDATE users SET ${currency} = ${currency} - ? WHERE id = ?`, [price, user_id]);

    // 6. Thêm item vào inventory
    if (itemRow.type === 'equipment') {
      const [equipInfo] = await db.query(
        'SELECT durability FROM equipment_data WHERE item_id = ?',
        [item_id]
      );

      const durability = (equipInfo.length > 0) ? equipInfo[0].durability : 1;

      await db.query(`
        INSERT INTO inventory (player_id, item_id, quantity, is_equipped, durability_left)
        VALUES (?, ?, 1, 0, ?)
      `, [user_id, item_id, durability]);
    } else {
      const [invRows] = await db.query(`
        SELECT id, quantity FROM inventory
        WHERE player_id = ? AND item_id = ? AND is_equipped = 0
      `, [user_id, item_id]);

      if (invRows.length > 0) {
        const inv = invRows[0];
        await db.query(`UPDATE inventory SET quantity = quantity + 1 WHERE id = ?`, [inv.id]);
      } else {
        await db.query(`
          INSERT INTO inventory (player_id, item_id, quantity)
          VALUES (?, ?, 1)
        `, [user_id, item_id]);
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
        SELECT i.*, it.name, it.image_url, it.type, it.rarity, p.name AS pet_name, p.level AS pet_level
        FROM inventory i
        JOIN items it ON i.item_id = it.id
        LEFT JOIN pets p ON i.equipped_pet_id = p.id
        WHERE i.player_id = ?
    `, [userId]);

    res.json(rows);
  } catch (err) {
    console.error('Lỗi khi lấy inventory:', err);
    res.status(500).json({ error: 'Không thể lấy dữ liệu inventory' });
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
    // 1. Kiểm tra inventory item
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

    // 2. Kiểm tra pet tồn tại và thuộc cùng user
    const [petRows] = await pool.promise().query(
      'SELECT * FROM pets WHERE id = ? AND owner_id = ?',
      [petId, item.player_id]
    );

    if (petRows.length === 0) {
      return res.status(400).json({ message: 'Pet không tồn tại hoặc không thuộc user' });
    }

    // 3. Kiểm tra số item đã được gắn
    const [equippedCount] = await pool.promise().query(
      'SELECT COUNT(*) AS count FROM inventory WHERE equipped_pet_id = ? AND is_equipped = 1',
      [petId]
    );

    if (equippedCount[0].count >= maxItemsCanEquip) {
      return res.status(400).json({ message: 'Pet đã trang bị tối đa 4 item' });
    }

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
      `SELECT i.id, i.item_id, it.name AS item_name, it.image_url, i.durability_left,
              ed.power, ed.durability AS max_durability, i.is_broken
       FROM inventory i
       JOIN items it ON i.item_id = it.id
       LEFT JOIN equipment_data ed ON it.id = ed.item_id
       WHERE i.equipped_pet_id = ? AND i.is_equipped = 1 AND i.is_broken = 0`,
      [petId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching equipped items for pet:', err);
    res.status(500).json({ message: 'Lỗi khi lấy danh sách item đã trang bị' });
  }
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
    // Giảm durability và kiểm tra nếu <= 0 thì xóa item
    const [result] = await pool.promise().query(
      'UPDATE inventory SET durability_left = GREATEST(durability_left - ?, 0) WHERE id = ?',
      [amount, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Item không tồn tại' });
    }

    // Kiểm tra durability còn lại
    const [itemRows] = await pool.promise().query(
      'SELECT durability_left FROM inventory WHERE id = ?',
      [id]
    );

    const durability_left = itemRows[0]?.durability_left || 0;

    // Nếu durability về 0, chuyển sang trạng thái broken thay vì xóa
    if (durability_left <= 0) {
      await pool.promise().query('UPDATE inventory SET is_broken = 1 WHERE id = ?', [id]);
      res.json({ 
        message: 'Equipment đã hỏng', 
        durability_left: 0, 
        item_destroyed: false,
        item_broken: true 
      });
    } else {
      res.json({ 
        message: 'Durability đã được cập nhật', 
        durability_left, 
        item_destroyed: false,
        item_broken: false 
      });
    }

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
        current_exp, exp_to_next_level, final_stats, is_arena_enemy)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      1
    ]);

    res.json({ message: 'Đã tạo NPC thành công!' });
  } catch (err) {
    console.error('Lỗi tạo arena pet:', err);
    res.status(500).json({ message: 'Lỗi khi tạo pet đấu trường' });
  }
});


// API: Lấy danh sách pet NPC dùng trong Arena
app.get('/api/arena/enemies', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT p.id, p.uuid, p.name, p.level, ps.image
      FROM pets p
      JOIN pet_species ps ON p.pet_species_id = ps.id
      WHERE p.is_arena_enemy = 1
      ORDER BY p.level DESC
    `);

    res.json(rows);
  } catch (err) {
    console.error('Lỗi khi lấy danh sách pet NPC Arena:', err);
    res.status(500).json({ message: 'Lỗi server khi tải danh sách pet NPC' });
  }
});


//API ARENA: Mô phỏng 1 lượt tấn cân giữa người chơi và NPC
// POST /api/arena/simulate-turn
app.post('/api/arena/simulate-turn', (req, res) => {
  const { attacker, defender, movePower, moveName } = req.body;

  try {
    const result = simulateTurn(attacker, defender, movePower, moveName);
    res.json(result);
  } catch (err) {
    console.error('Error during turn simulation:', err);
    res.status(500).json({ message: 'Lỗi khi mô phỏng lượt đánh' });
  }
});

// API ARENA: Mô phỏng toàn bộ trận đấu (PvE)
// POST /api/arena/simulate-full
app.post('/api/arena/simulate-full', (req, res) => {
  const {
    playerPet, enemyPet,
    playerMovePower = 10, playerMoveName = 'Tackle',
    enemyMovePower = 10, enemyMoveName = 'Bite'
  } = req.body;

  try {
    const result = simulateFullBattle(
      playerPet, enemyPet,
      playerMovePower, playerMoveName,
      enemyMovePower, enemyMoveName
    );
    res.json(result);
  } catch (err) {
    console.error('Error during full battle simulation:', err);
    res.status(500).json({ message: 'Lỗi khi mô phỏng trận đấu' });
  }
});


// Base EXP theo từng giai đoạn
function getBaseExp(level) {
  if (level <= 3) return 100;
  if (level <= 7) return 200;
  if (level <= 10) return 400;
  return 10;
}

function calculateExpGain(playerLevel, enemyLevel) {
  const base = getBaseExp(playerLevel);
  const numerator = Math.pow(enemyLevel, 2.2);
  const denominator = Math.pow(playerLevel, 0.3);
  return Math.round(base * (numerator / denominator))
}

// ✅ API cộng EXP khi thắng trận
app.post('/api/pets/:id/gain-exp', async (req, res) => {
  const petId = req.params.id;
  const { source, enemy_level, custom_amount } = req.body;

  try {
    const [rows] = await pool.promise().query('SELECT * FROM pets WHERE id = ?', [petId]);
    if (!rows.length) return res.status(404).json({ message: 'Pet not found' });

    const pet = rows[0];

    if (pet.is_npc) {
      return res.status(403).json({ message: 'NPC không được cộng EXP' });
    }

    const gain = custom_amount !== null ? custom_amount : calculateExpGain(pet.level, enemy_level);
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
  const { id } = req.params;
  const { repair_kit_item_id } = req.body;

  try {
    // Kiểm tra item có bị hỏng không
    const [itemRows] = await pool.promise().query(
      `SELECT i.*, it.rarity AS item_rarity, ed.durability AS max_durability
       FROM inventory i
       JOIN items it ON i.item_id = it.id
       LEFT JOIN equipment_data ed ON it.id = ed.item_id
       WHERE i.id = ? AND i.is_broken = 1`,
      [id]
    );

    if (itemRows.length === 0) {
      return res.status(404).json({ message: 'Item không tồn tại hoặc không bị hỏng' });
    }

    const item = itemRows[0];

    // Kiểm tra Repair Kit có phù hợp không
    const [kitRows] = await pool.promise().query(
      `SELECT * FROM items WHERE id = ? AND type = 'repair_kit'`,
      [repair_kit_item_id]
    );

    if (kitRows.length === 0) {
      return res.status(400).json({ message: 'Repair Kit không hợp lệ' });
    }

    const kit = kitRows[0];

    // Tính hiệu quả repair dựa trên rarity
    const effectiveness = getRepairEffectiveness(kit.rarity, item.item_rarity);
    
    if (effectiveness === 0) {
      return res.status(400).json({ 
        message: `Repair Kit ${kit.rarity} không thể sửa equipment ${item.item_rarity}` 
      });
    }

    // Tính durability được khôi phục
    const restoredDurability = Math.floor(item.max_durability * effectiveness / 100);

    // Sửa chữa equipment
    await pool.promise().query(
      `UPDATE inventory SET is_broken = 0, durability_left = ? WHERE id = ?`,
      [restoredDurability, id]
    );

    // Xóa Repair Kit
    await pool.promise().query(
      'DELETE FROM inventory WHERE item_id = ? AND player_id = ? LIMIT 1',
      [repair_kit_item_id, item.player_id]
    );

    res.json({ 
      message: 'Equipment đã được sửa chữa thành công',
      repair_kit_used: kit.name,
      effectiveness: effectiveness + '%',
      durability_left: restoredDurability,
      max_durability: item.max_durability
    });

  } catch (err) {
    console.error('Error repairing equipment:', err);
    res.status(500).json({ message: 'Lỗi khi sửa chữa equipment' });
  }
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
  const { id } = req.params;
  const { user_id } = req.body;

  try {
    // Kiểm tra item có bị hỏng không
    const [itemRows] = await pool.promise().query(
      `SELECT i.*, it.rarity AS item_rarity, ed.durability AS max_durability, ed.power
       FROM inventory i
       JOIN items it ON i.item_id = it.id
       LEFT JOIN equipment_data ed ON it.id = ed.item_id
       WHERE i.id = ? AND i.is_broken = 1`,
      [id]
    );

    if (itemRows.length === 0) {
      return res.status(404).json({ message: 'Item không tồn tại hoặc không bị hỏng' });
    }

    const item = itemRows[0];

    // Tính giá sửa chữa dựa trên rarity và power
    let repairCost;
    switch (item.item_rarity) {
      case 'common':
        repairCost = 100;
        break;
      case 'uncommon':
        repairCost = 300;
        break;
      case 'rare':
        repairCost = 800;
        break;
      case 'epic':
        repairCost = 2000;
        break;
      case 'legendary':
        repairCost = 5000;
        break;
      default:
        repairCost = 500;
    }

    // Thêm bonus cost dựa trên power
    repairCost += Math.floor(item.power / 10) * 50;

    // Kiểm tra tiền của user
    const [userRows] = await pool.promise().query(
      'SELECT peta FROM users WHERE id = ?',
      [user_id]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ message: 'User không tồn tại' });
    }

    if (userRows[0].peta < repairCost) {
      return res.status(400).json({ 
        message: `Không đủ tiền. Cần ${repairCost} peta để sửa chữa` 
      });
    }

    // Trừ tiền và sửa chữa
    await pool.promise().query(
      'UPDATE users SET peta = peta - ? WHERE id = ?',
      [repairCost, user_id]
    );

    await pool.promise().query(
      `UPDATE inventory SET is_broken = 0, durability_left = ? WHERE id = ?`,
      [item.max_durability, id]
    );

    res.json({ 
      message: `Equipment đã được sửa chữa thành công với giá ${repairCost} gold`,
      durability_left: item.max_durability,
      repair_cost: repairCost
    });

  } catch (err) {
    console.error('Error repairing equipment with blacksmith:', err);
    res.status(500).json({ message: 'Lỗi khi sửa chữa equipment' });
  }
});

// API: Lấy danh sách equipment bị hỏng của user
app.get('/api/users/:userId/broken-equipment', async (req, res) => {
  const { userId } = req.params;

  try {
    const [rows] = await pool.promise().query(
      `SELECT i.id, i.item_id, it.name AS item_name, it.image_url, it.rarity,
              ed.power, ed.durability AS max_durability
       FROM inventory i
       JOIN items it ON i.item_id = it.id
       LEFT JOIN equipment_data ed ON it.id = ed.item_id
       WHERE i.player_id = ? AND i.is_broken = 1`,
      [userId]
    );

    res.json(rows);
  } catch (err) {
    console.error('Error fetching broken equipment:', err);
    res.status(500).json({ message: 'Lỗi khi lấy danh sách equipment hỏng' });
  }
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

// POST /api/admin/mails/system-send - System auto send mail
app.post('/api/admin/mails/system-send', async (req, res) => {
  const { 
    user_id, 
    subject, 
    message, 
    attached_rewards,
    expire_days = 7 
  } = req.body;

  try {
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
    res.status(500).json({ error: 'Lỗi khi gửi system mail' });
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

// POST /api/admin/spirits - Tạo Linh Thú mới
app.post('/api/admin/spirits', async (req, res) => {
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
app.put('/api/admin/spirits/:id', async (req, res) => {
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
app.delete('/api/admin/spirits/:id', async (req, res) => {
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
app.get('/api/admin/spirits/:id', async (req, res) => {
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
             ed.power, ed.durability AS max_durability, i.is_broken
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
    
    // Stats đã được tính toán trong database (cached)
    const battleStats = {
      hp: pet.hp,
      mp: pet.mp,
      str: pet.str,  // Đã bao gồm spirit bonus
      def: pet.def,  // Đã bao gồm spirit bonus
      spd: pet.spd,  // Đã bao gồm spirit bonus
      intelligence: pet.intelligence  // Đã bao gồm spirit bonus
    };
    
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

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});