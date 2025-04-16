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

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
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
          'INSERT INTO users (username, password) VALUES (?, ?)',
          [username, hashedPassword],
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

                const token = jwt.sign({ userId: user.id }, 'your_secret_key', {
                  expiresIn: '1h',
                });
                const isAdmin = username === 'admin'; // Kiểm tra username
                res.json({
                  message: 'User logged in successfully',
                  token: token,
                  isAdmin: isAdmin, // Trả về isAdmin
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

// // Middleware kiểm tra quyền admin
// function requireAdmin(req, res, next) {
//   const token = req.headers.authorization?.split(' ')[1];
//   if (!token) {
//     return res.status(401).json({ message: 'Unauthorized: No token provided' });
//   }

//   try {
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);

//     pool.query('SELECT username FROM users WHERE id = ?', [decoded.userId], (err, results) => {
//       if (err || results.length === 0) {
//         return res.status(403).json({ message: 'Forbidden: User not found' });
//       }

//       const user = results[0];
//       if (user.username !== 'admin') {
//         return res.status(403).json({ message: 'Forbidden: Admin only' });
//       }

//       next();
//     });

//   } catch (error) {
//     return res.status(401).json({ message: 'Unauthorized: Invalid token' });
//   }
// }

// // Middleware xác thực người dùng
// function requireAuth(req, res, next) {
//   const token = req.headers.authorization?.split(' ')[1];
//   if (!token) {
//     return res.status(401).json({ message: 'Unauthorized: No token provided' });
//   }

//   try {
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     req.userId = decoded.userId; // Gắn userId vào req để dùng sau
//     next();
//   } catch (error) {
//     return res.status(401).json({ message: 'Unauthorized: Invalid token' });
//   }
// }

// API Lấy Danh Sách Thú Cưng Của Người Dùng
app.get('/users/:userId/pets', (req, res) => {
  const userId = req.params.userId;
  pool.query(`SELECT
              p.uuid,
              p.name,
              pt.name AS pet_types_name,
              pt.image,
              p.level
            FROM pets p
            JOIN pet_types pt ON p.pet_type_id = pt.id
            WHERE p.owner_id = ?`, [userId], (err, results) => {
    if (err) {
      console.error('Error fetching user pets: ', err);
      res.status(500).json({ message: 'Error fetching user pets' });
    } else {
      res.json(results);
    }
  });
});


/********************************************************************************************************************
*
ADMIN API
*

********************************************************************************************************************/

// API Get Pets (Admin) -> Suy nghĩ sau
app.get('/api/admin/pets', (req, res) => {
  pool.query('SELECT * FROM pets', (err, results) => {
    if (err) {
      console.error('Error fetching pets: ', err);
      res.status(500).json({ message: 'Error fetching pets' });
    } else {
      res.json(results);
    }
  });
});

// API Create Pet Type (Admin)
app.post('/api/admin/pet-types', (req, res) => {
  const { name, image, evolution_tree, description, rarity } = req.body;

  pool.query(
    'INSERT INTO pet_types (name, image, evolution_tree, description, rarity) VALUES (?, ?, ?, ?, ?)',
    [name, image, evolution_tree, description, rarity],
    (err, results) => {
      if (err) {
        console.error('Error creating pet type: ', err);
        res.status(500).json({ message: 'Error creating pet type' });
      } else {
        res.json({ message: 'Pet type created successfully' });
      }
    }
  );
});

// API Get Pet Types (Admin)
app.get('/api/admin/pet-types', (req, res) => {
  pool.query('SELECT * FROM pet_types', (err, results) => {
    if (err) {
      console.error('Error fetching pet types: ', err);
      res.status(500).json({ message: 'Error fetching pet types' });
    } else {
      res.json(results);
    }
  });
});

// API Delete Pet Type (Admin)
app.delete('/api/admin/pet-types/:id', (req, res) => {
  const id = req.params.id;
  pool.query('DELETE FROM pet_types WHERE id = ?', [id], (err, results) => {
    if (err) {
      console.error('Error deleting pet type: ', err);
      res.status(500).json({ message: 'Error deleting pet type' });
    } else {
      res.json({ message: 'Pet type deleted successfully' });
    }
  });
});

// API Update Pet Type (Admin)
app.put('/api/admin/pet-types/:id', (req, res) => {
  const id = req.params.id;
  const { name, image, evolution_tree, description, rarity } = req.body;
  pool.query(
    'UPDATE pet_types SET name = ?, image = ?, evolution_tree = ?, description = ?, rarity = ? WHERE id = ?',
    [name, image, evolution_tree, description, rarity, id],
    (err, results) => {
      if (err) {
        console.error('Error updating pet type: ', err);
        res.status(500).json({ message: 'Error updating pet type' });
      } else {
        res.json({ message: 'Pet type updated successfully' });
      }
    }
  );
});

// API Lấy Thông Tin Chi Tiết Thú Cưng Theo ID/UUID
app.get('/api/pets/:uuid', (req, res) => {
  const uuid = req.params.uuid;
  pool.query(`
      SELECT p.*, pt.name AS pet_types_name, pt.image
      FROM pets p
      JOIN pet_types pt ON p.pet_type_id = pt.id
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


// API Adopt Pet (Create real pet record using data from temp pet)
app.post('/api/adopt-pet', async (req, res) => {
  const { tempId, owner_id, petName } = req.body;

  const tempPet = orphanagePets.find(pet => pet.tempId === tempId);

  if (!tempPet) {
      return res.status(400).json({ message: 'Invalid temporary pet ID' });
  }

  const { pet_type_id, hp, mp, str, def, intelligence, spd } = tempPet;
  const petUuid = uuidv4();
  const level = 1;
  const adoptDate = new Date();

  try {
      const [petTypeResult] = await pool.promise().query(
          'SELECT name, type, rarity FROM pet_types WHERE id = ?',
          [pet_type_id]
      );

      if (petTypeResult.length === 0) {
          return res.status(400).json({ message: 'Invalid pet type ID' });
      }

      const petTypeName = petTypeResult[0].name;
      const petType = petTypeResult[0].type;
      const rarity = petTypeResult[0].rarity;

      const maxHp = hp;
      const maxMp = mp;

      const [insertResult] = await pool.promise().query(
          'INSERT INTO pets (uuid, name, type, pet_type_id, owner_id, hp, max_hp, mp, max_mp, str, def, intelligence, spd, level, rarity, created_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [petUuid, petName, petType, pet_type_id, owner_id, hp, maxHp, mp, maxMp, str, def, intelligence, spd, level, rarity, adoptDate]
      );

      res.json({ message: 'Pet adopted successfully', uuid: petUuid });

      const index = orphanagePets.findIndex(pet => pet.tempId === tempId);
      if (index > -1) {
          orphanagePets.splice(index, 1);
      }

  } catch (error) {
      console.error('Error adopting pet:', error);
      res.status(500).json({ message: 'Error adopting pet' });
  }
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
      const decodedToken = jwt.verify(token, 'your_secret_key'); // Xác thực token
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
          pool.query('DELETE FROM pets WHERE uuid = ?', [uuid], (deleteErr, deleteResults) => {
              if (deleteErr) {
                  console.error('Error releasing pet: ', deleteErr);
                  return res.status(500).json({ message: 'Error releasing pet' });
              } else if (deleteResults.affectedRows > 0) {
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

let orphanagePets = []; // Khai báo biến để lưu trữ danh sách thú cưng tạm thời
app.get('/api/orphanage-pets', (req, res) => {
  const level = 1; // Cố định level là 1
  const rarity = 'Legend';

  pool.query(
      'SELECT id, name AS pet_types_name, image FROM pet_types WHERE rarity = ?',
      [rarity],
      (err, results) => {
          if (err) {
              console.error('Error fetching common pet types: ', err);
              return res.status(500).json({ message: 'Error fetching pet types' });
          }

          const petTypes = results;
          orphanagePets = [];

          for (let i = 0; i < 4; i++) {
              const randomPetType = petTypes[Math.floor(Math.random() * petTypes.length)];
              const randomStats = {
                  hp: Math.floor(Math.random() * 10) + 20,
                  mp: Math.floor(Math.random() * 5) + 10,
                  str: Math.floor(Math.random() * 3) + 5,
                  def: Math.floor(Math.random() * 3) + 5,
                  intelligence: Math.floor(Math.random() * 3) + 5,
                  spd: Math.floor(Math.random() * 3) + 5,
              };
              const tempId = uuidv4();

              orphanagePets.push({
                  tempId: tempId,
                  pet_type_id: randomPetType.id,
                  name: randomPetType.pet_types_name,
                  pet_types_name: randomPetType.pet_types_name,
                  image: randomPetType.image,
                  ...randomStats,
                  level: level,
              });
          }

          res.json(orphanagePets);
      }
  );
});



// API Get User Info
app.get('/users/:userId', (req, res) => {
  const userId = parseInt(req.params.userId); // Parse to integer

  if (isNaN(userId)) {
    res.status(400).json({ message: 'Invalid user ID' });
    return;
  }

  pool.query('SELECT username, gold, petagold, real_name, guild, title, ranking, online_status, birthday FROM users WHERE id = ?', [userId], (err, results) => {
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
    const flatValues = item_ids.flatMap(itemId => [shop_id, itemId, custom_price ?? null, currency_type ?? 'gold']);

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
    const price = itemRow.custom_price ?? itemRow.buy_price;
    const currency = itemRow.currency_type;
    
    if (!currency || !['gold', 'petagold'].includes(currency)) {
      return res.status(400).json({ error: 'Loại tiền không hợp lệ' });
    }

    // 4. Lấy thông tin người dùng
    const [userRow] = await db.query(`SELECT gold, petagold FROM users WHERE id = ?`, [user_id]);
    if (!userRow) return res.status(404).json({ error: 'Người dùng không tồn tại' });

    const userBalance = currency === 'gold' ? userRow.gold : userRow.petagold;
    if (userBalance < price) return res.status(400).json({ error: 'Không đủ tiền' });

    // 5. Trừ tiền
    await db.query(`UPDATE users SET ${currency} = ${currency} - ? WHERE id = ?`, [price, user_id]);

    // 6. Thêm item vào inventory
    if (itemRow.type === 'equipment') {
      // Equipment: mỗi bản riêng biệt
      await db.query(`
        INSERT INTO inventory (player_id, item_id, quantity, is_equipped, durability_left)
        VALUES (?, ?, 1, 0, ?)
      `, [user_id, item_id, itemRow.durability ?? 100]);
    } else {
      // Các loại khác: cộng dồn
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
      SELECT i.id AS item_id, i.name, i.type, i.rarity, i.description, i.image_url,
             inv.id, inv.quantity, inv.durability_left, inv.is_equipped
      FROM inventory inv
      JOIN items i ON inv.item_id = i.id
      WHERE inv.player_id = ?
    `, [userId]);

    res.json(rows);
  } catch (err) {
    console.error('Lỗi khi lấy inventory:', err);
    res.status(500).json({ error: 'Không thể lấy dữ liệu inventory' });
  }
});