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


// API Lấy Danh Sách Thú Cưng Của Người Dùng
app.get('/users/:userId/pets', (req, res) => {
  const userId = req.params.userId;

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

    orphanagePets = orphanagePets.filter(pet => pet.tempId !== tempId);
    res.json({ message: 'Pet adopted successfully', uuid: petUuid });
  } catch (error) {
    console.error('Error adopting pet:', error);
    res.status(500).json({ message: 'Error adopting pet' });
  }
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        petUuid, name, final.hp, final.str, final.def, final.intelligence, final.spd, final.mp,
        pet_species_id, level, final.hp, final.mp,
        createdDate, JSON.stringify(final), currentExp,
        iv.iv_hp, iv.iv_mp, iv.iv_str, iv.iv_def, iv.iv_intelligence, iv.iv_spd
      ]
    );

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

    if (itemRow.stock_limit == null || itemRow.stock_limit <= 0) {
      return res.status(400).json({ error: 'Vật phẩm đã hết hàng' });
    }

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
        SELECT i.*, it.name, it.image_url, it.type, p.name AS pet_name, p.level AS pet_level
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
      'SELECT gold FROM users WHERE id = ?',
      [user_id]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ message: 'User không tồn tại' });
    }

    if (userRows[0].gold < repairCost) {
      return res.status(400).json({ 
        message: `Không đủ tiền. Cần ${repairCost} gold để sửa chữa` 
      });
    }

    // Trừ tiền và sửa chữa
    await pool.promise().query(
      'UPDATE users SET gold = gold - ? WHERE id = ?',
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
