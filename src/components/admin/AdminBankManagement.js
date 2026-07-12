import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../UserContext';
import './AdminBankManagement.css';

const AdminBankManagement = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useUser();
  const [saving, setSaving] = useState(false);
  const [interestRates, setInterestRates] = useState({
    peta: { normal: 5.0, vip: 8.0 },
    petagold: { normal: 0.0, vip: 5.0 },
  });
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user || !user.isAdmin) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user?.isAdmin && user?.token) {
      fetchInterestRates();
    }
  }, [user?.isAdmin, user?.token]);

  const fetchInterestRates = async () => {
    try {
      const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
      const response = await fetch(`${API_BASE_URL}/api/admin/bank/interest-rates`, {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
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
    setSaving(true);
    setMessage('');

    try {
      const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
      const response = await fetch(`${API_BASE_URL}/api/admin/bank/interest-rates`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          currency_type: currency,
          user_type: userType,
          interest_rate: parseFloat(newRate),
        }),
      });

      if (response.ok) {
        setMessage(`Successfully updated ${currency} ${userType} interest rate to ${newRate}%`);
        setMessageType('success');
        fetchInterestRates();
      } else {
        const error = await response.json().catch(() => ({}));
        setMessage(error.message || error.error || 'Failed to update interest rate');
        setMessageType('error');
      }
    } catch (error) {
      setMessage('Error updating interest rate');
      setMessageType('error');
    } finally {
      setSaving(false);
    }
  };

  const handleRateChange = (currency, userType, value) => {
    setInterestRates((prev) => ({
      ...prev,
      [currency]: {
        ...prev[currency],
        [userType]: parseFloat(value) || 0,
      },
    }));
  };

  const handleSave = (currency, userType) => {
    const rate = interestRates[currency][userType];
    updateInterestRate(currency, userType, rate);
  };

  if (authLoading) {
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
          type="button"
          className="back-admin-btn"
          onClick={() => navigate('/admin')}
          title="Back to Admin Panel"
        >
          ← Back to Admin
        </button>
      </div>

      {message && <div className={`message ${messageType}`}>{message}</div>}

      <div className="interest-rates-grid">
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
                disabled={saving}
              />
              <span>%</span>
              <button
                type="button"
                onClick={() => handleSave('peta', 'normal')}
                disabled={saving}
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
                disabled={saving}
                className="disabled-input"
              />
              <span>%</span>
              <button
                type="button"
                onClick={() => handleSave('petagold', 'normal')}
                disabled={saving}
                className="save-btn"
              >
                Save
              </button>
            </div>
            <small className="note">Normal users cannot deposit PetaGold</small>
          </div>
        </div>

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
                disabled={saving}
              />
              <span>%</span>
              <button
                type="button"
                onClick={() => handleSave('peta', 'vip')}
                disabled={saving}
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
                disabled={saving}
              />
              <span>%</span>
              <button
                type="button"
                onClick={() => handleSave('petagold', 'vip')}
                disabled={saving}
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
          <li>
            <strong>Normal Users:</strong> Can only deposit/withdraw Peta. PetaGold features are
            hidden.
          </li>
          <li>
            <strong>VIP Users:</strong> Can deposit/withdraw both Peta and PetaGold with higher
            interest rates.
          </li>
          <li>
            <strong>Interest Calculation:</strong> Daily compound interest based on current balance.
          </li>
          <li>
            <strong>Rate Updates:</strong> Changes take effect immediately for new deposits.
          </li>
        </ul>
      </div>
    </div>
  );
};

export default AdminBankManagement;
