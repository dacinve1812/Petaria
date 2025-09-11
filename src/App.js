import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { UserProvider } from './UserContext';
import MainLayout from './components/MainLayout';
import EncounterModalContainer from './components/EncounterModalContainer';
import HomePage from './components/HomePage';
import Auth from './components/Auth';
import Orphanage from './components/Orphanage';
import MyHome from './components/MyHome';
import Admin from './components/admin/Admin';
import AdminMailTest from './components/admin/AdminMailTest';
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
import ArenaBattlePage from './components/battle/ArenaBattlePage';
import AdminAddPetForBattle from './components/admin/AdminAddPetForBattle';
import AdminSpiritEditor from './components/admin/AdminSpiritEditor';
import SiteManagement from './components/admin/SiteManagement';
import HomePageVer2 from './components/HomePageVer2';
import HuntingMap from './components/HuntingMap';
import PokedexPage from './components/PokedexPage';
import CultivatePage from './components/CultivatePage';
import TasksPage from './components/TasksPage';
import TeamPage from './components/TeamPage';
import HuntingWorldPage from './components/HuntingWorldPage';
import MyStuffManagement from './components/MyStuffManagement';
import DevDashboard from './components/DevDashboard';
import MapCoordinateTool from './components/MapCoordinateTool';
import Bank from './components/Bank';
import AdminBankManagement from './components/admin/AdminBankManagement';
import AdminUserManagement from './components/admin/AdminUserManagement';

function App() {
  return (
    <BrowserRouter>
      <UserProvider>
        <div className="App">
          {/* Global Encounter Modal - always available */}
          <EncounterModalContainer />

          <Routes>
            <Route path="/login" element={<Auth />} />
            <Route path="/" element={<MainLayout />}>
              <Route index element={<HomePageVer2 />} />
              <Route path="orphanage" element={<Orphanage />} />
              <Route path="myhome" element={<MyHome />} />
              <Route path="admin" element={<Admin />} />
              <Route path="profile/:userId" element={<UserProfile />} />
              <Route path="profile" element={<UserProfile />} />
              <Route path="pet/:uuid" element={<PetProfile />} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="admin/edit-pet-types" element={<EditPetTypes />} />
              <Route path="admin/edit-items" element={<EditItems />} />
              <Route path="admin/edit-equipment-stats" element={<EditEquipmentStats />} />
              <Route path="admin/edit-item-effects" element={<EditItemEffects />} />
              <Route path="shop" element={<ShopPage />} />
              <Route path="admin/edit-shop-items" element={<EditShopItems />} />
              <Route path="admin/create-pet" element={<AdminCreatePet />} />
              <Route path="battle" element={<BattlePage />} />
              <Route path="battle/pve" element={<PveSelectPage />} />
              <Route path="battle/pve/arena" element={<ArenaPage />} />
              <Route path="admin/create-arena-pet" element={<AdminAddPetForBattle />} />
              <Route path="admin/spirits" element={<AdminSpiritEditor />} />
              <Route path="admin/site-management" element={<SiteManagement />} />
              <Route path="management" element={<MyStuffManagement />} />
              <Route path="battle/pve/arena/arenabattle" element={<ArenaBattlePage />} />
              <Route path="home-ver2" element={<HomePage />} />
              <Route path="pokedex" element={<PokedexPage />} />
              <Route path="cultivate" element={<CultivatePage />} />
              <Route path="tasks" element={<TasksPage />} />
              <Route path="team" element={<TeamPage />} />
              <Route path="hunting-world" element={<HuntingWorldPage />} />
              <Route path="hunting-world/map/:id" element={<HuntingMap />} />
              <Route path="admin/mail-test" element={<AdminMailTest />} />
              <Route path="admin/bank-management" element={<AdminBankManagement />} />
              <Route path="admin/user-management" element={<AdminUserManagement />} />
              <Route path="dev-dashboard" element={<DevDashboard />} />
              <Route path="map-tool" element={<MapCoordinateTool />} />
              <Route path="bank" element={<Bank />} />
            </Route>  
          </Routes>
        </div>
      </UserProvider>
    </BrowserRouter>
  );
}

export default App;
