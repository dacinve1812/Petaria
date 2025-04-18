// File: EditItemEffects.js
import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../Sidebar';
import Navbar from '../Navbar';
import { UserContext } from '../../UserContext';

function EditItemEffects() {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const navigate = useNavigate();
  const location = useLocation();
  const user = useContext(UserContext);

  const [items, setItems] = useState([]);
  const [effects, setEffects] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [effectTarget, setEffectTarget] = useState('hp');
  const [effectType, setEffectType] = useState('flat');
  const [valueMin, setValueMin] = useState(0);
  const [valueMax, setValueMax] = useState(0);
  const [isPermanent, setIsPermanent] = useState(false);
  const [durationTurns, setDurationTurns] = useState(0);
  const [editId, setEditId] = useState(null);

  useEffect(() => {
    if (user === undefined) return;
    if (!user || !user.isAdmin) navigate('/login');
    else {
      fetchItems();
      fetchEffects();
    }
  }, [navigate, user]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const itemId = params.get('item_id');
    if (itemId) {
      setSelectedItemId(itemId);
    }
  }, [location.search]);

  const fetchItems = async () => {
    const res = await fetch(`${API_BASE_URL}/api/admin/items`, {
      headers: { 'Authorization': `Bearer ${user.token}` }
    });
    const data = await res.json();
    setItems(data.filter(item => item.type === 'booster' || item.type === 'consumable'));
  };

  const fetchEffects = async () => {
    const res = await fetch(`${API_BASE_URL}/api/admin/item-effects`, {
      headers: { 'Authorization': `Bearer ${user.token}` }
    });
    const data = await res.json();
    setEffects(data);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const method = editId ? 'PUT' : 'POST';
    const endpoint = editId
      ? `${API_BASE_URL}/api/admin/item-effects/${editId}`
      : `${API_BASE_URL}/api/admin/item-effects`;

    const res = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`
      },
      body: JSON.stringify({
        item_id: selectedItemId,
        effect_target: effectTarget,
        effect_type: effectType,
        value_min: valueMin,
        value_max: valueMax,
        is_permanent: isPermanent,
        duration_turns: durationTurns
      })
    });

    if (res.ok) {
      fetchEffects();
      setSelectedItemId('');
      setEffectTarget('hp');
      setEffectType('flat');
      setValueMin(0);
      setValueMax(0);
      setIsPermanent(false);
      setDurationTurns(0);
      setEditId(null);
      alert('Lưu thành công!');
    } else {
      alert('Có lỗi xảy ra');
    }
  };

  const handleEdit = (eff) => {
    setSelectedItemId(eff.item_id);
    setEffectTarget(eff.effect_target);
    setEffectType(eff.effect_type);
    setValueMin(eff.value_min);
    setValueMax(eff.value_max);
    setIsPermanent(eff.is_permanent);
    setDurationTurns(eff.duration_turns || 0);
    setEditId(eff.id);
  };
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('isAdmin');
    navigate('/login');
  };
  

  return (
    <div className="container">
      <header><img src="/images/buttons/banner.jpeg" alt="Banner Petaria" /></header>
      <div className="content">
        <Sidebar userId={user?.userId} isAdmin={user?.isAdmin} handleLogout={handleLogout} />
        <div className="main-content">
          <Navbar />
          <h1>Update chỉ số cho vật phẩm</h1>

          <form onSubmit={handleSubmit} className="admin-form-container">
            <select value={selectedItemId} onChange={(e) => setSelectedItemId(e.target.value)} required>
              <option value="">Chọn item</option>
              {items.map(item => (
                <option key={item.id} value={item.id}> {item.name}</option>
              ))}
            </select>
            <div >Chỉ số được tăng:</div>
            <select className="admin-pet-form-input" value={effectTarget} onChange={(e) => setEffectTarget(e.target.value)}>
              <option value="hp">HP</option>
              <option value="mp">MP</option>
              <option value="atk">ATK</option>
              <option value="def">DEF</option>
              <option value="spd">SPD</option>
              <option value="int">INT</option>
              <option value="exp">Exp</option>
              <option value="status">Status</option>
            </select>
            <div>Type:</div>
            <select className="admin-pet-form-input" value={effectType} onChange={(e) => setEffectType(e.target.value)}>
                <option value="percent">Percent</option>
                <option value="flat">Flat</option>
                <option value="status_cure">Status Cure</option>
            </select>
            <div>Min</div>
            <input  className="admin-pet-form-input" type="number" value={valueMin} onChange={(e) => setValueMin(e.target.value)} placeholder="Giá trị min" />
            <div>Max:</div>
            <input className="admin-pet-form-input" type="number" value={valueMax} onChange={(e) => setValueMax(e.target.value)} placeholder="Giá trị max" />
            <label>
              <input type="checkbox" checked={isPermanent} onChange={(e) => setIsPermanent(e.target.checked)} /> isPermanent
            </label>
            <div>If not, how many turn?</div>
            <input className="admin-pet-form-input" type="number" value={durationTurns} onChange={(e) => setDurationTurns(e.target.value)} placeholder="Số lượt (nếu tạm thời)" />
            <button type="submit">{editId ? 'Cập nhật' : 'Tạo mới'}</button>
          </form>

          <h2>Danh sách hiệu ứng đã gán</h2>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Picture</th>
                <th>Loại</th>
                <th>Kiểu</th>
                <th>Giá trị</th>
                <th>Vĩnh viễn?</th>
                <th>Số lượt</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {effects.map(eff => {
                const item = items.find(i => i.id === eff.item_id);
                return (
                  <tr key={eff.id}>
                    <td>{item ? item.name : 'Không rõ'}</td>
                    <td><img src= {`/images/equipments/${item.image_url}`} alt={item.name} width="40" /></td>
                    <td>{eff.effect_target}</td>
                    <td>{eff.effect_type}</td>
                    <td>{eff.value_min} ~ {eff.value_max}</td>
                    <td>{eff.is_permanent ? '✅' : '❌'}</td>
                    <td>{eff.duration_turns || '-'}</td>
                    <td><button onClick={() => handleEdit(eff)}>Sửa</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default EditItemEffects;
