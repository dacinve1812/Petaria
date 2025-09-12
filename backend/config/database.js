const mysql = require('mysql2');

const pool = mysql.createPool({
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
  } else {
    connection.release();
  }
});

module.exports = db;
