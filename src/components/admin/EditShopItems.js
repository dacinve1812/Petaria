// File: EditShopItems.js
import React, { useState, useEffect, useContext } from 'react';
import { UserContext } from '../../UserContext';
import Sidebar from '../Sidebar';
import Navbar from '../Navbar';
import '../css/ShopPage.css';

function EditShopItems() {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const user = useContext(UserContext);

  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);
  const [shopItems, setShopItems] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [availableItems, setAvailableItems] = useState([]);
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [customPrice, setCustomPrice] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [editData, setEditData] = useState({ custom_price: '', stock_limit: '', restock_interval: 'none', available_from: '', available_until: '' });

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/shops`, {
      headers: { 'Authorization': `Bearer ${user.token}` }
    })
      .then(res => res.json())
      .then(data => setShops(data));
  }, [API_BASE_URL, user.token]);

  useEffect(() => {
    if (!selectedShop) return;
    fetch(`${API_BASE_URL}/api/shop/${selectedShop.code}`, {
      headers: { 'Authorization': `Bearer ${user.token}` }
    })
      .then(res => res.json())
      .then(data => setShopItems(data));
  }, [API_BASE_URL, selectedShop, user.token]);

  const refreshShopItems = async () => {
    const newItems = await fetch(`${API_BASE_URL}/api/shop/${selectedShop.code}`, {
      headers: { 'Authorization': `Bearer ${user.token}` }
    }).then(r => r.json());
    setShopItems(newItems);
  };

  const openAddModal = () => {
    setIsAdding(true);
    fetch(`${API_BASE_URL}/api/admin/items`, {
      headers: { 'Authorization': `Bearer ${user.token}` }
    })
      .then(res => res.json())
      .then(data => {
        const filtered = data.filter(i => selectedShop.type_filter === 'all' || i.type === selectedShop.type_filter);
        setAvailableItems(filtered);
      });
  };

  const toggleItem = (itemId) => {
    setSelectedItemIds(prev =>
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  };

  const handleBulkAdd = async () => {
    const res = await fetch(`${API_BASE_URL}/api/admin/shop-items/bulk-add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`
      },
      body: JSON.stringify({
        shop_id: selectedShop.id,
        item_ids: selectedItemIds,
        custom_price: customPrice ? parseInt(customPrice) : null,
        currency_type: 'gold'
      })
    });

    if (res.ok) {
      alert('Đã thêm vật phẩm thành công!');
      setIsAdding(false);
      setSelectedItemIds([]);
      setCustomPrice('');
      await refreshShopItems();
    } else {
      alert('Lỗi khi thêm vật phẩm');
    }
  };

  const handleEditClick = (item) => {
    setEditingItem(item.id);
    setEditData({
      custom_price: item.price || '',
      stock_limit: item.stock_limit || '',
      restock_interval: item.restock_interval || 'none',
      available_from: item.available_from ? item.available_from.slice(0, 16) : '',
      available_until: item.available_until ? item.available_until.slice(0, 16) : ''
    });
  };

  const handleSaveEdit = async (item) => {
    const res = await fetch(`${API_BASE_URL}/api/admin/shop-items/${selectedShop.id}/${item.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`
      },
      body: JSON.stringify(editData)
    });
    if (res.ok) {
      alert('Đã cập nhật vật phẩm');
      setEditingItem(null);
      await refreshShopItems();
    } else {
      alert('Lỗi khi cập nhật');
    }
  };

  const handleDelete = async (item) => {
    const confirm = window.confirm(`Bạn có chắc muốn xóa ${item.name} khỏi shop?`);
    if (!confirm) return;
    const res = await fetch(`${API_BASE_URL}/api/admin/shop-items/${selectedShop.id}/${item.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${user.token}`
      }
    });
    if (res.ok) {
      alert('Đã xoá vật phẩm khỏi shop!');
      await refreshShopItems();
    } else {
      alert('Lỗi khi xoá');
    }
  };

  return (
    <div className="container">
      <header><img src="/images/buttons/banner.jpeg" alt="Banner Petaria" /></header>
      <div className="content">
        <Sidebar userId={user?.userId} isAdmin={user?.isAdmin} />
        <div className="main-content">
          <Navbar />
          <h1>Quản lý vật phẩm trong cửa hàng</h1>
          <label>Chọn cửa hàng:</label>
          <select onChange={e => {
            const shop = shops.find(s => s.id === parseInt(e.target.value));
            setSelectedShop(shop);
          }}>
            <option value="">-- Chọn --</option>
            {shops.map(shop => (
              <option key={shop.id} value={shop.id}>{shop.name}</option>
            ))}
          </select>

          {selectedShop && (
            <>
              <h2>Vật phẩm đang bán trong: {selectedShop.name}</h2>
              <button onClick={openAddModal}>+ Thêm vật phẩm vào cửa hàng</button>
              <div className='item-list-container'>
                {shopItems.map((item, index) => (
                  <div key={`${item.id}-${index}`} className='item-list-detail' style={{ border: '1px solid #ccc', padding: '10px', position: 'relative' }}>
                    <img src={`/images/equipments/${item.image_url}`} alt={item.name} width="60" />
                    <div><strong>{item.name}</strong></div>
                    <div>Còn lại: {item.stock_limit ?? 0}</div>
                    <div>Giá: {item.price.toLocaleString()} {item.currency_type === 'gem' ? 'petaGold' : 'peta'}</div>
                    <button onClick={() => handleEditClick(item)} className="icon-button"><img src="/images/icons/edit.png" alt="edit" /></button>
                    <button onClick={() => handleDelete(item)} style={{ position: 'absolute', top: '5px', right: '5px' }} className="icon-button"><img src="/images/icons/cross.png" alt="remove" /></button>

                    {editingItem === item.id && (
                      <div className='item-list-edit'>
                        <label>Giá tùy chỉnh:</label>
                        <input type="number" value={editData.custom_price} onChange={(e) => setEditData(prev => ({ ...prev, custom_price: e.target.value }))} />
                        <br />
                        <label>Stock limit:</label>
                        <input type="number" value={editData.stock_limit} onChange={(e) => setEditData(prev => ({ ...prev, stock_limit: e.target.value }))} />
                        <br />
                        <label>Restock interval:</label>
                        <select value={editData.restock_interval} onChange={(e) => setEditData(prev => ({ ...prev, restock_interval: e.target.value }))}>
                          <option value="none">none</option>
                          <option value="daily">daily</option>
                          <option value="weekly">weekly</option>
                        </select>
                        <br />
                        <label>Available from:</label>
                        <input type="datetime-local" value={editData.available_from} onChange={(e) => setEditData(prev => ({ ...prev, available_from: e.target.value }))} />
                        <br />
                        <label>Available until:</label>
                        <input type="datetime-local" value={editData.available_until} onChange={(e) => setEditData(prev => ({ ...prev, available_until: e.target.value }))} />
                        <br />
                        <button onClick={() => handleSaveEdit(item)}> Save</button>
                        <button onClick={() => setEditingItem(null)}>Cancel</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {isAdding && (
                <div className="modal">
                  <h3>Chọn vật phẩm để thêm vào {selectedShop.name}</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                    {availableItems.map(item => (
                      <div key={item.id} onClick={() => toggleItem(item.id)} style={{ cursor: 'pointer', border: selectedItemIds.includes(item.id) ? '2px solid green' : '1px solid gray', padding: '5px' }}>
                        <img src={`/images/equipments/${item.image_url}`} alt={item.name} width="50" />
                        <div style={{ textAlign: 'center' }}>Giá:{item.sell_price} pG</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: '10px' }}>
                    <label>Giá tùy chỉnh (áp dụng cho tất cả):</label>
                    <input type="number" value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} />
                  </div>
                  <button onClick={handleBulkAdd}>Xác nhận thêm</button>
                  <button onClick={() => setIsAdding(false)}>Huỷ</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default EditShopItems;
