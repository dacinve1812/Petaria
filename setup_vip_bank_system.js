const mysql = require('mysql2/promise');
require('dotenv').config();

async function setupVipBankSystem() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'petaria'
  });

  try {
    console.log('Setting up VIP Bank System...');

    // 1. Add VIP status to users table
    console.log('1. Adding VIP status to users table...');
    await connection.execute(`
      ALTER TABLE users ADD COLUMN is_vip BOOLEAN DEFAULT FALSE AFTER role
    `);
    await connection.execute(`
      ALTER TABLE users ADD COLUMN vip_expires_at DATETIME NULL AFTER is_vip
    `);
    await connection.execute(`
      CREATE INDEX idx_users_is_vip ON users(is_vip)
    `);

    // 2. Create bank interest rates table
    console.log('2. Creating bank interest rates table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS bank_interest_rates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        currency_type ENUM('peta', 'petagold') NOT NULL,
        interest_rate DECIMAL(5,2) NOT NULL DEFAULT 5.00,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_by INT,
        notes TEXT,
        
        UNIQUE KEY unique_currency_active (currency_type, is_active),
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // 3. Insert default interest rates
    console.log('3. Inserting default interest rates...');
    await connection.execute(`
      INSERT INTO bank_interest_rates (currency_type, interest_rate, is_active, notes) VALUES
      ('peta', 5.00, TRUE, 'Default Peta interest rate for normal users'),
      ('petagold', 0.00, TRUE, 'Default PetaGold interest rate (no interest for normal users)'),
      ('peta', 8.00, FALSE, 'VIP Peta interest rate'),
      ('petagold', 5.00, FALSE, 'VIP PetaGold interest rate')
      ON DUPLICATE KEY UPDATE
      interest_rate = VALUES(interest_rate),
      notes = VALUES(notes)
    `);

    console.log('✅ VIP Bank System setup completed successfully!');
    console.log('\n📋 Summary:');
    console.log('- Added is_vip column to users table');
    console.log('- Created bank_interest_rates table');
    console.log('- Set default interest rates:');
    console.log('  * Normal users: Peta 5%, PetaGold 0%');
    console.log('  * VIP users: Peta 8%, PetaGold 5%');
    console.log('\n🔗 Admin pages available at:');
    console.log('- /admin/bank-management - Manage interest rates');
    console.log('- /admin/user-management - Manage user VIP status');

  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('⚠️  VIP columns already exist in users table, skipping...');
    } else if (error.code === 'ER_TABLE_EXISTS') {
      console.log('⚠️  bank_interest_rates table already exists, skipping...');
    } else {
      console.error('❌ Error setting up VIP Bank System:', error);
    }
  } finally {
    await connection.end();
  }
}

setupVipBankSystem();
