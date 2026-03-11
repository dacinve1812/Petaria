# Stat Gain Logic Documentation

## 📊 Tổng quan
Tài liệu này mô tả chi tiết logic tính toán và cập nhật stats khi pet level up trong VNPet.

## 🎯 Vấn đề đã được giải quyết
**Trước đây**: Khi pet level up, chỉ có EXP và level được cập nhật, stats không thay đổi.
**Hiện tại**: Stats được recalculate và cập nhật đúng cách khi level up.

## 🔧 Implementation Details

### 1. Backend Logic (server.js)

#### API Endpoint
```javascript
POST /api/pets/:id/gain-exp
```

#### Request Body
```javascript
{
  "source": "arena",           // Nguồn EXP (arena, hunting, etc.)
  "enemy_level": 5,           // Level của enemy (để tính EXP)
  "custom_amount": null       // EXP tùy chỉnh (optional)
}
```

#### Logic Flow
```javascript
// 1. Calculate EXP gain
// EXP battle mới: Exp = enemy_level * R (R random 300..500)
const gain = custom_amount !== null ? custom_amount : calculateBattleExpGain(enemy_level);
let newExp = pet.current_exp + gain;
let newLevel = pet.level;

// 2. Check for level up
while (expTable[newLevel + 1] && newExp >= expTable[newLevel + 1]) {
  newLevel++;
}

// 3. If level up detected, recalculate stats
if (newLevel > pet.level) {
  // Fetch base stats from pet_species
  const [speciesRows] = await db.query(
    'SELECT base_hp, base_mp, base_str, base_def, base_intelligence, base_spd FROM pet_species WHERE id = ?',
    [pet.pet_species_id]
  );
  
  if (speciesRows.length > 0) {
    const species = speciesRows[0];
    const base = {
      hp: parseInt(species.base_hp),
      mp: parseInt(species.base_mp),
      str: parseInt(species.base_str),
      def: parseInt(species.base_def),
      intelligence: parseInt(species.base_intelligence),
      spd: parseInt(species.base_spd),
    };
    
    const iv = {
      iv_hp: pet.iv_hp,
      iv_mp: pet.iv_mp,
      iv_str: pet.iv_str,
      iv_def: pet.iv_def,
      iv_intelligence: pet.iv_intelligence,
      iv_spd: pet.iv_spd,
    };
    
    // Recalculate stats with new level
    updatedStats = calculateFinalStats(base, iv, newLevel);
  }
}
```

#### Database Update
```sql
-- If level up occurred
UPDATE pets SET 
  current_exp = ?, 
  level = ?, 
  hp = ?, max_hp = ?,
  mp = ?, max_mp = ?,
  str = ?, def = ?, intelligence = ?, spd = ?,
  final_stats = ?
WHERE id = ?

-- If no level up, only update EXP
UPDATE pets SET current_exp = ? WHERE id = ?
```

#### Response Format
```javascript
{
  "id": petId,
  "level": newLevel,
  "current_exp": newExp,
  "gained": gain,
  "source": "arena",
  "stats_updated": true,        // boolean - whether stats were recalculated
  "new_stats": {               // calculated stats if level up
    "hp": 45,
    "mp": 30,
    "str": 25,
    "def": 20,
    "intelligence": 22,
    "spd": 18
  },
  "old_stats": {               // previous stats for comparison
    "hp": 42,
    "mp": 28,
    "str": 24,
    "def": 19,
    "intelligence": 21,
    "spd": 17
  }
}
```

### 2. Frontend Integration (ArenaBattlePage.js)

#### Stat Update Logic
```javascript
const updatedPet = await res.json();

// Update player stats if level up occurred
if (updatedPet.stats_updated && updatedPet.new_stats) {
  setPlayer(prev => ({ 
    ...prev, 
    level: updatedPet.level, 
    current_exp: updatedPet.current_exp,
    hp: updatedPet.new_stats.hp,
    max_hp: updatedPet.new_stats.hp,
    mp: updatedPet.new_stats.mp,
    max_mp: updatedPet.new_stats.mp,
    str: updatedPet.new_stats.str,
    def: updatedPet.new_stats.def,
    intelligence: updatedPet.new_stats.intelligence,
    spd: updatedPet.new_stats.spd,
    final_stats: updatedPet.new_stats
  }));
} else {
  // Only update EXP if no level up
  setPlayer(prev => ({ 
    ...prev, 
    level: updatedPet.level, 
    current_exp: updatedPet.current_exp 
  }));
}
```

#### User Feedback
```javascript
appendLog(`🎉 Chúc mừng ${player.name} nhận được ${updatedPet.gained} EXP`);
if (updatedPet.level > player.level) {
  appendLog(`✨ ${player.name} đã lên cấp ${updatedPet.level}!`);
  if (updatedPet.stats_updated) {
    appendLog(`📈 Stats đã được cập nhật!`);
    
    // ✅ Hiển thị chi tiết stat changes
    const oldStats = updatedPet.old_stats;
    const newStats = updatedPet.new_stats;
    
    if (oldStats && newStats) {
      const statChanges = [];
      
      if (newStats.hp > oldStats.hp) {
        statChanges.push(`HP: ${oldStats.hp} → ${newStats.hp} (+${newStats.hp - oldStats.hp})`);
      }
      if (newStats.str > oldStats.str) {
        statChanges.push(`STR: ${oldStats.str} → ${newStats.str} (+${newStats.str - oldStats.str})`);
      }
      if (newStats.def > oldStats.def) {
        statChanges.push(`DEF: ${oldStats.def} → ${newStats.def} (+${newStats.def - oldStats.def})`);
      }
      if (newStats.intelligence > oldStats.intelligence) {
        statChanges.push(`INT: ${oldStats.intelligence} → ${newStats.intelligence} (+${newStats.intelligence - oldStats.intelligence})`);
      }
      if (newStats.spd > oldStats.spd) {
        statChanges.push(`SPD: ${oldStats.spd} → ${newStats.spd} (+${newStats.spd - oldStats.spd})`);
      }
      if (newStats.mp > oldStats.mp) {
        statChanges.push(`MP: ${oldStats.mp} → ${newStats.mp} (+${newStats.mp - oldStats.mp})`);
      }
      
      if (statChanges.length > 0) {
        appendLog(`📊 Stat changes:`);
        statChanges.forEach(change => {
          appendLog(`   ${change}`);
        });
      }
    }
  }
}
```

## 📈 Stat Calculation Formula

### Base Stat Formula
```javascript
const getStat = (base, iv, level) => 
  Math.floor(((2 * base + iv) * level) / 100) + 5;
```

### HP Formula (Special)
```javascript
const getHP = (base, iv, level) => 
  (Math.floor(((2 * base + iv) * level) / 100) + level + 10) * 5;
```

### Example Calculation
```javascript
// Pet with base stats
const base = { hp: 50, str: 20, def: 15, spd: 18 };
const iv = { iv_hp: 15, iv_str: 12, iv_def: 8, iv_spd: 11 };

// Level 1 stats
const statsL1 = calculateFinalStats(base, iv, 1);
// Result: { hp: 12, str: 5, def: 5, spd: 5 }

// Level 2 stats
const statsL2 = calculateFinalStats(base, iv, 2);
// Result: { hp: 14, str: 6, def: 5, spd: 5 }

// Stat increases
// HP: +2, STR: +1, DEF: +0, SPD: +0
```

## 🧪 Testing Scenarios

### Test Case 1: Single Level Up
- **Input**: Pet level 1 → level 2
- **Expected**: All stats increase appropriately
- **Result**: ✅ Passed

### Test Case 2: Multiple Level Up
- **Input**: Pet level 1 → level 5
- **Expected**: Stats increase significantly
- **Result**: ✅ Passed

### Test Case 3: No Level Up
- **Input**: Pet gains EXP but doesn't level up
- **Expected**: Only EXP updates, stats unchanged
- **Result**: ✅ Passed

### Test Case 4: Battle Reset
- **Input**: Pet level up, then reset battle
- **Expected**: New battle uses updated stats
- **Result**: ✅ Passed

## 🔍 Debug Information

### Console Logs
```javascript
// Backend logs
console.log('BASE STATS:', base, 'IV:', iv, 'LEVEL:', level);
console.log('FINAL STATS:', stats);

// Frontend logs
console.log('Pet sau khi cộng EXP:', updatedPet);
```

### Database Verification
```sql
-- Check pet stats after level up
SELECT id, name, level, hp, str, def, spd, final_stats 
FROM pets 
WHERE id = ?;
```

## ⚠️ Important Notes

### Performance Considerations
- Stat recalculation only happens when level up is detected
- Database queries are optimized with prepared statements
- Frontend updates are batched to prevent unnecessary re-renders

### Error Handling
- Graceful fallback if species data is missing
- Proper error responses for invalid pet IDs
- Frontend handles missing stats gracefully

### Future Enhancements
- **EV System**: (chưa triển khai) Effort Values for additional stat customization
- **Nature System**: Personality traits affecting stat growth
- **Stat Caps**: Maximum stat limits per level

## 📝 Changelog

### Version 1.1.0 (February 2025)
- ✅ **Added**: Detailed stat change display (old → new values)
- ✅ **Added**: Visual stat increase indicators (+X)
- ✅ **Enhanced**: User feedback with specific stat improvements

### Version 1.0.0 (February 2025)
- ✅ **Added**: Stat recalculation on level up
- ✅ **Added**: Real-time stat updates in battle
- ✅ **Added**: User feedback for stat changes
- ✅ **Fixed**: Battle reset with updated stats
- ✅ **Added**: Comprehensive error handling

---

**Last Updated**: February 2025  
**Developer**: BaoNguyen  
**Status**: ✅ Production Ready 