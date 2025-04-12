import React, { useState, useEffect } from 'react';
import HomePage from './components/HomePage';
import Auth from './components/Auth';
import Orphanage from './components/Orphanage';
import MyHome from './components/MyHome'; // Import MyHome
import Admin from './components/Admin';
import UserProfile from './components/UserProfile';
import PetProfile from './components/PetProfile';
import Inventory from './components/items/Inventory';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  // const [userPets, setUserPets] = useState([]); // Thêm state userPets

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setIsLoggedIn(true);
    } else {
      setIsLoggedIn(false);
    }
  }, []);

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
  };

  const handleLogoutSuccess = () => {
    setIsLoggedIn(false);
  };

  // const handleAdoptPet = (pet) => {
  //   setUserPets([...userPets, pet]);
  // };

  return (
    <BrowserRouter>
      <div className="App">
        <Routes>
          <Route
            path="/"
            element={
              isLoggedIn ? (
                <HomePage isLoggedIn={isLoggedIn} onLogoutSuccess={handleLogoutSuccess} />
              ) : (
                <Auth onLoginSuccess={handleLoginSuccess} />
              )
            }
          />
          <Route path="/login" element={<Auth onLoginSuccess={handleLoginSuccess} />} />
          <Route path="/orphanage" element={<Orphanage/>} /> 
          <Route path="/myhome" element={<MyHome isLoggedIn={isLoggedIn} onLogoutSuccess={handleLogoutSuccess} />} /> 
          <Route path="/admin" element={<Admin />} />
          <Route path="/profile/:userId" element={<UserProfile />} />
          <Route path="/profile" element={<UserProfile />} />
          <Route path="pet/:uuid" element={<PetProfile />} />
          <Route path="/inventory" element={<Inventory />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;