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

**Trường hợp 1: Tấn công (vũ khí / kỹ năng Attack)**  
Sát thương gây ra và trừ trực tiếp vào HP đối thủ trong lượt đó. Công thức dùng chung cho Pet và Boss (không dùng hệ số 1.45).

$$Dmg_{out} = \max(1, (Str_{attacker} \times (1 + \frac{R}{10})) \times 0.6 - Def_{defender} \times 0.5)$$

Trong đó $R$ = `randomIntInclusive(power_min, power_max)` (số nguyên).  
Defender nhận sát thương: $HP(defender) := HP(defender) - Dmg_{out}$ (trừ khi đang có Def_dmg, xem dưới).

**Trường hợp 2: Phòng thủ (Khiên / kỹ năng Defend)**  
Lượt này **không gây sát thương**, chỉ thiết lập trạng thái bảo vệ cho lượt sau.

$$Def_{dmg} = (Def_{defenderUnit} \times (1 + \frac{R}{10})) \times 0.6 - Str_{enemy} \times 0.5$$

- Nếu $Def_{dmg} < 0$ thì set $Def_{dmg} = 0$.  
- Lưu vào đối tượng trận đấu: `current_def_dmg = Def_dmg` (người dùng khiên/Boss defend).  
- Log: *"X sử dụng Phòng thủ, thiết lập shield [Def_dmg] HP phòng ngự."*

**Trường hợp 3: Bị tấn công khi đang có Def_dmg**  
Khi đối thủ tấn công ở lượt kế tiếp, tính:

$$counter\_dmg = Dmg_{out}(attacker) - Def_{dmg}(defender)$$

- **counter_dmg > 0**: Defender vẫn mất máu nhưng đã giảm: $HP(defender) := HP(defender) - counter\_dmg$.  
- **counter_dmg ≤ 0**: Defender không mất máu; Attacker bị phản đòn: $HP(attacker) := HP(attacker) - |counter\_dmg|$.  
- Sau khi xử lý: `defender.current_def_dmg = 0` (lớp chắn đã dùng).

**Dodge**: `dodgeChance = min(max((defenderSPD - attackerSPD) × 0.5, 0), 20) / 100`.

```javascript
// R = random int [power_min, power_max], mult = 1 + R/10
const R = randomIntInclusive(power_min, power_max);
const mult = 1 + R / 10;

// Tấn công (Pet hoặc Boss): Dmg_out chung
const dmg_out = Math.max(1, Math.floor((Str_attacker * mult) * 0.6 - Def_defender * 0.5));

// Nếu defender đang có current_def_dmg > 0:
// counter_dmg = dmg_out - current_def_dmg;
// counter_dmg > 0 → defender nhận counter_dmg; counter_dmg <= 0 → attacker nhận |counter_dmg| (phản đòn); sau đó current_def_dmg = 0.

// Phòng thủ (khiên / defend): def_dmg = max(0, (Def * mult) * 0.6 - Str_enemy * 0.5); lưu current_def_dmg, không trừ HP.
```

#### Arena Battle: Pet vs Boss

Trong **Đấu trường Arena**, trận đấu diễn ra theo lượt: **Pet** (người chơi) và **Boss** (đối thủ) lần lượt hành động. Boss **không đánh thường, không tốn MP**; mọi hành động của Boss đều là **skill** lấy từ **action_pattern** (xem thêm `BOSS_NPC_DESIGN.md`).

**Luồng lượt (ArenaBattlePage):**
1. Người chơi chọn: **Tấn công thường**, **dùng vũ khí**, hoặc **Phòng thủ** (click khiên).
2. Nếu tấn công: **POST /api/arena/simulate-turn** với `defender_current_def_dmg` (nếu Boss đang có shield) → Dmg_out hoặc counter_dmg/phản đòn, cập nhật HP.
3. Nếu **Phòng thủ**: **POST /api/arena/simulate-defend** (Pet + khiên) → thiết lập `current_def_dmg` cho Pet, log "thiết lập shield X HP phòng ngự", sau đó sang lượt Boss.
4. Nếu Boss chưa chết → **lượt Boss**: **simulate-turn** với `attacker: Boss`, `defender: Pet`, `defender_current_def_dmg: player.current_def_dmg`. Nếu Boss dùng skill **defend** → chỉ set Boss `current_def_dmg`, log tương tự. Nếu Boss **attack** → Dmg_out; nếu Pet đang có def_dmg thì áp dụng counter_dmg/phản đòn.
5. Lặp đến khi một bên HP ≤ 0.

**Pet (người chơi):**
- **Tấn công thường**: `power_min = 0`, `power_max = 0` → Dmg_out (sát thương thấp).
- **Vũ khí**: gửi `power_min`, `power_max`; sát thương = Dmg_out. Nếu Boss đang có `current_def_dmg` thì dùng counter_dmg (giảm sát thương hoặc phản đòn).
- **Khiên**: gọi **simulate-defend** → Pet nhận `current_def_dmg`; lượt sau khi Boss đánh sẽ áp dụng counter_dmg.

**Boss (đối thủ):**
- Mỗi lượt = một skill từ **action_pattern** (không đánh thường).
- **Skill attack**: accuracy → Dmg_out (cùng công thức). Nếu Pet đang có def_dmg thì counter_dmg/phản đòn.
- **Skill defend**: chỉ thiết lập Boss `current_def_dmg`; lượt sau khi Pet đánh sẽ áp dụng counter_dmg.
- Boss không tốn MP.

**Dữ liệu cần khi vào trận:**
- Boss phải có **action_pattern** (JSON mảng ID) và **skills** (danh sách skill có `id`, `type`, `power_min`, `power_max`, `accuracy`). Nếu vào trận với enemy thiếu một trong hai, **ArenaBattlePage** sẽ gọi **GET /api/bosses/:id** để lấy đủ trước khi đánh.

**API liên quan:**
- **GET /api/arena/enemies**: danh sách Boss (Arena).
- **GET /api/bosses/:id**: chi tiết Boss (final_stats, current_hp, skills, action_pattern).
- **POST /api/arena/simulate-turn**: mô phỏng 1 lượt tấn công; body có `defender_current_def_dmg` (khi defender đang có shield). Khi Boss đánh: `turnNumber` + action_pattern/skills → getBossAction + simulateBossTurn.
- **POST /api/arena/simulate-defend**: Pet dùng khiên; body `defenderUnit`, `enemy`, `shield_power_min`, `shield_power_max`; trả về `defDmg`, `logMessage` (thiết lập shield, không trừ HP).

#### Equipment System
- **Bảng `equipment_data`** (schema mới):
  - `item_id` – FK tới items
  - `equipment_type` – `weapon` | `shield` | `crit_weapon`
  - `power_min`, `power_max` – khoảng sát thương (tùy chọn)
  - `durability_max` – độ bền tối đa
  - `magic_value` – sức ma thuật 1–10, dùng cho Rand_Magic trong công thức Dmg_out
  - Tùy chọn: `crit_rate`, `block_rate`, `element`, `effect_id`
- **Durability**: Giảm 1 mỗi lần sử dụng; dùng `durability_max` khi tạo inventory.
- **Migration**: Chạy `node scripts/migrate_equipment_data_schema.js` để nâng cấp bảng cũ (power/durability → schema mới).

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

### Boss / NPC (tách biệt khỏi pets)
- **boss_templates**: Bản thiết kế Boss (name, image_url, level hiển thị, base_* = stat cố định do admin/DB, accuracy, location_id, drop_table JSON, respawn_minutes). Không có owner. Stat Boss **cố định**, không tính công thức, không IV, Boss **không lên level**.
- **skills**: Kỹ năng dùng chung (name, description, power_multiplier, effect_type, mana_cost).
- **boss_skills**: N–N giữa boss_templates và skills (sort_order).
- Arena đối thủ: lấy từ `boss_templates` (location_id = 1 hoặc NULL). Trong trận đấu, Boss là object tạm (final_stats, current_hp trong RAM); không lưu HP Boss vào DB.

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
- `GET /api/arena/enemies` - Danh sách Boss Arena (từ boss_templates, location_id = 1 hoặc NULL)
- `GET /api/bosses/:id` - Chi tiết Boss (final_stats, skills; dùng cho Arena battle)

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

### Utility Scripts
- `scripts/send_test_mails.js`: gửi system mails test (dev only)
- `scripts/setup_vip_bank_system.js`: setup cột VIP trong `users` + bảng `bank_interest_rates`

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