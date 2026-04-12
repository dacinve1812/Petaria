# 🎯 WILD PET ENCOUNTER SYSTEM

## **📋 Tổng quan**
Hệ thống encounter wild pet cho phép người chơi gặp gỡ và tương tác với các thú cưng hoang dã khi di chuyển trong game world. Hệ thống được thiết kế để tạo ra trải nghiệm ngẫu nhiên và thú vị cho người chơi.

## **🏗️ Kiến trúc hệ thống**

### **1. Core Components**
- **`EncounterManager.js`** - Quản lý logic encounter chính
- **`encounterConfig.js`** - Cấu hình pets, zones, và tỉ lệ
- **`battleZones.js`** - Định nghĩa các vùng có thể gặp pet
- **`EncounterModal.js`** - UI modal hiển thị thông tin pet
- **`ConfirmFleeModal.js`** - Modal xác nhận khi flee

### **2. Communication Flow**
```
Phaser Game (MainScene) ←→ React UI (EncounterModal)
         ↓                           ↓
   EncounterManager           CustomEvent System
         ↓                           ↓
   Battle Zone Check         Modal State Management
```

## **🎲 Logic Encounter**

### **1. Điều kiện kích hoạt**
- **Player phải ở trong Battle Zone** (tile có giá trị `113`)
- **Không trong cooldown** (thời gian chờ giữa các encounter)
- **Random chance** dựa trên `baseEncounterRate` của zone

### **2. Công thức tính encounter**
```javascript
// Kiểm tra battle zone
if (!isInBattleZone(playerTileX, playerTileY)) return false;

// Kiểm tra cooldown
if (isOnCooldown) return false;

// Random check với base encounter rate
const encounterChance = currentZone.baseEncounterRate;
if (Math.random() < encounterChance) {
    // Trigger encounter!
}
```

### **3. Pet Selection Logic**
```javascript
// Normalize encounter rates để tổng = 1
const totalRate = availablePets.reduce((sum, pet) => sum + pet.encounterRate, 0);
const normalizedPets = availablePets.map(pet => ({
    ...pet,
    normalizedRate: pet.encounterRate / totalRate
}));

// Weighted random selection
const rand = Math.random();
let cumulativeRate = 0;
for (const pet of normalizedPets) {
    cumulativeRate += pet.normalizedRate;
    if (rand <= cumulativeRate) return pet;
}
```

## **🗺️ Zone System**

### **1. Zone Types**
```javascript
export const ZONE_TYPES = {
    FOREST: {
        id: 'forest',
        name: 'Forest Zone',
        baseEncounterRate: 0.15,        // 15% chance mỗi lần check
        cooldownSeconds: 30,            // 30s cooldown
        availablePetIds: ['pet_001', 'pet_002', 'pet_003', 'pet_004', 'pet_005'],
        description: 'Dense forest with various wildlife'
    },
    DESERT: {
        id: 'desert',
        name: 'Desert Zone', 
        baseEncounterRate: 0.10,        // 10% chance (ít hơn forest)
        cooldownSeconds: 45,            // 45s cooldown (lâu hơn)
        availablePetIds: ['pet_002', 'pet_003', 'pet_004'], // Ít pet hơn
        description: 'Harsh desert environment'
    }
    // ... các zone khác
};
```

### **2. Battle Zones**
- **File**: `battleZones.js`
- **Format**: 1D array với `0` = không có encounter, `113` = có encounter
- **Kích thước**: 50x40 tiles (2000 elements)
- **Vị trí**: Chỉ những tile có giá trị `113` mới có thể trigger encounter

## **🐾 Pet System**

### **1. Pet Properties**
```javascript
export const WILD_PETS = [
    {
        id: 'pet_001',
        name: 'Forest Fox',
        rarity: 'COMMON',           // COMMON, UNCOMMON, RARE, EPIC, LEGENDARY
        encounterRate: 0.60,        // 60% trong số các pet được chọn
        sprite: 'fox_sprite',       // Sprite key (future use)
        description: 'A cunning forest fox with orange fur'
    },
    {
        id: 'pet_002',
        name: 'Mystic Deer', 
        rarity: 'UNCOMMON',
        encounterRate: 0.25,        // 25% chance
        sprite: 'deer_sprite',
        description: 'A graceful deer with mystical aura'
    }
    // ... các pet khác
];
```

### **2. Rarity Distribution**
- **COMMON**: 60% - Dễ gặp nhất
- **UNCOMMON**: 25% - Gặp vừa phải  
- **RARE**: 10% - Khó gặp
- **EPIC**: 4% - Rất khó gặp
- **LEGENDARY**: 1% - Cực kỳ hiếm

## **⏰ Cooldown System**

### **1. Cooldown Logic**
```javascript
// Khi encounter được trigger
setCooldown() {
    this.isOnCooldown = true;
    this.lastEncounterTime = Date.now();
    
    // Set timer để reset cooldown
    this.cooldownTimer = this.scene.time.delayedCall(
        this.currentZone.cooldownSeconds * 1000,
        () => {
            this.isOnCooldown = false;
        }
    );
}
```

### **2. Cooldown Status**
```javascript
getCooldownStatus() {
    if (!this.isOnCooldown) {
        return { isOnCooldown: false, remainingSeconds: 0 };
    }
    
    const elapsed = (Date.now() - this.lastEncounterTime) / 1000;
    const remaining = Math.max(0, this.currentZone.cooldownSeconds - elapsed);
    
    return {
        isOnCooldown: true,
        remainingSeconds: Math.ceil(remaining)
    };
}
```

## **🎮 Player Movement Control**

### **1. Movement Disable Logic**
```javascript
// Trong MainScene.js
handleMovementInput(currentTileX, currentTileY) {
    // Không cho phép di chuyển nếu encounter modal đang mở
    if (this.isEncounterModalOpen) {
        return;
    }
    // ... logic movement bình thường
}
```

### **2. Event Communication**
```javascript
// Khi encounter được trigger
this.encounterManager.setEncounterCallback((wildPet) => {
    this.isEncounterModalOpen = true;  // Disable movement
    
    const encounterEvent = new CustomEvent('wildPetEncounter', {
        detail: { wildPet }
    });
    window.dispatchEvent(encounterEvent);
});

// Khi modal đóng
window.addEventListener('encounterModalClosed', () => {
    this.isEncounterModalOpen = false;  // Re-enable movement
});
```

## **🔒 Security Features**

### **1. Modal Protection**
- **Không thể click outside** để close modal
- **X button hiện confirmation** trước khi flee
- **Hero bị "freeze"** khi modal đang mở

### **2. Confirmation Flow**
```
X Button Click → ConfirmFleeModal → User Choice → Action
     ↓
"Are you sure you want to flee from [Pet Name]?"
     ↓
[Yes, Flee] [Cancel]
```

## **🧪 Testing & Debug**

### **1. Debug Keys**
- **`E`**: Test encounter system (force encounter)
- **`I`**: Show encounter system info
- **`1-4`**: Change player speed

### **2. Console Logs**
```javascript
// Encounter triggered
🎯 ENCOUNTER TRIGGERED!
Wild Pet: { id: 'pet_001', name: 'Forest Fox', ... }

// Cooldown set
⏰ Cooldown set for 30 seconds

// Movement control
🎯 Encounter modal closed - movement re-enabled
```

## **📱 UI Components**

### **1. EncounterModal**
- **Pet info display**: Name, rarity, description
- **Action buttons**: Catch, Battle, Flee
- **Rarity badges**: Color-coded theo rarity
- **Responsive design**: Mobile-friendly

### **2. ConfirmFleeModal**
- **Warning message**: "This action cannot be undone!"
- **Pet name highlight**: Hiển thị tên pet muốn flee
- **Action buttons**: "Yes, Flee" và "Cancel"

## **🔧 Configuration**

### **1. Encounter Rates**
```javascript
// Có thể điều chỉnh dễ dàng trong encounterConfig.js
FOREST: {
    baseEncounterRate: 0.15,        // 15% → 20% để tăng encounter
    cooldownSeconds: 30,            // 30s → 20s để giảm chờ
}
```

### **2. Pet Pool**
```javascript
// Thêm/bớt pet cho từng zone
FOREST: {
    availablePetIds: [
        'pet_001', 'pet_002', 'pet_003', 
        'pet_004', 'pet_005', 'pet_006'  // Thêm pet mới
    ]
}
```

## **🚀 Future Enhancements**

### **1. Planned Features**
- **Weather system**: Ảnh hưởng đến encounter rate
- **Time of day**: Pet khác nhau theo giờ
- **Player level**: Unlock pet mới theo level
- **Special events**: Tăng encounter rate trong events

### **2. Technical Improvements**
- **Pet sprites**: Thay thế placeholder icons
- **Sound effects**: Audio khi encounter
- **Particle effects**: Visual feedback
- **Save system**: Lưu encounter history

## **📝 Usage Examples**

### **1. Thêm Zone mới**
```javascript
// Trong encounterConfig.js
export const ZONE_TYPES = {
    // ... existing zones
    MOUNTAIN: {
        id: 'mountain',
        name: 'Mountain Zone',
        baseEncounterRate: 0.12,
        cooldownSeconds: 35,
        availablePetIds: ['pet_003', 'pet_004', 'pet_005'],
        description: 'Rocky mountain peaks'
    }
};
```

### **2. Thêm Pet mới**
```javascript
// Trong encounterConfig.js
export const WILD_PETS = [
    // ... existing pets
    {
        id: 'pet_006',
        name: 'Mountain Goat',
        rarity: 'UNCOMMON',
        encounterRate: 0.30,
        sprite: 'goat_sprite',
        description: 'A sure-footed mountain climber'
    }
];
```

### **3. Thay đổi Battle Zones**
```javascript
// Trong battleZones.js - thay đổi giá trị tile
// 0 = không có encounter, 113 = có encounter
const battleZones = [
    0, 0, 113, 0, 0,    // Row 0: tile 2 có encounter
    0, 113, 0, 113, 0,  // Row 1: tiles 1, 3 có encounter
    // ... continue pattern
];
```

---

## **📞 Support & Questions**
Nếu có câu hỏi về hệ thống encounter, hãy kiểm tra:
1. Console logs để debug
2. Configuration files để điều chỉnh
3. Battle zone data để verify vị trí
4. Cooldown status để check timing

**Happy Hunting! 🎯✨**
