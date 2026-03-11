# VNPet - Game Documentation

## 📋 Tổng quan
VNPet là một web game thú cưng ảo với hệ thống battle, leveling, và collection. Game được xây dựng bằng React (Frontend) và Node.js (Backend) với MySQL database.

## 🏗️ Architecture

### Tech Stack
- **Frontend**: React.js, React Router, CSS3
- **Backend**: Node.js, Express.js
- **Database**: MySQL
- **Authentication**: JWT
- **File Handling**: Multer

### Project Structure
```
petaria/
├── src/                    # React frontend
│   ├── components/         # React components
│   ├── data/              # Game data (exp tables, etc.)
│   └── styles/            # CSS files
├── backend/               # Node.js server
│   ├── server.js          # Main server file
│   ├── battleEngine.js    # Battle logic
│   └── utils/             # Utility functions
└── public/                # Static assets
```

## 🎮 Core Game Systems

### 1. Pet System
- **500+ pet species** với độ hiếm khác nhau
- **IV System**: Individual Values (0-31) cho mỗi stat
- **Level System**: 1-100 levels với EXP requirements
- **Evolution System**: 3-stage evolution (planned)

#### Pet Stats Formula
```javascript
// Base stat calculation
const getStat = (base, iv, level) => 
  Math.floor(((2 * base + iv) * level) / 100) + 5;

// HP calculation (special)
const getHP = (base, iv, level) => 
  (Math.floor(((2 * base + iv) * level) / 100) + level + 10) * 5;
```

### 2. Battle System

#### Turn-based Combat
- **Speed-based turn order**: Pet có SPD cao hơn đi trước
- **Damage calculation**: Dựa trên STR attacker vs DEF defender
- **Critical hits**: 6.25% chance
- **Dodge system**: Dựa trên SPD difference

#### Battle Engine Logic
```javascript
// Damage formula
const baseDamage = ((((2 * level) / 5 + 2) * movePower * STR / DEF) / 50);
const finalDamage = baseDamage * randomFactor(0.85-1.0) * (critical ? 2 : 1);

// Dodge chance
const dodgeChance = Math.min(Math.max((defenderSPD - attackerSPD) * 0.5, 0), 20) / 100;
```

#### Equipment System
- **Weapons**: Tăng damage, có durability
- **Equipment stats**: Stored in `equipment_stats` table
- **Durability**: Giảm 1 mỗi lần sử dụng
- **Equipment power**: 10-50+ damage

### 3. Level Up & Stat Gain System ⭐ **MỚI CẬP NHẬT**

#### EXP Gain Logic
```javascript
// EXP battle (boss/quái)
// Exp = Level enemy * R, với R random 300..500
function calculateBattleExpGain(enemyLevel) {
  const R = randomIntInclusive(300, 500);
  return enemyLevel * R;
}

// EXP thresholds theo level
// Tổng EXP để đạt Level A:
// exp_to_reach(A) = (A^3) * 20
//
// EXP cần để lên từ Level A -> A+1:
// exp_needed(A->A+1) = [(A+1)^3 - A^3] * 20
```

#### Stat Recalculation on Level Up
**API Endpoint**: `POST /api/pets/:id/gain-exp`

**Logic Flow**:
1. **Calculate new EXP**: `current_exp + gained_exp`
2. **Check level up**: `while (newExp >= expTable[newLevel + 1]) newLevel++`
3. **If level up detected**:
   - Fetch base stats từ `pet_species`
   - Get IV stats từ pet hiện tại
   - Recalculate final stats với level mới
   - Update database với stats mới
4. **Response includes**:
   ```javascript
   {
     id: petId,
     level: newLevel,
     current_exp: newExp,
     gained: gain,
     stats_updated: boolean,
     new_stats: calculatedStats
   }
   ```

**Database Update**:
```sql
UPDATE pets SET 
  current_exp = ?, 
  level = ?, 
  hp = ?, max_hp = ?,
  mp = ?, max_mp = ?,
  str = ?, def = ?, intelligence = ?, spd = ?,
  final_stats = ?
WHERE id = ?
```

#### Frontend Integration
- **ArenaBattlePage.js**: Handles stat updates after battle
- **Real-time display**: Stats update immediately after level up
- **Battle reset**: Uses updated stats for new battles

### 4. Arena System (PvE)

#### Arena Structure
- **Enemy Selection**: Choose from available NPC pets
- **Pet Selection**: Choose your pet to battle
- **Battle Modes**:
  - **Normal Attack**: Basic attack (10 damage)
  - **Equipment Attack**: Use equipped weapons
  - **Auto Mode**: Automatic battle
  - **Blitz Mode**: Instant full battle simulation

#### Arena Features
- **Enemy Info Modal**: View enemy stats before battle
- **Battle Log**: Real-time battle progress
- **EXP Rewards**: Based on enemy level vs player level
- **Equipment Durability**: Weapons degrade with use

### 5. Inventory & Equipment

#### Item Types
- **Weapons**: Combat equipment with damage values
- **Food**: HP restoration items
- **Potions**: Healing items
- **Evolution Items**: For pet evolution (planned)
- **Stat Boosters**: Permanent/temporary stat increases

#### Equipment Management
- **Equip/Unequip**: Toggle equipment on pets
- **Durability System**: Items break after use
- **Equipment Stats**: Stored separately for balance

## 🗄️ Database Schema

### Core Tables
- **users**: User accounts and authentication
- **pets**: Pet instances with stats and ownership
- **pet_species**: Base pet data and rarity
- **inventory**: User items and equipment
- **equipment_stats**: Weapon damage and properties
- **shops**: Shop configurations
- **shop_items**: Items available in shops

### Key Relationships
- `pets.owner_id` → `users.id`
- `pets.pet_species_id` → `pet_species.id`
- `inventory.owner_id` → `users.id`
- `inventory.equipped_pet_id` → `pets.id`

## 🔧 API Endpoints

### Authentication
- `POST /register` - User registration
- `POST /login` - User login with JWT

### Pet Management
- `GET /users/:userId/pets` - Get user's pets
- `POST /api/pets/:id/gain-exp` - Add EXP and level up
- `GET /api/pets/:uuid` - Get pet details

### Battle System
- `POST /api/arena/simulate-turn` - Single turn simulation
- `POST /api/arena/simulate-full` - Full battle simulation
- `GET /api/arena/enemies` - Get arena enemies

### Equipment
- `GET /api/pets/:id/equipment` - Get pet's equipped items
- `POST /api/inventory/:id/equip` - Equip item to pet
- `POST /api/inventory/:id/unequip` - Unequip item

### Shop System
- `GET /api/shops` - Get available shops
- `GET /api/shop/:code` - Get shop items
- `POST /api/shop/buy` - Purchase items

## 🎯 Game Balance

### EXP Curve
- **Early levels (1-10)**: Fast progression
- **Mid levels (11-50)**: Moderate grind
- **High levels (51-100)**: Slow progression

### Battle Balance
- **Equipment power**: 10-50+ damage vs 10 normal attack
- **Critical hits**: 6.25% chance, 2x damage
- **Dodge system**: SPD-based, max 20% chance

### Stat Scaling
- **HP**: Scales with level + base + IV
- **Other stats**: Base + IV + level multiplier
- **IV impact**: 0-31 points per stat

## 🚀 Planned Features

### Phase 1: Core Enhancements
- [ ] Battle rewards (coins, items)
- [ ] Equipment power balance
- [ ] Sound effects and animations

### Phase 2: Advanced Features
- [ ] Champion Challenge (3v3 battles)
- [ ] Training Camp (auto training)
- [ ] Status effects (poison, sleep, etc.)

### Phase 3: Social & Economy
- [ ] Auction House
- [ ] Guild/Clan system
- [ ] PvP battles

### Phase 4: Content Expansion
- [ ] Hunting system
- [ ] World map exploration
- [ ] Mini-games

## 🐛 Known Issues & Fixes

### ✅ Fixed Issues
1. **Stat gain on level up**: ✅ Fixed - Stats now recalculate properly
2. **Equipment durability**: ✅ Working - Items degrade with use
3. **Battle balance**: ⚠️ Needs adjustment - Equipment too powerful

### 🔄 In Progress
1. **Battle rewards system**: Planning phase
2. **UI/UX improvements**: Ongoing
3. **Performance optimization**: Monitoring

## 📝 Development Notes

### Code Standards
- **Backend**: ES6+ with async/await
- **Frontend**: React hooks, functional components
- **Database**: Prepared statements for security
- **Error handling**: Try-catch blocks with proper logging

### Database Migration
- Xem hướng dẫn migrate dữ liệu pet khi đổi EXP/Stats tại `DB_MIGRATION_GUIDE.md`

### Testing Strategy
- **Manual testing**: Battle scenarios, level up scenarios
- **Database testing**: Stat calculations, EXP gain
- **UI testing**: Responsive design, user interactions

### Deployment Notes
- **Environment variables**: Required for database connection
- **File uploads**: Multer configuration for images
- **CORS**: Configured for local development

---

**Last Updated**: February 2025
**Version**: 1.0.0
**Developer**: BaoNguyen 