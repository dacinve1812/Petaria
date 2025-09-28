// File: GlobalConfigModal.js
import React, { useState, useEffect } from 'react';
import { useUser } from '../../UserContext';

function GlobalConfigModal({ onClose, onConfigUpdated }) {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const { user } = useUser();

  const [configs, setConfigs] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadGlobalConfig();
  }, []);

  const loadGlobalConfig = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/global-config`, {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setConfigs(data);
      } else {
        console.error('Failed to load global config');
      }
    } catch (error) {
      console.error('Error loading global config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveConfig = async (configKey, newValue) => {
    setIsSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/global-config/${configKey}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({
          config_value: newValue
        })
      });

      if (response.ok) {
        alert('Cấu hình đã được cập nhật thành công!');
        onConfigUpdated();
        loadGlobalConfig(); // Reload to get updated timestamp
      } else {
        const error = await response.json();
        alert(`Lỗi: ${error.message || 'Không thể cập nhật cấu hình'}`);
      }
    } catch (error) {
      console.error('Error updating config:', error);
      alert('Lỗi khi cập nhật cấu hình');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetTimeChange = (e) => {
    const newValue = e.target.value;
    setConfigs(prev => ({
      ...prev,
      global_reset_time: {
        ...prev.global_reset_time,
        value: newValue
      }
    }));
  };

  const handleSaveResetTime = () => {
    if (configs.global_reset_time?.value) {
      handleSaveConfig('global_reset_time', configs.global_reset_time.value);
    }
  };

  if (isLoading) {
    return (
      <div className="admin-modal-overlay">
        <div className="admin-modal">
          <div className="admin-modal-header">
            <h3>Global Configuration</h3>
            <button className="admin-close-btn" onClick={onClose}>×</button>
          </div>
          <div style={{ padding: '24px', textAlign: 'center' }}>
            <div>Loading configuration...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-modal-overlay">
      <div className="admin-modal" style={{ maxWidth: '600px' }}>
        <div className="admin-modal-header">
          <h3>Global Configuration</h3>
          <button className="admin-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="admin-form" style={{ padding: '24px' }}>
          {/* Global Reset Time Section */}
          <div className="config-section">
            <h4 style={{ marginBottom: '16px', color: '#333', fontSize: '16px' }}>
              🕒 Global Reset Time
            </h4>
            <div className="admin-form-group">
              <label htmlFor="global-reset-time">Reset Time (24-hour format):</label>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <input
                  id="global-reset-time"
                  type="time"
                  value={configs.global_reset_time?.value || '06:00'}
                  onChange={handleResetTimeChange}
                  disabled={isSaving}
                  className="admin-form-control"
                  style={{ width: '120px' }}
                />
                <button 
                  className="admin-btn-primary"
                  onClick={handleSaveResetTime}
                  disabled={isSaving}
                  style={{ padding: '8px 16px' }}
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
              <small className="admin-form-text">
                Tất cả shop restock timers sẽ dựa vào giờ reset này. 
                Ví dụ: Nếu set 06:00, shop sẽ reset vào 6:00 AM mỗi ngày.
              </small>
            </div>
            
            {configs.global_reset_time?.updated_at && (
              <div style={{ 
                fontSize: '12px', 
                color: '#666', 
                marginTop: '8px',
                padding: '8px',
                backgroundColor: '#f8f9fa',
                borderRadius: '4px'
              }}>
                Last updated: {new Date(configs.global_reset_time.updated_at).toLocaleString()}
              </div>
            )}
          </div>

          {/* Future Configuration Sections */}
          <div className="config-section" style={{ marginTop: '32px' }}>
            <h4 style={{ marginBottom: '16px', color: '#333', fontSize: '16px' }}>
              🔧 Future Configurations
            </h4>
            <div style={{ 
              padding: '16px', 
              backgroundColor: '#f8f9fa', 
              borderRadius: '8px',
              color: '#666',
              fontSize: '14px'
            }}>
              <p>• Cronjob Management (Coming Soon)</p>
              <p>• Server Maintenance Windows (Coming Soon)</p>
              <p>• Event Schedules (Coming Soon)</p>
            </div>
          </div>

          <div className="admin-form-actions" style={{ marginTop: '32px' }}>
            <button 
              className="admin-btn-secondary" 
              onClick={onClose}
              disabled={isSaving}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GlobalConfigModal;
