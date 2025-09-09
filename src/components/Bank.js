import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserContext } from '../UserContext';
import GlobalBanner from './GlobalBanner';
import NavigationMenu from './NavigationMenu';
import { resolveAssetPath } from '../utils/pathUtils';
import './Bank.css';

function Bank() {
  const user = React.useContext(UserContext);
  const navigate = useNavigate();
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
  
  const [bankAccount, setBankAccount] = useState(null);
  const [userBalance, setUserBalance] = useState({ gold: 0, petagold: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [transactionAmount, setTransactionAmount] = useState('');
  const [transactionType, setTransactionType] = useState('deposit');
  const [currencyType, setCurrencyType] = useState('gold');
  const [showTransactionLogs, setShowTransactionLogs] = useState(false);
  const [transactionLogs, setTransactionLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Fetch bank account info
  const fetchBankAccount = async () => {
    if (!user?.userId) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/bank/account/${user.userId}`, {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setBankAccount(data);
      } else if (response.status === 404) {
        // User doesn't have bank account yet
        setBankAccount(null);
      } else {
        throw new Error('Failed to fetch bank account');
      }
    } catch (err) {
      console.error('Error fetching bank account:', err);
      setError('Không thể tải thông tin ngân hàng');
    }
  };

  // Fetch user balance
  const fetchUserBalance = async () => {
    if (!user?.userId) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/users/${user.userId}`, {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setUserBalance({ gold: data.gold || 0, petagold: data.petagold || 0 });
      }
    } catch (err) {
      console.error('Error fetching user balance:', err);
    }
  };

  // Collect daily interest
  const collectInterest = async () => {
    if (!user?.userId || !bankAccount) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/bank/collect-interest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({ userId: user.userId })
      });
      
      if (response.ok) {
        const data = await response.json();
        setSuccess(`Đã thu ${data.interestAmount} ${currencyType === 'gold' ? 'Gold' : 'PetaGold'} lãi suất!`);
        fetchBankAccount(); // Refresh bank account
        fetchUserBalance(); // Refresh user balance
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Không thể thu lãi suất');
      }
    } catch (err) {
      console.error('Error collecting interest:', err);
      setError('Lỗi khi thu lãi suất');
    }
  };

  // Handle transaction
  const handleTransaction = async (e) => {
    e.preventDefault();
    
    if (!user?.userId || !bankAccount) return;
    
    const amount = parseInt(transactionAmount);
    
    // Validation
    if (!amount || amount <= 0 || isNaN(amount)) {
      setError('Vui lòng nhập số tiền hợp lệ');
      return;
    }
    
    const currentBalance = currencyType === 'gold' ? userBalance.gold : userBalance.petagold;
    const bankBalance = currencyType === 'gold' ? bankAccount.gold_balance : bankAccount.petagold_balance;
    
    if (transactionType === 'deposit' && amount > currentBalance) {
      setError('Không đủ tiền để gửi');
      return;
    }
    
    if (transactionType === 'withdraw' && amount > bankBalance) {
      setError('Không đủ tiền trong tài khoản ngân hàng');
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/bank/transaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({
          userId: user.userId,
          type: transactionType,
          amount: amount,
          currencyType: currencyType
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setSuccess(data.message);
        setTransactionAmount('');
        fetchBankAccount();
        fetchUserBalance();
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Giao dịch thất bại');
      }
    } catch (err) {
      console.error('Error processing transaction:', err);
      setError('Lỗi khi thực hiện giao dịch');
    }
  };

  // Create bank account
  const createBankAccount = async () => {
    if (!user?.userId) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/bank/create-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({ userId: user.userId })
      });
      
      if (response.ok) {
        setSuccess('Đã tạo tài khoản ngân hàng thành công!');
        fetchBankAccount();
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Không thể tạo tài khoản ngân hàng');
      }
    } catch (err) {
      console.error('Error creating bank account:', err);
      setError('Lỗi khi tạo tài khoản ngân hàng');
    }
  };

  // Fetch transaction logs
  const fetchTransactionLogs = async () => {
    if (!user?.userId) return;
    
    setLoadingLogs(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/bank/transactions/${user.userId}?limit=50`, {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTransactionLogs(data.transactions || []);
      } else {
        setError('Không thể tải lịch sử giao dịch');
      }
    } catch (err) {
      console.error('Error fetching transaction logs:', err);
      setError('Lỗi khi tải lịch sử giao dịch');
    } finally {
      setLoadingLogs(false);
    }
  };

  // Show transaction logs modal
  const handleShowTransactionLogs = () => {
    setShowTransactionLogs(true);
    fetchTransactionLogs();
  };

  // Format transaction log entry
  const formatTransactionLog = (transaction) => {
    const date = new Date(transaction.created_at).toLocaleString('vi-VN');
    const type = transaction.transaction_type === 'deposit' ? 'Gửi' : 'Rút';
    const currency = transaction.currency_type === 'gold' ? 'Gold' : 'PetaGold';
    const amount = Math.round(transaction.amount).toLocaleString();
    
    return `${date} - ${type} ${amount} ${currency} (Từ: ${Math.round(transaction.balance_before).toLocaleString()} → ${Math.round(transaction.balance_after).toLocaleString()})`;
  };

  // Get transaction type class for styling
  const getTransactionTypeClass = (transaction) => {
    return transaction.transaction_type === 'deposit' ? 'log-entry-deposit' : 'log-entry-withdraw';
  };

  useEffect(() => {
    if (user === undefined) return;
    if (!user) {
      navigate('/login');
    }
  }, [navigate, user]);

  useEffect(() => {
    if (!user) return;
    fetchBankAccount();
    fetchUserBalance();
    setLoading(false);
  }, [user?.userId]);

  // Clear messages after 3 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  if (loading) {
    return (
      <div className="bank-page-container">
        <GlobalBanner
          backgroundImage={resolveAssetPath('/images/background/bank.jpg')}
          title="Ngân Hàng"
          showBackButton={true}
          className="small"
        />
        <NavigationMenu />
        <div className="bank-content">
          <div className="loading">Đang tải...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="bank-page-container">
        <GlobalBanner
          backgroundImage={resolveAssetPath('/images/background/bank.jpg')}
          title="Ngân Hàng"
          showBackButton={true}
          className="small"
        />
        <NavigationMenu />
        <div className="bank-content">
          <div className="error">Vui lòng đăng nhập để sử dụng ngân hàng</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bank-page-container">
      {/* Banner section */}
      <GlobalBanner
        backgroundImage={resolveAssetPath("/images/background/pet-bg-2.jpg")}
        title="Ngân hàng Petaria"
        showBackButton={true}
        className="small"
        backgroundPosition="70% 70%"
      />
      <NavigationMenu />
      
      {/* Bank content */}
      <div className="bank-content">
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        {!bankAccount ? (
        <div className="no-account">
          <div className="no-account-content">
            <h2>Bạn chưa có tài khoản ngân hàng</h2>
            <p>Hãy tạo tài khoản để bắt đầu gửi tiền và kiếm lãi suất!</p>
            <button onClick={createBankAccount} className="create-account-btn">
              Tạo Tài Khoản Ngân Hàng
            </button>
          </div>
        </div>
      ) : (
        
        <div className="bank-main-grid">

        
          {/* Account Info */}
          <div className="account-info">
            <h2>Thông Tin Tài Khoản</h2>
            <div className="balance-display">
              <div className="balance-item">
                <span className="balance-label">Số dư Gold:</span>
                <span className="balance-value">{Math.round(bankAccount.gold_balance).toLocaleString()} Gold</span>
              </div>
              <div className="balance-item">
                <span className="balance-label">Số dư PetaGold:</span>
                <span className="balance-value">{Math.round(bankAccount.petagold_balance).toLocaleString()} PetaGold</span>
              </div>
              <div className="balance-item">
                <span className="balance-label">Lãi suất:</span>
                <span className="balance-value">{bankAccount.interest_rate}%/năm</span>
              </div>
              <div className="balance-item">
                <span className="balance-label">Lãi hàng ngày:</span>
                <span className="balance-value">
                  {Math.round((bankAccount.gold_balance * (bankAccount.interest_rate / 100)) / 365).toLocaleString()} Gold
                </span>
              </div>
            </div>
            
            {!bankAccount.interest_collected_today && (
              <button onClick={collectInterest} className="collect-interest-btn">
                💰 Thu Lãi Suất Hôm Nay
              </button>
            )}
            
            {bankAccount.interest_collected_today && (
              <div className="interest-collected">
                ✅ Đã thu lãi suất hôm nay
              </div>
            )}
            
            <button onClick={handleShowTransactionLogs} className="view-logs-btn">
              📋 Xem Lịch Sử Giao Dịch
            </button>
          </div>

          {/* Transaction Form */}
          <div className="transaction-section">
            <h2>Giao Dịch</h2>
            <div className="user-balance">
              <h3>Số dư hiện tại:</h3>
              <div className="balance-display">
                <div className="balance-item">
                  <span className="balance-label">Gold:</span>
                  <span className="balance-value">{Math.round(userBalance.gold).toLocaleString()} Gold</span>
                </div>
                <div className="balance-item">
                  <span className="balance-label">PetaGold:</span>
                  <span className="balance-value">{Math.round(userBalance.petagold).toLocaleString()} PetaGold</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleTransaction} className="transaction-form">
              <div className="form-group">
                <label>Loại tiền:</label>
                <select 
                  value={currencyType} 
                  onChange={(e) => setCurrencyType(e.target.value)}
                  className="currency-select"
                >
                  <option value="gold">Gold</option>
                  <option value="petagold">PetaGold</option>
                </select>
              </div>

              <div className="form-group">
                <label>Loại giao dịch:</label>
                <div className="transaction-type">
                  <label className="radio-label">
                    <input
                      type="radio"
                      value="deposit"
                      checked={transactionType === 'deposit'}
                      onChange={(e) => setTransactionType(e.target.value)}
                    />
                    <span>Gửi tiền</span>
                  </label>
                  <label className="radio-label">
                    <input
                      type="radio"
                      value="withdraw"
                      checked={transactionType === 'withdraw'}
                      onChange={(e) => setTransactionType(e.target.value)}
                    />
                    <span>Rút tiền</span>
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label>Số tiền:</label>
                <input
                  type="number"
                  value={transactionAmount}
                  onChange={(e) => setTransactionAmount(e.target.value)}
                  placeholder="Nhập số tiền..."
                  min="1"
                  step="1"
                  className="amount-input"
                />
              </div>

              <button type="submit" className="transaction-btn">
                {transactionType === 'deposit' ? 'Gửi Tiền' : 'Rút Tiền'}
              </button>
            </form>
          </div>

        </div>
      )}
      
      {/* Bank Info */}
      <div className="bank-info">
        <h3>💡 Thông tin quan trọng:</h3>
        <ul>
          <li>Lãi suất được tính hàng ngày và có thể thu một lần mỗi ngày</li>
          <li>Hãy nhớ quay lại mỗi ngày để thu lãi suất!</li>
          <li>Bạn có thể gửi/rút cả Gold và PetaGold</li>
          <li>Số tiền trong ngân hàng được bảo vệ an toàn</li>
        </ul>
      </div>
      </div>

      {/* Transaction Logs Modal */}
      {showTransactionLogs && (
        <div className="modal-overlay" onClick={() => setShowTransactionLogs(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📋 Lịch Sử Giao Dịch</h2>
              <button 
                className="close-modal-btn" 
                onClick={() => setShowTransactionLogs(false)}
              >
                ✕
              </button>
            </div>
            
            <div className="modal-body">
              {loadingLogs ? (
                <div className="loading-logs">Đang tải lịch sử giao dịch...</div>
              ) : transactionLogs.length === 0 ? (
                <div className="no-logs">Chưa có giao dịch nào</div>
              ) : (
                <div className="transaction-logs">
                  {transactionLogs.map((transaction, index) => (
                    <div key={transaction.id} className={`log-entry ${getTransactionTypeClass(transaction)}`}>
                      {formatTransactionLog(transaction)}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="modal-footer">
              <button 
                className="close-modal-btn-secondary" 
                onClick={() => setShowTransactionLogs(false)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Bank;
