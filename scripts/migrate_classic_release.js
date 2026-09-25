require('../backend/node_modules/dotenv').config({path:require('path').resolve(__dirname,'../.env')});
const mysql = require('../backend/node_modules/mysql2/promise');
async function migrate() {
 const c = await mysql.createConnection({host:process.env.DB_HOST||'localhost',user:process.env.DB_USER||'root',password:process.env.DB_PASSWORD||'',database:process.env.DB_NAME||'petaria'});
 try {
  // Additive only: existing account and game data are preserved.
  await c.query(`CREATE TABLE IF NOT EXISTS arena_match_receipts (
    match_id VARCHAR(36) PRIMARY KEY,user_id INT NOT NULL,pet_id INT NOT NULL,
    result_json JSON NULL,created_at DATETIME DEFAULT CURRENT_TIMESTAMP,finished_at DATETIME NULL,
    INDEX user_finished(user_id,finished_at)) ENGINE=InnoDB`);
  await c.query(`CREATE TABLE IF NOT EXISTS account_security (
    user_id INT PRIMARY KEY,email VARCHAR(254) NULL UNIQUE,password2_hash VARCHAR(100) NULL,
    email_verified TINYINT DEFAULT 0,token_version INT NOT NULL DEFAULT 0) ENGINE=InnoDB`);
  await c.query(`CREATE TABLE IF NOT EXISTS account_email_tokens (
    token_hash CHAR(64) PRIMARY KEY,user_id INT NOT NULL,purpose VARCHAR(20) NOT NULL,
    expires_at DATETIME NOT NULL,used_at DATETIME NULL,INDEX(user_id,purpose)) ENGINE=InnoDB`);
  console.log('Classic release migration complete (3 additive tables).');
 } finally {await c.end();}
}
migrate().catch(e=>{console.error(e.code || e.message);process.exitCode=1;});
