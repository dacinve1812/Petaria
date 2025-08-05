import React, { useState, useEffect } from 'react';
import './AdminSpiritEditor.css';

const AdminSpiritEditor = () => {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const [spirits, setSpirits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSpirit, setSelectedSpirit] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    image_url: '',
    rarity: 'common',
    max_stats_count: 2,
    stats: []
  });

  useEffect(() => {
    fetchSpirits();
  }, []);

  const fetchSpirits = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/spirits`);
      if (response.ok) {
        const data = await response.json();
        setSpirits(data);
      }
    } catch (error) {
      console.error('Error fetching spirits:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setFormData({
      name: '',
      description: '',
      image_url: '',
      rarity: 'common',
      max_stats_count: 2,
      stats: []
    });
    setSelectedSpirit(null);
    setShowForm(true);
  };

  const handleEdit = (spirit) => {
    setSelectedSpirit(spirit);
    setFormData({
      name: spirit.name,
      description: spirit.description,
      image_url: spirit.image_url,
      rarity: spirit.rarity,
      max_stats_count: spirit.max_stats_count,
      stats: spirit.stats || []
    });
    setShowForm(true);
  };

  const handleDelete = async (spiritId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa Linh Thú này?')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/spirits/${spiritId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        alert('Xóa Linh Thú thành công!');
        fetchSpirits();
      } else {
        const error = await response.json();
        alert(error.error || 'Lỗi khi xóa Linh Thú');
      }
    } catch (error) {
      console.error('Error deleting spirit:', error);
      alert('Lỗi khi xóa Linh Thú');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const url = selectedSpirit 
        ? `${API_BASE_URL}/api/admin/spirits/${selectedSpirit.id}`
        : `${API_BASE_URL}/api/admin/spirits`;
      
      const method = selectedSpirit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message);
        setShowForm(false);
        fetchSpirits();
      } else {
        const error = await response.json();
        alert(error.error || 'Lỗi khi lưu Linh Thú');
      }
    } catch (error) {
      console.error('Error saving spirit:', error);
      alert('Lỗi khi lưu Linh Thú');
    }
  };

  const addStat = () => {
    setFormData(prev => ({
      ...prev,
      stats: [...prev.stats, { stat_type: 'hp', stat_value: 0, stat_modifier: 'flat' }]
    }));
  };

  const removeStat = (index) => {
    setFormData(prev => ({
      ...prev,
      stats: prev.stats.filter((_, i) => i !== index)
    }));
  };

  const updateStat = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      stats: prev.stats.map((stat, i) => 
        i === index ? { ...stat, [field]: value } : stat
      )
    }));
  };

  const getRarityColor = (rarity) => {
    switch (rarity) {
      case 'common': return '#9d9d9d';
      case 'rare': return '#0070dd';
      case 'epic': return '#a335ee';
      case 'legendary': return '#ff8000';
      default: return '#9d9d9d';
    }
  };

  const getRarityText = (rarity) => {
    switch (rarity) {
      case 'common': return 'Thường';
      case 'rare': return 'Hiếm';
      case 'epic': return 'Epic';
      case 'legendary': return 'Huyền thoại';
      default: return 'Thường';
    }
  };

  if (loading) {
    return <div className="admin-spirit-loading">Đang tải...</div>;
  }

  return (
    <div className="admin-spirit-editor">
      <div className="admin-spirit-header">
        <h2>Quản Lý Linh Thú</h2>
        <button className="create-btn" onClick={handleCreateNew}>
          Tạo Linh Thú Mới
        </button>
      </div>

      {/* Spirit List */}
      <div className="spirit-list">
        {spirits.map((spirit) => (
          <div key={spirit.id} className="spirit-item">
            <div className="spirit-item-image">
              <img 
                src={`/images/spirit/${spirit.image_url}`} 
                alt={spirit.name}
                onError={(e) => {
                  e.target.src = '/images/spirit/angelpuss.gif';
                }}
              />
            </div>
            <div className="spirit-item-info">
              <h3>{spirit.name}</h3>
              <span 
                className="spirit-rarity"
                style={{ color: getRarityColor(spirit.rarity) }}
              >
                {getRarityText(spirit.rarity)}
              </span>
              <p>{spirit.description}</p>
              <div className="spirit-stats">
                {spirit.stats && spirit.stats.map((stat, index) => (
                  <span key={index} className="stat-badge">
                    {stat.stat_value >= 0 ? '+' : ''}{stat.stat_value}
                    {stat.stat_modifier === 'percentage' ? '%' : ''} {stat.stat_type.toUpperCase()}
                  </span>
                ))}
              </div>
            </div>
            <div className="spirit-item-actions">
              <button className="edit-btn" onClick={() => handleEdit(spirit)}>
                Sửa
              </button>
              <button className="delete-btn" onClick={() => handleDelete(spirit.id)}>
                Xóa
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="form-modal-overlay">
          <div className="form-modal">
            <h3>{selectedSpirit ? 'Sửa Linh Thú' : 'Tạo Linh Thú Mới'}</h3>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Tên:</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label>Mô tả:</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label>Hình ảnh (tên file):</label>
                <input
                  type="text"
                  value={formData.image_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, image_url: e.target.value }))}
                  placeholder="angelpuss.gif"
                  required
                />
              </div>

              <div className="form-group">
                <label>Độ hiếm:</label>
                <select
                  value={formData.rarity}
                  onChange={(e) => setFormData(prev => ({ ...prev, rarity: e.target.value }))}
                >
                  <option value="common">Thường</option>
                  <option value="rare">Hiếm</option>
                  <option value="epic">Epic</option>
                  <option value="legendary">Huyền thoại</option>
                </select>
              </div>

              <div className="form-group">
                <label>Số lượng stat tối đa:</label>
                <select
                  value={formData.max_stats_count}
                  onChange={(e) => setFormData(prev => ({ ...prev, max_stats_count: parseInt(e.target.value) }))}
                >
                  <option value={2}>2 (Rare)</option>
                  <option value={3}>3 (Epic)</option>
                  <option value={4}>4 (Legendary)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Stats:</label>
                <button type="button" className="add-stat-btn" onClick={addStat}>
                  Thêm Stat
                </button>
                
                {formData.stats.map((stat, index) => (
                  <div key={index} className="stat-input-group">
                    <select
                      value={stat.stat_type}
                      onChange={(e) => updateStat(index, 'stat_type', e.target.value)}
                    >
                      <option value="hp">HP</option>
                      <option value="mp">MP</option>
                      <option value="str">STR</option>
                      <option value="def">DEF</option>
                      <option value="spd">SPD</option>
                      <option value="intelligence">INT</option>
                    </select>
                    
                    <input
                      type="number"
                      value={stat.stat_value}
                      onChange={(e) => updateStat(index, 'stat_value', parseInt(e.target.value))}
                      placeholder="Giá trị"
                    />
                    
                    <select
                      value={stat.stat_modifier}
                      onChange={(e) => updateStat(index, 'stat_modifier', e.target.value)}
                    >
                      <option value="flat">Flat</option>
                      <option value="percentage">Percentage (%)</option>
                    </select>
                    
                    <button 
                      type="button" 
                      className="remove-stat-btn"
                      onClick={() => removeStat(index)}
                    >
                      Xóa
                    </button>
                  </div>
                ))}
              </div>

              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={() => setShowForm(false)}>
                  Hủy
                </button>
                <button type="submit" className="save-btn">
                  {selectedSpirit ? 'Cập nhật' : 'Tạo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSpiritEditor; 