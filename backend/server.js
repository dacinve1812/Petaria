const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');

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

// API Lấy Danh Sách Thú Cưng Có Sẵn (Trại Mồ Côi)
app.get('/orphanage/pets', (req, res) => {
  pool.query('SELECT * FROM pets WHERE owner_id IS NULL', (err, results) => {
    if (err) {
      console.error('Error fetching available pets: ', err);
      res.status(500).json({ message: 'Error fetching available pets' });
    } else {
      res.json(results);
    }
  });
});

// API Nhận Nuôi Thú Cưng
app.post('/orphanage/adopt', async (req, res) => {
  const { petId, userId, petName } = req.body;
  pool.query('UPDATE pets SET owner_id = ?, name = ? WHERE id = ?', [userId, petName, petId], (err, results) => {
    if (err) {
      console.error('Error adopting pet: ', err);
      res.status(500).json({ message: 'Error adopting pet' });
    } else {
      res.json({ message: 'Pet adopted successfully' });
    }
  });
});

// API Lấy Danh Sách Thú Cưng Của Người Dùng
app.get('/users/:userId/pets', (req, res) => {
  const userId = req.params.userId;
  pool.query(`SELECT
              p.id,
              p.name,
              pt.name AS pet_types_name,
              pt.image
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

// API Create Pet (Admin)
app.post('/api/admin/pets', (req, res) => {
  const { name, type, hp, str, def, int, spd, mp } = req.body;

  pool.query(
    'INSERT INTO pets (name, type, hp, str, def, intelligence, spd, mp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [name, type, hp, str, def, int, spd, mp],
    (err, results) => {
      if (err) {
        console.error('Error creating pet: ', err);
        res.status(500).json({ message: 'Error creating pet' });
      } else {
        res.json({ message: 'Pet created successfully' });
      }
    }
  );
});

// API Get Pets (Admin)
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

// API Delete Pet (Admin)
app.delete('/api/admin/pets/:id', (req, res) => {
  const id = req.params.id;
  pool.query('DELETE FROM pets WHERE id = ?', [id], (err, results) => {
    if (err) {
      console.error('Error deleting pet: ', err);
      res.status(500).json({ message: 'Error deleting pet' });
    } else {
      res.json({ message: 'Pet deleted successfully' });
    }
  });
});

// API Create Pet Type (Admin)
app.post('/api/admin/pet-types', (req, res) => {
  const { name, image, evolution_tree, description } = req.body;

  pool.query(
    'INSERT INTO pet_types (name, image, evolution_tree, description) VALUES (?, ?, ?, ?)',
    [name, image, evolution_tree, description],
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
  const { name, image, evolution_tree, description } = req.body;
  pool.query(
    'UPDATE pet_types SET name = ?, image = ?, evolution_tree = ?, description = ? WHERE id = ?',
    [name, image, evolution_tree, description, id],
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

// API Lấy Thông Tin Chi Tiết Thú Cưng Theo ID
app.get('/api/pets/:id', (req, res) => {
  const id = req.params.id;
  pool.query(`
      SELECT pets.*, pet_types.name AS pet_types_name, pet_types.image
      FROM pets
      JOIN pet_types ON pets.pet_type_id = pet_types.id
      WHERE pets.id = ?
  `, [id], (err, results) => {
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

// API Get Orphanage Pets
app.get('/api/orphanage-pets/:level', (req, res) => {
  const level = req.params.level;
  const description = `normal-${level}`;

  pool.query(
    'SELECT pet_types.id, pet_types.name AS pet_types_name, pet_types.image FROM pet_types WHERE description = ?',
    [description],
    (err, results) => {
      if (err) {
        console.error('Error fetching pet types: ', err);
        res.status(500).json({ message: 'Error fetching pet types' });
        return;
      }

      const petTypes = results;
      const orphanagePets = [];

      for (let i = 0; i < 4; i++) {
        const randomPetType = petTypes[Math.floor(Math.random() * petTypes.length)];
        const randomStats = {
          hp: Math.floor(Math.random() * 20) + 10,
          str: Math.floor(Math.random() * 10) + 5,
          def: Math.floor(Math.random() * 10) + 5,
          int: Math.floor(Math.random() * 10) + 5,
          spd: Math.floor(Math.random() * 10) + 5,
          mp: Math.floor(Math.random() * 10) + 5,
        };
        const level = 1; // Cố định level là 1
        const tempId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15); // Tạo id tạm thời.

        orphanagePets.push({
          tempId: tempId, // Thêm id tạm thời
          pet_type_id: randomPetType.id,
          name: randomPetType.name,
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

// API Adopt Pet
app.post('/api/adopt-pet', (req, res) => {
  const { pet_type_id, owner_id, hp, str, def, int, spd, mp, level } = req.body;

  pool.query(
    'SELECT description FROM pet_types WHERE id = ?',
    [pet_type_id],
    (err, results) => {
      if (err) {
        console.error('Error fetching pet type description: ', err);
        res.status(500).json({ message: 'Error adopting pet' });
        return;
      }

      if (results.length === 0) {
        res.status(400).json({ message: 'Invalid pet type ID' });
        return;
      }

      const type = results[0].description;

      pool.query(
        'INSERT INTO pets (pet_type_id, owner_id, hp, str, def, intelligence, spd, mp, level, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [pet_type_id, owner_id, hp, str, def, int, spd, mp, level, type],
        (err, results) => {
          if (err) {
            console.error('Error adopting pet: ', err);
            res.status(500).json({ message: 'Error adopting pet' });
            return;
          }

          res.json({ message: 'Pet adopted successfully' });
        }
      );
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
