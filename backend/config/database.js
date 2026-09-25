const mysql = require('mysql2');
// Use the same environment as server.js; never embed database credentials in source.
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'petaria',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});
module.exports = pool.promise();
