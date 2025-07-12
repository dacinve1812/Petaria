import React, { useState, useEffect } from 'react';
import './BrokenEquipmentModal.css';

function BrokenEquipmentModal({ onClose, userId }) {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const [brokenEquipment, setBrokenEquipment] = useState([]);
  const [repairKits, setRepairKits] = useState([]);
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [selectedKit, setSelectedKit] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchBrokenEquipment();
    fetchRepairKits();
  }, [userId]);

  const fetchBrokenEquipment = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/${userId}/broken-equipment`);
      const data = await res.json();
      setBrokenEquipment(data);
    } catch (err) {
      console.error('Error fetching broken equipment:', err);
    }
  };

  const fetchRepairKits = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/${userId}/inventory`);
      const data = await res.json();
      // Lọc chỉ lấy Repair Kit
      const repairKitItems = data.filter(item => item.type === 'repair_kit');
      setRepairKits(repairKitItems);
    } catch (err) {
      console.error('Error fetching repair kits:', err);
    }
  };

  const handleRepairWithKit = async () => {
    if (!selectedEquipment || !selectedKit) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/inventory/${selectedEquipment.id}/repair-with-kit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repair_kit_item_id: selectedKit })
      });

      const result = await res.json();
      if (res.ok) {
        alert(`${result.message}\nRepair Kit: ${result.repair_kit_used}\nHiệu quả: ${result.effectiveness}\nDurability: ${result.durability_left}/${result.max_durability}`);
        fetchBrokenEquipment();
        fetchRepairKits();
        setSelectedEquipment(null);
        setSelectedKit('');
      } else {
        alert(result.message);
      }
    } catch (err) {
      console.error('Error repairing equipment:', err);
      alert('Lỗi khi sửa chữa equipment');
    } finally {
      setLoading(false);
    }
  };

  const handleRepairWithBlacksmith = async (equipment) => {
    if (!window.confirm(`Sửa chữa ${equipment.item_name} bằng Blacksmith? (Giá sẽ được tính dựa trên rarity và power)`)) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/inventory/${equipment.id}/repair-with-blacksmith`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      });

      const result = await res.json();
      if (res.ok) {
        alert(result.message);
        fetchBrokenEquipment();
      } else {
        alert(result.message);
      }
    } catch (err) {
      console.error('Error repairing with blacksmith:', err);
      alert('Lỗi khi sửa chữa equipment');
    } finally {
      setLoading(false);
    }
  };

  const getRarityColor = (rarity) => {
    const colors = {
      common: '#ccc',
      uncommon: '#6cc27c',
      rare: '#3b82f6',
      epic: '#a855f7',
      legendary: '#facc15',
    };
    return colors[rarity] || '#999';
  };

  // Hàm tính hiệu quả repair (giống backend)
  const getRepairEffectiveness = (repairKitRarity, equipmentRarity) => {
    const effectivenessMap = {
      common: {
        common: 100,
        uncommon: 50,
        rare: 10,
        epic: 0,
        legendary: 0
      },
      rare: {
        common: 100,
        uncommon: 75,
        rare: 50,
        epic: 10,
        legendary: 0
      },
      epic: {
        common: 100,
        uncommon: 85,
        rare: 70,
        epic: 50,
        legendary: 10
      },
      legendary: {
        common: 100,
        uncommon: 100,
        rare: 100,
        epic: 100,
        legendary: 100
      }
    };

    return effectivenessMap[repairKitRarity]?.[equipmentRarity] || 0;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content broken-equipment-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2 className="modal-title">Equipment Bị Hỏng</h2>

        {brokenEquipment.length === 0 ? (
          <p>Không có equipment nào bị hỏng!</p>
        ) : (
          <div className="broken-equipment-list">
            {brokenEquipment.map(equipment => (
              <div key={equipment.id} className="broken-equipment-item">
                <img 
                  src={`/images/equipments/${equipment.image_url}`} 
                  alt={equipment.item_name}
                  className="equipment-image"
                />
                <div className="equipment-info">
                  <h3 style={{ color: getRarityColor(equipment.rarity) }}>
                    {equipment.item_name}
                  </h3>
                  <p>Rarity: {equipment.rarity}</p>
                  <p>Power: {equipment.power}</p>
                  <p>Max Durability: {equipment.max_durability}</p>
                </div>
                <div className="repair-options">
                  <button 
                    onClick={() => handleRepairWithBlacksmith(equipment)}
                    disabled={loading}
                    className="repair-blacksmith-btn"
                  >
                    🔨 Sửa bằng Blacksmith
                  </button>
                  <button 
                    onClick={() => setSelectedEquipment(equipment)}
                    disabled={loading}
                    className="repair-kit-btn"
                  >
                    🛠️ Sửa bằng Repair Kit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Repair Kit Modal */}
        {selectedEquipment && (
          <div className="repair-kit-modal">
            <h3>Sửa chữa {selectedEquipment.item_name}</h3>
            <p>Chọn Repair Kit phù hợp:</p>
            
            <select 
              value={selectedKit} 
              onChange={(e) => setSelectedKit(e.target.value)}
              className="repair-kit-select"
            >
              <option value="">-- Chọn Repair Kit --</option>
              {repairKits.map(kit => {
                const effectiveness = getRepairEffectiveness(kit.rarity, selectedEquipment.rarity);
                const restoredDurability = Math.floor(selectedEquipment.max_durability * effectiveness / 100);
                return (
                  <option key={kit.id} value={kit.item_id}>
                    {kit.name} ({kit.rarity}) - Hiệu quả: {effectiveness}% ({restoredDurability} durability)
                  </option>
                );
              })}
            </select>

            <div className="repair-kit-actions">
              <button 
                onClick={handleRepairWithKit}
                disabled={!selectedKit || loading}
                className="repair-confirm-btn"
              >
                {loading ? 'Đang sửa...' : 'Sửa chữa'}
              </button>
              <button 
                onClick={() => {
                  setSelectedEquipment(null);
                  setSelectedKit('');
                }}
                className="cancel-btn"
              >
                Hủy
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default BrokenEquipmentModal; 