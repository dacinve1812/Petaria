# Equipment Repair System Analysis

## 🎯 Vấn đề cần giải quyết
Equipment items bị hỏng vĩnh viễn khi hết durability. Cần cân nhắc hệ thống sửa chữa để balance game economy.

## 🔧 Các Options có thể áp dụng

### Option 1: Equipment Biến Mất Vĩnh Viễn (Đã thay đổi)
**Logic mới:**
- Equipment hỏng → chuyển sang trạng thái "broken" (is_broken = 1)
- Không bị xóa khỏi database
- Có thể sửa chữa bằng Repair Kit hoặc Blacksmith
- Không hiển thị trong battle khi broken

**Ưu điểm:**
- Equipment không mất vĩnh viễn
- Có thể sửa chữa với cost
- Tạo sink cho currency và repair items
- Balance tốt hơn cho người chơi

**Nhược điểm:**
- Phức tạp hơn để implement
- Cần design repair costs cẩn thận
- Có thể làm equipment quá dễ có nếu repair quá rẻ

### Option 2: Repair System với Item
**Cơ chế:**
- Tạo "Repair Kit" items (common/rare/epic/legendary)
- Repair Kit có thể sửa equipment tương ứng rarity
- Equipment hỏng → "Broken" state → cần Repair Kit để sửa

**Ưu điểm:**
- Equipment không mất vĩnh viễn
- Tạo sink cho Repair Kit items
- Có thể balance qua rarity của Repair Kit

**Nhược điểm:**
- Phức tạp hơn để implement
- Cần design Repair Kit drop rate
- Có thể làm equipment quá dễ có

### Option 3: Blacksmith Shop System
**Cơ chế:**
- Tạo Blacksmith NPC trong game
- Người chơi trả coin/gem để sửa equipment
- Giá sửa dựa trên rarity và level của equipment

**Ưu điểm:**
- Sink cho currency (coin/gem)
- Có thể balance qua giá sửa
- Tạo thêm content cho game

**Nhược điểm:**
- Cần implement UI cho Blacksmith
- Có thể làm người chơi nghèo nếu giá cao
- Cần balance giá sửa vs giá mua mới

### Option 4: Hybrid System
**Cơ chế:**
- Equipment hỏng → "Broken" state
- Có thể sửa bằng Repair Kit HOẶC Blacksmith
- Một số equipment quý hiếm không thể sửa (Legendary)

**Ưu điểm:**
- Linh hoạt cho người chơi
- Có thể balance theo từng loại equipment
- Tạo hierarchy cho equipment

**Nhược điểm:**
- Phức tạp nhất để implement
- Cần design cẩn thận để không confuse người chơi

## 📊 Recommendation

### Giai đoạn 1 (Hiện tại): Option 1 + Balance
- Giữ equipment biến mất vĩnh viễn
- **Tăng drop rate** equipment trong arena/hunting
- **Giảm giá** equipment trong shop
- **Thêm equipment rewards** cho daily quests

### Giai đoạn 2 (Sau này): Option 3 - Blacksmith Shop
- Implement Blacksmith NPC
- Giá sửa = 50-70% giá mua mới
- Chỉ sửa được equipment rarity <= Rare
- Epic/Legendary vẫn biến mất vĩnh viễn

### Giai đoạn 3 (End-game): Option 4 - Hybrid
- Thêm Repair Kit items
- Repair Kit chỉ có thể sửa equipment cùng rarity
- Blacksmith có thể sửa tất cả (giá cao hơn)

## 🎮 Implementation Priority

### Phase 1: Balance Current System
1. **Tăng drop rate** equipment từ 5% → 15-20%
2. **Giảm giá** equipment trong shop 30-50%
3. **Thêm equipment rewards** cho:
   - Daily login bonus
   - Arena victories
   - Level up rewards
   - Achievement rewards

### Phase 2: Blacksmith System
1. Tạo Blacksmith NPC và UI
2. Implement repair logic
3. Balance repair costs
4. Add broken equipment state

### Phase 3: Advanced Features
1. Repair Kit items
2. Equipment enhancement system
3. Durability boost items

## 💰 Economic Balance

### Equipment Drop Rates (Recommended)
- **Common**: 25% (arena), 15% (hunting)
- **Uncommon**: 15% (arena), 8% (hunting)  
- **Rare**: 8% (arena), 4% (hunting)
- **Epic**: 3% (arena), 1% (hunting)
- **Legendary**: 1% (arena), 0.5% (hunting)

### Equipment Prices (Recommended)
- **Common**: 100-500 gold
- **Uncommon**: 500-2000 gold
- **Rare**: 2000-8000 gold
- **Epic**: 8000-25000 gold
- **Legendary**: 25000+ gold

### Repair Costs (Future)
- **Common**: 50 gold
- **Uncommon**: 200 gold
- **Rare**: 800 gold
- **Epic**: 2000 gold
- **Legendary**: 5000 gold (nếu có thể sửa)

## 🎯 Conclusion

**Khuyến nghị bắt đầu với Option 1 + balance** vì:
1. Đơn giản để implement
2. Dễ balance
3. Có thể upgrade lên Option 3 sau này
4. Tạo cảm giác quý hiếm cho equipment

**Ưu tiên ngay:**
1. Tăng drop rate equipment
2. Giảm giá equipment
3. Thêm equipment rewards
4. Monitor player feedback 