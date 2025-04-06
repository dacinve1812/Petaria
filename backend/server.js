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
// API Create Pet (Admin) No one should able to create pet 
// app.post('/api/admin/pets', (req, res) => {
//   const { name, type, pet_type_id, hp, mp, str, def, intelligence, spd, rank, birthday, evolution_stage, status } = req.body;
//   const petUuid = uuidv4();
//   const max_hp = hp; // Giá trị ban đầu của max_hp
//   const max_mp = mp; // Giá trị ban đầu của max_mp

//   pool.query(
//       'INSERT INTO pets (uuid, name, type, pet_type_id, hp, max_hp, mp, max_mp, str, def, intelligence, spd, rank, evolution_stage, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
//       [petUuid, name, type, pet_type_id, hp, max_hp, mp, max_mp, str, def, intelligence, spd, rank, evolution_stage, status],
//       (err, results) => {
//           if (err) {
//               console.error('Error creating pet: ', err);
//               return res.status(500).json({ message: 'Error creating pet' });
//           }
//           res.json({ message: 'Pet created successfully', id: results.insertId, uuid: petUuid });
//       }
//   );
// });

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



// API Get Orphanage Pets (Rarity Common, Level 1) 

let orphanagePets = []; // Khai báo biến để lưu trữ danh sách thú cưng tạm thời
app.get('/api/orphanage-pets', (req, res) => {
  const level = 1; // Cố định level là 1
  const rarity = 'Common';

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
