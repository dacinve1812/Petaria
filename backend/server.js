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


// User - Xem inventory cá nhân (có middleware xác thực)
app.get('/api/users/:userId/inventory', requireAuth, (req, res) => {
  const { userId } = req.params;

  // Kiểm tra userId từ token và userId từ params có trùng nhau không
  if (parseInt(userId) !== req.userId) {
    return res.status(403).json({ message: 'Forbidden: Access denied' });
  }

  pool.query(`
    SELECT i.*, it.name, it.description, it.type, it.rarity, it.image_url
    FROM inventory i
    JOIN items it ON i.item_id = it.id
    WHERE i.player_id = ?`,
    [userId], 
    (err, results) => {
      if (err) {
        console.error('Error fetching user inventory:', err);
        return res.status(500).json({ message: 'Error fetching inventory' });
      }
      res.json(results);
    });
});
