# Hướng dẫn sử dụng Repair Button

## Tổng quan
Repair Button là component cho phép người chơi dễ dàng truy cập hệ thống sửa chữa equipment bị hỏng.

## Tính năng
- **Nút đẹp** với animation xoay
- **Mở modal** hiển thị equipment bị hỏng
- **Hỗ trợ Repair Kit** và Blacksmith
- **Responsive design** cho mobile

## Cách sử dụng

### 1. Import component
```jsx
import RepairButton from './components/items/RepairButton';
```

### 2. Sử dụng trong component
```jsx
<RepairButton 
  userId={currentUser.id} 
  onRepairComplete={() => {
    // Refresh data sau khi repair
    refreshInventory();
  }} 
/>
```

## Đã tích hợp vào:

### 1. Inventory Page
- **Vị trí**: Góc phải trên, cạnh tiêu đề "Kho vật phẩm"
- **Chức năng**: Refresh inventory sau khi repair

### 2. Battle Page  
- **Vị trí**: Góc phải trên, cạnh tiêu đề "Chế độ chiến đấu"
- **Chức năng**: Truy cập nhanh repair system

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `userId` | number | ✅ | ID của user hiện tại |
| `onRepairComplete` | function | ❌ | Callback khi repair hoàn thành |

## CSS Classes

### `.repair-button`
- Nút chính với gradient màu tím
- Hover effect với transform và shadow
- Animation xoay cho icon

### `.repair-button.compact`
- Phiên bản nhỏ gọn cho không gian hạn chế
- Padding và font size nhỏ hơn

### `.repair-icon`
- Icon 🔧 với animation xoay 2s
- Font size 16px (12px cho compact)

## Responsive Design

### Desktop
- Padding: 10px 16px
- Font size: 14px
- Icon size: 16px

### Mobile (max-width: 768px)
- Padding: 8px 12px  
- Font size: 12px
- Icon size: 14px

## Thêm vào component khác

### Ví dụ: Thêm vào PetProfile
```jsx
// Trong PetProfile.js
import RepairButton from '../items/RepairButton';

<div className="pet-header">
  <h2>Thông tin Pet</h2>
  <RepairButton userId={userId} onRepairComplete={loadPetEquipment} />
</div>
```

### Ví dụ: Thêm vào Shop
```jsx
// Trong ShopPage.js
import RepairButton from '../items/RepairButton';

<div className="shop-header">
  <h2>Cửa hàng</h2>
  <RepairButton userId={userId} onRepairComplete={() => {}} />
</div>
```

## Customization

### Thay đổi màu sắc
```css
.repair-button {
  background: linear-gradient(135deg, #your-color-1 0%, #your-color-2 100%);
}
```

### Thay đổi icon
```jsx
<span className="repair-icon">🛠️</span> // Thay vì 🔧
```

### Thay đổi text
```jsx
<span className="repair-text">Sửa đồ</span> // Thay vì "Sửa chữa"
```

## Lưu ý

1. **Cần userId**: Component cần userId để hoạt động
2. **Modal dependency**: Phụ thuộc vào BrokenEquipmentModal
3. **API calls**: Tự động gọi API để lấy broken equipment
4. **Error handling**: Có xử lý lỗi cơ bản

## Troubleshooting

### Lỗi thường gặp
1. **Modal không mở**: Kiểm tra BrokenEquipmentModal import
2. **API lỗi**: Kiểm tra userId và API endpoint
3. **Styling**: Kiểm tra RepairButton.css được import

### Debug
```jsx
<RepairButton 
  userId={userId} 
  onRepairComplete={() => {
    console.log('Repair completed');
    refreshData();
  }} 
/>
``` 