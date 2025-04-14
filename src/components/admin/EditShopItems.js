// File: EditShopItems.js
import React, { useState, useEffect, useContext } from 'react';
import { UserContext } from '../../UserContext';
import Sidebar from '../Sidebar';
import Navbar from '../Navbar';
import ShopItemList from '../ShopItemList';

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
      const newItems = await fetch(`${API_BASE_URL}/api/shop/${selectedShop.code}`, {
        headers: { 'Authorization': `Bearer ${user.token}` }
      }).then(r => r.json());
      setShopItems(newItems);
    } else {
      alert('Lỗi khi thêm vật phẩm');
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
              <ShopItemList items={shopItems} />

              {isAdding && (
                <div className="modal">
                  <h3>Chọn vật phẩm để thêm vào {selectedShop.name}</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                    {availableItems.map(item => (
                      <div key={item.id} onClick={() => toggleItem(item.id)} style={{ cursor: 'pointer', border: selectedItemIds.includes(item.id) ? '2px solid green' : '1px solid gray', padding: '5px' }}>
                        <img src={`/images/equipments/${item.image_url}`} alt={item.name} width="50" />
                        {/* <div style={{ textAlign: 'center' }}>{item.name}</div> */}
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