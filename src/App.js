
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { UserContext } from './UserContext';

import HomePage from './components/HomePage';
import Auth from './components/Auth';
import Orphanage from './components/Orphanage';
import MyHome from './components/MyHome';
import Admin from './components/Admin';
import UserProfile from './components/UserProfile';
import PetProfile from './components/PetProfile';
import Inventory from './components/items/Inventory';
import EditPetTypes from './components/admin/EditPetTypes';
import EditItems from './components/admin/EditItems';
import EditEquipmentStats from './components/admin/EditEquipmentStats';
import EditItemEffects from './components/admin/EditItemEffects';
import ShopPage from './components/ShopPage';
import EditShopItems from './components/admin/EditShopItems';
import AdminCreatePet from './components/admin/AdminCreatePet';
import BattlePage from './components/battle/BattlePage';
import ArenaPage from './components/battle/ArenaPage';
import PveSelectPage from './components/battle/PveSelectPage';
import AdminAddPetForBattle from './components/admin/AdminAddPetForBattle';

function App() {
  const [user, setUser] = useState(undefined); // undefined để tránh redirect sớm

  useEffect(() => {
    const token = localStorage.getItem('token');
    const isAdmin = localStorage.getItem('isAdmin') === 'true';

    if (token) {
      try {
        const decoded = JSON.parse(atob(token.split('.')[1]));
        setUser({
          userId: decoded.userId,
          isAdmin,
          token,
        });
      } catch (err) {
        console.error('Invalid token');
        setUser(null);
      }
    } else {
      setUser(null);
    }
  }, []);

  const handleLoginSuccess = () => {
    const token = localStorage.getItem('token');
    const isAdmin = localStorage.getItem('isAdmin') === 'true';
    if (token) {
      try {
        const decoded = JSON.parse(atob(token.split('.')[1]));
        setUser({
          userId: decoded.userId,
          isAdmin,
          token,
        });
      } catch (err) {
        console.error('Invalid token');
      }
    }
  };

  const handleLogoutSuccess = () => {
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('isAdmin');
  };

  return (
    <BrowserRouter>
      <UserContext.Provider value={user}>
        <div className="App">
          <Routes>
            <Route
              path="/"
              element={
                user ? (
                  <HomePage isLoggedIn={true} onLogoutSuccess={handleLogoutSuccess} />
                ) : (
                  <Auth onLoginSuccess={handleLoginSuccess} />
                )
              }
            />
            <Route path="/login" element={<Auth onLoginSuccess={handleLoginSuccess} />} />
            <Route path="/orphanage" element={<Orphanage />} />
            <Route path="/myhome" element={<MyHome isLoggedIn={!!user} onLogoutSuccess={handleLogoutSuccess} />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/profile/:userId" element={<UserProfile />} />
            <Route path="/profile" element={<UserProfile />} />
            <Route path="/pet/:uuid" element={<PetProfile />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/admin/edit-pet-types" element={<EditPetTypes />} />
            <Route path="/admin/edit-items" element={<EditItems />} />
            <Route path="/admin/edit-equipment-stats" element={<EditEquipmentStats />} />
            <Route path="/admin/edit-item-effects" element={<EditItemEffects />} />
            <Route path="/shop" element={<ShopPage />} />
            <Route path="/admin/edit-shop-items" element={<EditShopItems />} />
            <Route path="/admin/create-pet" element={<AdminCreatePet />} />
            <Route path="/battle" element={<BattlePage />} />
            <Route path="/arena" element={<ArenaPage />} />
            <Route path="/pve" element={<PveSelectPage />} />
            <Route path="/admin/create-arena-pet" element={<AdminAddPetForBattle/>} />
          </Routes>
        </div>
      </UserContext.Provider>
    </BrowserRouter>
  );
}

export default App;
