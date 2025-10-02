import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../UserContext';
import './AdminMailTest.css';

const AdminMailTest = () => {
  const { user, isLoading } = useUser();
  const navigate = useNavigate();
  const [recipientType, setRecipientType] = useState('single'); // 'single' or 'all'
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedMailType, setSelectedMailType] = useState('1');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [customMode, setCustomMode] = useState(false);
  const [customSubject, setCustomSubject] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [customPeta, setCustomPeta] = useState(0);
  const [customPetaGold, setCustomPetaGold] = useState(0);
  const [customItems, setCustomItems] = useState([{ item_id: 47, quantity: 1 }]);
  const [availableItems, setAvailableItems] = useState([]);
  
  // New state for spirits and pets gifting
  const [customSpirits, setCustomSpirits] = useState([]);
  const [customPets, setCustomPets] = useState([]);
  const [availableSpirits, setAvailableSpirits] = useState([]);
  const [availablePets, setAvailablePets] = useState([]);

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

  // Test mail templates
  const mailTemplates = [
    {
      id: '1',
      subject: 'Hoàn thành nhiệm vụ nhận quà',
      message: 'Chúc mừng! Bạn đã hoàn thành nhiệm vụ và nhận được phần thưởng.',
      attached_rewards: {
        peta: 100,
        peta_gold: 50,
        items: [{ item_id: 47, quantity: 1 }]
      }
    },
    {
      id: '2',
      subject: 'Phần thưởng đăng nhập hàng ngày',
      message: 'Phần thưởng đăng nhập hàng ngày của bạn đã sẵn sàng!',
      attached_rewards: {
        peta: 50,
        items: [{ item_id: 47, quantity: 2 }]
      }
    },
    {
      id: '3',
      subject: 'Sự kiện đặc biệt - Quà tặng',
      message: 'Tham gia sự kiện đặc biệt và nhận quà tặng!',
      attached_rewards: {
        peta_gold: 100,
        items: [{ item_id: 47, quantity: 3 }]
      }
    },
    {
      id: '4',
      subject: 'Nhiệm vụ tuần hoàn',
      message: 'Hoàn thành nhiệm vụ tuần hoàn và nhận phần thưởng!',
      attached_rewards: {
        peta: 200,
        items: [{ item_id: 47, quantity: 1 }]
      }
    },
    {
      id: '5',
      subject: 'Quà tặng sinh nhật',
      message: 'Chúc mừng sinh nhật! Đây là quà tặng đặc biệt dành cho bạn.',
      attached_rewards: {
        peta: 500,
        peta_gold: 200,
        items: [{ item_id: 47, quantity: 5 }]
      }
    },
    {
      id: '6',
      subject: 'Thông báo bảo trì',
      message: 'Hệ thống sẽ bảo trì trong 2 giờ tới. Cảm ơn sự kiên nhẫn của bạn.',
      attached_rewards: {}
    }
  ];

  // Fetch available items, spirits, and pets
  React.useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch items
        const itemsResponse = await fetch(`${API_BASE_URL}/api/admin/items`);
        if (itemsResponse.ok) {
          const items = await itemsResponse.json();
          setAvailableItems(items);
        }

        // Fetch spirits
        const spiritsResponse = await fetch(`${API_BASE_URL}/api/spirits`);
        if (spiritsResponse.ok) {
          const spirits = await spiritsResponse.json();
          setAvailableSpirits(spirits);
        }

        // Fetch pets (we'll need to create an admin endpoint for this)
        const petsResponse = await fetch(`${API_BASE_URL}/api/admin/pets`);
        if (petsResponse.ok) {
          const pets = await petsResponse.json();
          setAvailablePets(pets);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };
    fetchData();
  }, []);

  // Update custom fields when template changes
  React.useEffect(() => {
    if (!customMode && selectedMailType) {
      const template = mailTemplates.find(t => t.id === selectedMailType);
      if (template) {
        setCustomSubject(template.subject);
        setCustomMessage(template.message);
        setCustomPeta(template.attached_rewards.peta || 0);
        setCustomPetaGold(template.attached_rewards.peta_gold || 0);
        setCustomItems(template.attached_rewards.items || []);
      }
    }
  }, [selectedMailType, customMode]);

  useEffect(() => {
    if (!isLoading && (!user || !user.isAdmin)) {
      navigate('/login');
    }
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!user || !user.isAdmin) {
    return null;
  }

  const handleAddItem = () => {
    setCustomItems([...customItems, { item_id: 47, quantity: 1 }]);
  };

  const handleRemoveItem = (index) => {
    const newItems = customItems.filter((_, i) => i !== index);
    setCustomItems(newItems);
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...customItems];
    newItems[index] = { ...newItems[index], [field]: parseInt(value) || 0 };
    setCustomItems(newItems);
  };

  // New handlers for spirits
  const handleAddSpirit = () => {
    setCustomSpirits([...customSpirits, { spirit_id: '', quantity: 1 }]);
  };

  const handleRemoveSpirit = (index) => {
    const newSpirits = customSpirits.filter((_, i) => i !== index);
    setCustomSpirits(newSpirits);
  };

  const handleSpiritChange = (index, field, value) => {
    const newSpirits = [...customSpirits];
    newSpirits[index] = { ...newSpirits[index], [field]: parseInt(value) || 0 };
    setCustomSpirits(newSpirits);
  };

  // New handlers for pets
  const handleAddPet = () => {
    setCustomPets([...customPets, { pet_id: '', quantity: 1 }]);
  };

  const handleRemovePet = (index) => {
    const newPets = customPets.filter((_, i) => i !== index);
    setCustomPets(newPets);
  };

  const handlePetChange = (index, field, value) => {
    const newPets = [...customPets];
    newPets[index] = { ...newPets[index], [field]: parseInt(value) || 0 };
    setCustomPets(newPets);
  };

  const getCurrentRewards = () => {
    if (customMode) {
      return {
        peta: customPeta > 0 ? customPeta : undefined,
        peta_gold: customPetaGold > 0 ? customPetaGold : undefined,
        items: customItems.filter(item => item.item_id > 0 && item.quantity > 0),
        spirits: customSpirits.filter(spirit => spirit.spirit_id > 0 && spirit.quantity > 0),
        pets: customPets.filter(pet => pet.pet_id > 0 && pet.quantity > 0)
      };
    } else {
      const template = mailTemplates.find(t => t.id === selectedMailType);
      return template ? template.attached_rewards : {};
    }
  };

  const handleSendMail = async () => {
    if (recipientType === 'single' && !selectedUserId) {
      setMessage('Vui lòng chọn User ID');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const subject = customMode ? customSubject : mailTemplates.find(t => t.id === selectedMailType)?.subject;
      const messageText = customMode ? customMessage : mailTemplates.find(t => t.id === selectedMailType)?.message;
      const attached_rewards = getCurrentRewards();
      
      // Choose endpoint based on recipient type
      const endpoint = recipientType === 'all' 
        ? `${API_BASE_URL}/api/admin/mails/broadcast`
        : `${API_BASE_URL}/api/admin/mails/system-send`;
      
      const body = recipientType === 'all'
        ? {
            subject,
            message: messageText,
            attached_rewards,
            expire_days: 30
          }
        : {
            user_id: parseInt(selectedUserId),
            subject,
            message: messageText,
            attached_rewards,
            expire_days: 30
          };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`,
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const result = await response.json();
        if (recipientType === 'all') {
          setMessage(`✅ Gửi mail thành công đến ${result.sent_count || 'tất cả'} users: ${subject}`);
        } else {
          setMessage(`✅ Gửi mail thành công: ${subject}`);
        }
      } else {
        const errorData = await response.json();
        if (response.status === 404) {
          setMessage(`❌ Lỗi: User ID ${selectedUserId} không tồn tại trong hệ thống`);
        } else {
          setMessage(`❌ Lỗi: ${errorData.error || 'Không thể gửi mail'}`);
        }
      }
    } catch (error) {
      console.error('Error sending mail:', error);
      setMessage('❌ Lỗi kết nối khi gửi mail');
    } finally {
      setLoading(false);
    }
  };

  const handleSendAllMails = async () => {
    if (recipientType === 'single' && !selectedUserId) {
      setMessage('Vui lòng chọn User ID');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      let successCount = 0;
      let errorCount = 0;

      if (customMode) {
        // Send custom mail multiple times
        for (let i = 0; i < 6; i++) {
          try {
            const response = await fetch(`${API_BASE_URL}/api/admin/mails/system-send`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${user.token}`,
              },
              body: JSON.stringify({
                user_id: parseInt(selectedUserId),
                subject: customSubject,
                message: customMessage,
                attached_rewards: getCurrentRewards(),
                expire_days: 30
              }),
            });

            if (response.ok) {
              successCount++;
            } else {
              errorCount++;
            }
          } catch (error) {
            errorCount++;
          }
        }
      } else {
        // Send all template mails
        for (const template of mailTemplates) {
          try {
            const response = await fetch(`${API_BASE_URL}/api/admin/mails/system-send`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${user.token}`,
              },
              body: JSON.stringify({
                user_id: parseInt(selectedUserId),
                subject: template.subject,
                message: template.message,
                attached_rewards: template.attached_rewards,
                expire_days: 30
              }),
            });

            if (response.ok) {
              successCount++;
            } else {
              errorCount++;
            }
          } catch (error) {
            errorCount++;
          }
        }
      }

      setMessage(`🎉 Hoàn thành! Thành công: ${successCount}, Lỗi: ${errorCount}`);
    } catch (error) {
      console.error('Error sending all mails:', error);
      setMessage('❌ Lỗi kết nối khi gửi mail');
    } finally {
      setLoading(false);
    }
  };

  const currentRewards = getCurrentRewards();

  return (
    <div className="admin-mail-test">
      <div className="admin-mail-test-header">
        <h1>Gửi Test Mail</h1>
        <button className="back-btn" onClick={() => navigate('/admin')}>
          ← Quay lại Admin
        </button>
      </div>

      <div className="admin-mail-test-content">
        <div className="form-group">
          <label>Gửi đến:</label>
          <select
            value={recipientType}
            onChange={(e) => setRecipientType(e.target.value)}
          >
            <option value="single">1 User cụ thể</option>
            <option value="all">Tất cả Users</option>
          </select>
        </div>

        {recipientType === 'single' && (
          <div className="form-group">
            <label>User ID:</label>
            <input
              type="number"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              placeholder="Nhập User ID"
              min="1"
            />
          </div>
        )}

        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={customMode}
              onChange={(e) => setCustomMode(e.target.checked)}
            />
            Chế độ tùy chỉnh
          </label>
        </div>

        {!customMode && (
          <div className="form-group">
            <label>Loại Mail:</label>
            <select
              value={selectedMailType}
              onChange={(e) => setSelectedMailType(e.target.value)}
            >
              {mailTemplates.map(template => (
                <option key={template.id} value={template.id}>
                  {template.subject}
                </option>
              ))}
            </select>
          </div>
        )}

        {customMode && (
          <>
            <div className="form-group">
              <label>Tiêu đề:</label>
              <input
                type="text"
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                placeholder="Nhập tiêu đề mail"
              />
            </div>

            <div className="form-group">
              <label>Nội dung:</label>
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Nhập nội dung mail"
                rows="3"
              />
            </div>

            <div className="rewards-section">
              <h3>Phần thưởng</h3>
              
              <div className="currency-rewards">
                <div className="form-group">
                  <label>Peta:</label>
                  <input
                    type="number"
                    value={customPeta}
                    onChange={(e) => setCustomPeta(parseInt(e.target.value) || 0)}
                    min="0"
                  />
                </div>

                <div className="form-group">
                  <label>Peta Gold:</label>
                  <input
                    type="number"
                    value={customPetaGold}
                    onChange={(e) => setCustomPetaGold(parseInt(e.target.value) || 0)}
                    min="0"
                  />
                </div>
              </div>

              <div className="items-section">
                <div className="items-header">
                  <h4>Items:</h4>
                  <button className="add-item-btn" onClick={handleAddItem}>
                    + Thêm Item
                  </button>
                </div>

                {customItems.map((item, index) => (
                  <div key={index} className="item-row">
                    <select
                      value={item.item_id}
                      onChange={(e) => handleItemChange(index, 'item_id', e.target.value)}
                    >
                      <option value="">Chọn item</option>
                      {availableItems.map(availableItem => (
                        <option key={availableItem.id} value={availableItem.id}>
                          {availableItem.name} (ID: {availableItem.id})
                        </option>
                      ))}
                    </select>
                    
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                      placeholder="Số lượng"
                      min="1"
                    />
                    
                    <button 
                      className="remove-item-btn"
                      onClick={() => handleRemoveItem(index)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              {/* Spirits Section */}
              <div className="rewards-section">
                <h3>Spirits:</h3>
                <div className="items-header">
                  <h4>Items:</h4>
                  <button className="add-item-btn" onClick={handleAddSpirit}>
                    + Thêm Spirit
                  </button>
                </div>
                {customSpirits.map((spirit, index) => (
                  <div key={index} className="item-row">
                    <select
                      value={spirit.spirit_id}
                      onChange={(e) => handleSpiritChange(index, 'spirit_id', e.target.value)}
                    >
                      <option value="">Chọn Spirit</option>
                      {availableSpirits.map(availableSpirit => (
                        <option key={availableSpirit.id} value={availableSpirit.id}>
                          {availableSpirit.name} (ID: {availableSpirit.id})
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={spirit.quantity}
                      onChange={(e) => handleSpiritChange(index, 'quantity', e.target.value)}
                      placeholder="Số lượng"
                      min="1"
                    />
                    <button 
                      className="remove-item-btn"
                      onClick={() => handleRemoveSpirit(index)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              {/* Pets Section */}
              <div className="rewards-section">
                <h3>Pets:</h3>
                <div className="items-header">
                  <h4>Items:</h4>
                  <button className="add-item-btn" onClick={handleAddPet}>
                    + Thêm Pet
                  </button>
                </div>
                {customPets.map((pet, index) => (
                  <div key={index} className="item-row">
                    <select
                      value={pet.pet_id}
                      onChange={(e) => handlePetChange(index, 'pet_id', e.target.value)}
                    >
                      <option value="">Chọn Pet</option>
                      {availablePets.map(availablePet => (
                        <option key={availablePet.id} value={availablePet.id}>
                          {availablePet.name} (ID: {availablePet.id})
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={pet.quantity}
                      onChange={(e) => handlePetChange(index, 'quantity', e.target.value)}
                      placeholder="Số lượng"
                      min="1"
                    />
                    <button 
                      className="remove-item-btn"
                      onClick={() => handleRemovePet(index)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="mail-preview">
          <h3>Xem trước Mail:</h3>
          <div className="preview-content">
            <p><strong>Tiêu đề:</strong> {customMode ? customSubject : mailTemplates.find(t => t.id === selectedMailType)?.subject}</p>
            <p><strong>Nội dung:</strong> {customMode ? customMessage : mailTemplates.find(t => t.id === selectedMailType)?.message}</p>
            <p><strong>Phần thưởng:</strong></p>
            <ul>
              {currentRewards.peta && (
                <li>Peta: +{currentRewards.peta}</li>
              )}
              {currentRewards.peta_gold && (
                <li>Peta Gold: +{currentRewards.peta_gold}</li>
              )}
              {currentRewards.items && currentRewards.items.map((item, index) => {
                const itemDetail = availableItems.find(i => i.id === item.item_id);
                return (
                  <li key={index}>
                    {itemDetail ? itemDetail.name : `Item ${item.item_id}`}: x{item.quantity}
                  </li>
                );
              })}
              {currentRewards.spirits && currentRewards.spirits.map((spirit, index) => {
                const spiritDetail = availableSpirits.find(s => s.id === spirit.spirit_id);
                return (
                  <li key={index}>
                    {spiritDetail ? spiritDetail.name : `Spirit ${spirit.spirit_id}`}: x{spirit.quantity}
                  </li>
                );
              })}
              {currentRewards.pets && currentRewards.pets.map((pet, index) => {
                const petDetail = availablePets.find(p => p.id === pet.pet_id);
                return (
                  <li key={index}>
                    {petDetail ? petDetail.name : `Pet ${pet.pet_id}`}: x{pet.quantity}
                  </li>
                );
              })}
              {!currentRewards.peta && !currentRewards.peta_gold && 
               (!currentRewards.items || currentRewards.items.length === 0) && (
                <li>Không có phần thưởng</li>
              )}
            </ul>
          </div>
        </div>

        <div className="action-buttons">
          <button
            className="send-single-btn"
            onClick={handleSendMail}
            disabled={loading || !selectedUserId}
          >
            {loading ? 'Đang gửi...' : 'Gửi Mail Đơn'}
          </button>
          
          <button
            className="send-all-btn"
            onClick={handleSendAllMails}
            disabled={loading || !selectedUserId}
          >
            {loading ? 'Đang gửi...' : 'Gửi Tất Cả Mail'}
          </button>
        </div>

        {message && (
          <div className={`message ${message.includes('✅') ? 'success' : 'error'}`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminMailTest; 
