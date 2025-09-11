import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './AdminBankManagement.css';

const AdminBankManagement = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [interestRates, setInterestRates] = useState({
    peta: { normal: 5.00, vip: 8.00 },
    petagold: { normal: 0.00, vip: 5.00 }
  });
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');


  useEffect(() => {
    // Load user info
    const token = localStorage.getItem('token');
    const isAdmin = localStorage.getItem('isAdmin') === 'true';
    
    if (token) {
      try {
        const decoded = JSON.parse(atob(token.split('.')[1]));
        setUser({
          userId: decoded.userId,
          isAdmin,
          token,
          role: isAdmin ? 'admin' : 'user'
        });
      } catch (err) {
        console.error('Invalid token');
        setUser(null);
      }
    } else {
      setUser(null);
    }
    
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user && user.isAdmin) {
      fetchInterestRates();
    }
  }, [user]);

  const fetchInterestRates = async () => {
    try {
      const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
      const response = await fetch(`${API_BASE_URL}/api/admin/bank/interest-rates`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setInterestRates(data);
      }
    } catch (error) {
      console.error('Error fetching interest rates:', error);
    }
  };

  const updateInterestRate = async (currency, userType, newRate) => {
    setLoading(true);
    setMessage('');
    
    try {
      const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
      const response = await fetch(`${API_BASE_URL}/api/admin/bank/interest-rates`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          currency_type: currency,
          user_type: userType,
          interest_rate: parseFloat(newRate)
        })
      });

      if (response.ok) {
        setMessage(`Successfully updated ${currency} ${userType} interest rate to ${newRate}%`);
        setMessageType('success');
        fetchInterestRates(); // Refresh data
      } else {
        const error = await response.json();
        setMessage(error.message || 'Failed to update interest rate');
        setMessageType('error');
      }
    } catch (error) {
      setMessage('Error updating interest rate');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleRateChange = (currency, userType, value) => {
    const newRates = { ...interestRates };
    newRates[currency][userType] = parseFloat(value) || 0;
    setInterestRates(newRates);
  };

  const handleSave = (currency, userType) => {
    const rate = interestRates[currency][userType];
    updateInterestRate(currency, userType, rate);
  };

  // Show loading while user is being loaded
  if (loading) {
    return (
      <div className="admin-bank-management">
        <div className="access-denied">
          <h2>Loading...</h2>
          <p>Please wait while we verify your access.</p>
        </div>
      </div>
    );
  }

  if (!user || !user.isAdmin) {
    return (
      <div className="admin-bank-management">
        <div className="access-denied">
          <h2>Access Denied</h2>
          <p>You need admin privileges to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-bank-management">
      <div className="admin-header">          
          <div className="header-text">
            <h1>Bank Interest Rate Management</h1>
            <p>Manage interest rates for different user types and currencies</p>
          </div>
          <button 
            className="back-admin-btn"
            onClick={() => navigate('/admin')}
            title="Back to Admin Panel"
          >
            ← Back to Admin
          </button>
      </div>

      {message && (
        <div className={`message ${messageType}`}>
          {message}
        </div>
      )}

      <div className="interest-rates-grid">
        {/* Normal Users */}
        <div className="user-type-section">
          <h2>Normal Users</h2>
          
          <div className="rate-control">
            <label>Peta Interest Rate:</label>
            <div className="input-group">
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={interestRates.peta.normal}
                onChange={(e) => handleRateChange('peta', 'normal', e.target.value)}
                disabled={loading}
              />
              <span>%</span>
              <button 
                onClick={() => handleSave('peta', 'normal')}
                disabled={loading}
                className="save-btn"
              >
                Save
              </button>
            </div>
          </div>

          <div className="rate-control">
            <label>PetaGold Interest Rate:</label>
            <div className="input-group">
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={interestRates.petagold.normal}
                onChange={(e) => handleRateChange('petagold', 'normal', e.target.value)}
                disabled={loading}
                className="disabled-input"
              />
              <span>%</span>
              <button 
                onClick={() => handleSave('petagold', 'normal')}
                disabled={loading}
                className="save-btn"
              >
                Save
              </button>
            </div>
            <small className="note">Normal users cannot deposit PetaGold</small>
          </div>
        </div>

        {/* VIP Users */}
        <div className="user-type-section">
          <h2>VIP Users</h2>
          
          <div className="rate-control">
            <label>Peta Interest Rate:</label>
            <div className="input-group">
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={interestRates.peta.vip}
                onChange={(e) => handleRateChange('peta', 'vip', e.target.value)}
                disabled={loading}
              />
              <span>%</span>
              <button 
                onClick={() => handleSave('peta', 'vip')}
                disabled={loading}
                className="save-btn"
              >
                Save
              </button>
            </div>
          </div>

          <div className="rate-control">
            <label>PetaGold Interest Rate:</label>
            <div className="input-group">
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={interestRates.petagold.vip}
                onChange={(e) => handleRateChange('petagold', 'vip', e.target.value)}
                disabled={loading}
              />
              <span>%</span>
              <button 
                onClick={() => handleSave('petagold', 'vip')}
                disabled={loading}
                className="save-btn"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="info-section">
        <h3>Current System Logic</h3>
        <ul>
          <li><strong>Normal Users:</strong> Can only deposit/withdraw Peta. PetaGold features are hidden.</li>
          <li><strong>VIP Users:</strong> Can deposit/withdraw both Peta and PetaGold with higher interest rates.</li>
          <li><strong>Interest Calculation:</strong> Daily compound interest based on current balance.</li>
          <li><strong>Rate Updates:</strong> Changes take effect immediately for new deposits.</li>
        </ul>
      </div>
    </div>
  );
};

export default AdminBankManagement;
