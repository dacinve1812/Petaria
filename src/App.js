import React from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
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
import EditProfile from './components/EditProfile';
import PetProfile from './components/PetProfile';
import Inventory from './components/items/Inventory';
import EditPetTypes from './components/admin/EditPetTypes';
import EditItems from './components/admin/EditItems';
import EditEquipmentStats from './components/admin/EditEquipmentStats';
import EditItemEffects from './components/admin/EditItemEffects';
import ShopPage from './components/ShopPage';
import EditShopItems from './components/admin/EditShopItems';
import AdminCreatePet from './components/admin/AdminCreatePet';
import ArenaPage from './components/battle/ArenaPage';
import PveSelectPage from './components/battle/PveSelectPage';
import ArenaBattlePage from './components/battle/ArenaBattlePage';
import AdminSpiritEditor from './components/admin/AdminSpiritEditor';
import SiteManagement from './components/admin/SiteManagement';
import AdminSiteAuctionMailPage from './components/admin/AdminSiteAuctionMailPage';
import AdminHuntingMapManagement from './components/admin/AdminHuntingMapManagement';
import HomePageVer2 from './components/HomePageVer2';
import HuntingMap from './components/HuntingMap';
import WorldMapPage from './components/WorldMapPage';
import RegionMapPage from './components/RegionMapPage';
import HuntConfirmPage from './components/HuntConfirmPage';
import PokedexPage from './components/PokedexPage';
import CultivatePage from './components/CultivatePage';
import TasksHubPage from './components/tasks/TasksHubPage';
import TaskItemHuntPage from './components/tasks/TaskItemHuntPage';
import TaskSpiritFusionPage from './components/tasks/TaskSpiritFusionPage';
import TaskMonsterHuntPage from './components/tasks/TaskMonsterHuntPage';
import TeamPage from './components/TeamPage';
import HuntingWorldPage from './components/HuntingWorldPage';
import MyStuffManagement from './components/MyStuffManagement';
import TitleMyPage from './components/TitleMyPage';
import ExhibitionRoom from './components/ExhibitionRoom';
import DevDashboard from './components/DevDashboard';
import MapCoordinateTool from './components/MapCoordinateTool';
import Bank from './components/Bank';
import AdminBankManagement from './components/admin/AdminBankManagement';
import AdminUserManagement from './components/admin/AdminUserManagement';
import AdminNpcBossManagement from './components/admin/AdminNpcBossManagement';
import AdminTitlesManagement from './components/admin/AdminTitlesManagement';
import AdminAuctionLogs from './components/admin/AdminAuctionLogs';
import AuctionList from './components/auction/AuctionList';
import AuctionDetail from './components/auction/AuctionDetail';
import CreateAuction from './components/auction/CreateAuction';
import MyAuctionsPage from './components/auction/MyAuctionsPage';
import MailPage from './components/MailPage';
import MailComposePage from './components/MailComposePage';
import HealiaRiverPage from './components/HealiaRiverPage';
import Restaurant from './components/Restaurant';
import BuddiesPage from './components/BuddiesPage';
import GuildPage from './components/GuildPage';
import CreateGuildPage from './components/CreateGuildPage';
import GuildDetailPage from './components/GuildDetailPage';
import EditGuildPage from './components/EditGuildPage';
import ExampleTemplatePage from './components/template/ExampleTemplatePage';

const router = createBrowserRouter([
  { path: '/login', element: <Auth /> },
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <HomePageVer2 /> },
      { path: 'orphanage', element: <Orphanage /> },
      { path: 'myhome', element: <MyHome /> },
      { path: 'myhome/spirits', element: <MyHome /> },
      { path: 'admin', element: <Admin /> },
      { path: 'profile/:userId', element: <UserProfile /> },
      { path: 'profile', element: <UserProfile /> },
      { path: 'profile/edit', element: <EditProfile /> },
      { path: 'pet/:uuid', element: <PetProfile /> },
      { path: 'inventory', element: <Inventory /> },
      { path: 'admin/edit-pet-types', element: <EditPetTypes /> },
      { path: 'admin/edit-items', element: <EditItems /> },
      { path: 'admin/edit-equipment-stats', element: <EditEquipmentStats /> },
      { path: 'admin/edit-item-effects', element: <EditItemEffects /> },
      { path: 'shop', element: <ShopPage /> },
      { path: 'admin/edit-shop-items', element: <EditShopItems /> },
      { path: 'admin/create-pet', element: <AdminCreatePet /> },
      { path: 'battle', element: <PveSelectPage /> },
      { path: 'battle/arena', element: <ArenaPage /> },
      { path: 'admin/npc-boss-management', element: <AdminNpcBossManagement /> },
      { path: 'admin/spirits', element: <AdminSpiritEditor /> },
      { path: 'admin/site-management', element: <SiteManagement /> },
      { path: 'admin/site/auction-mail', element: <AdminSiteAuctionMailPage /> },
      { path: 'admin/hunting-maps', element: <AdminHuntingMapManagement /> },
      { path: 'management', element: <MyStuffManagement /> },
      { path: 'title', element: <TitleMyPage /> },
      { path: 'exhibition', element: <ExhibitionRoom /> },
      { path: 'exhibition/:userId', element: <ExhibitionRoom /> },
      { path: 'battle/arena/arenabattle', element: <ArenaBattlePage /> },
      { path: 'home-ver2', element: <HomePage /> },
      { path: 'pokedex', element: <PokedexPage /> },
      { path: 'cultivate', element: <CultivatePage /> },
      { path: 'tasks', element: <TasksHubPage /> },
      { path: 'tasks/item-hunt', element: <TaskItemHuntPage /> },
      { path: 'tasks/spirit-fusion', element: <TaskSpiritFusionPage /> },
      { path: 'tasks/monster-hunt', element: <TaskMonsterHuntPage /> },
      { path: 'team', element: <TeamPage /> },
      { path: 'hunting-world', element: <HuntingWorldPage /> },
      { path: 'hunting-world/map/:id', element: <HuntingMap /> },
      { path: 'world-map', element: <WorldMapPage /> },
      { path: 'region/:regionId', element: <RegionMapPage /> },
      { path: 'hunting-world/confirm', element: <HuntConfirmPage /> },
      { path: 'admin/mail-test', element: <AdminMailTest /> },
      { path: 'admin/bank-management', element: <AdminBankManagement /> },
      { path: 'admin/user-management', element: <AdminUserManagement /> },
      { path: 'admin/titles', element: <AdminTitlesManagement /> },
      { path: 'admin/auction-logs', element: <AdminAuctionLogs /> },
      { path: 'dev-dashboard', element: <DevDashboard /> },
      { path: 'map-tool', element: <MapCoordinateTool /> },
      { path: 'bank', element: <Bank /> },
      { path: 'mail', element: <MailPage /> },
      { path: 'mail/compose', element: <MailComposePage /> },
      { path: 'healia-river', element: <HealiaRiverPage /> },
      { path: 'restaurant', element: <Restaurant /> },
      { path: 'buddies', element: <BuddiesPage /> },
      { path: 'guild', element: <GuildPage /> },
      { path: 'guild/create', element: <CreateGuildPage /> },
      { path: 'guild/edit', element: <EditGuildPage /> },
      { path: 'guild/:name', element: <GuildDetailPage /> },
      { path: 'auction', element: <AuctionList /> },
      { path: 'auction/my-auctions', element: <MyAuctionsPage /> },
      { path: 'auction/create', element: <CreateAuction /> },
      { path: 'auction/:id', element: <AuctionDetail /> },
      { path: 'example/*', element: <ExampleTemplatePage /> },
    ],
  },
]);

function App() {
  return (
    <UserProvider>
      <div className="App">
        <EncounterModalContainer />
        <RouterProvider router={router} />
      </div>
    </UserProvider>
  );
}

export default App;
