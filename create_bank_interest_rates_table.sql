-- Create bank interest rates management table
-- Date: 2025-01-27

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
);

-- Insert default interest rates
INSERT INTO bank_interest_rates (currency_type, interest_rate, is_active, notes) VALUES
('peta', 5.00, TRUE, 'Default Peta interest rate for normal users'),
('petagold', 0.00, TRUE, 'Default PetaGold interest rate (no interest for normal users)');

-- Insert VIP interest rates
INSERT INTO bank_interest_rates (currency_type, interest_rate, is_active, notes) VALUES
('peta', 8.00, FALSE, 'VIP Peta interest rate'),
('petagold', 5.00, FALSE, 'VIP PetaGold interest rate');

-- Add index for better performance
CREATE INDEX idx_bank_interest_rates_currency ON bank_interest_rates(currency_type);
CREATE INDEX idx_bank_interest_rates_active ON bank_interest_rates(is_active);
