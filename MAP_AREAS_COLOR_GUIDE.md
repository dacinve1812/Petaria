# 🎨 Map Areas Color Guide - Hướng dẫn màu sắc các vùng clickable

## 📋 Tổng quan
Mỗi vùng clickable trên map có màu sắc riêng biệt để dễ dàng nhận biết và test. Dưới đây là bảng màu chi tiết:

## 🎯 **Bảng màu các vùng:**

### 🟡 **Auction (Đấu giá)**
- **Màu:** Vàng (`#FFC107`)
- **Vị trí:** `147, 39, 208, 58`
- **Kích thước:** 61×19px
- **Route:** `/auction`

### 🟢 **Shop (Cửa hàng)**
- **Màu:** Xanh lá (`#4CAF50`)
- **Vị trí:** `48, 87, 113, 108`
- **Kích thước:** 65×21px
- **Route:** `/shop`

### 🔵 **River (Sông)**
- **Màu:** Xanh dương (`#2196F3`)
- **Vị trí:** `321, 33, 375, 53`
- **Kích thước:** 54×20px
- **Route:** `/river`

### 🟣 **Bank (Ngân hàng)**
- **Màu:** Tím (`#9C27B0`)
- **Vị trí:** `217, 156, 270, 176`
- **Kích thước:** 53×20px
- **Route:** `/bank`

### 🟠 **Latest News (Tin tức)**
- **Màu:** Cam (`#FF9800`)
- **Vị trí:** `7, 216, 70, 236`
- **Kích thước:** 63×20px
- **Route:** `/latest-news`

### 🔴 **Orphanage (Trại mồ côi)**
- **Màu:** Đỏ (`#F44336`)
- **Vị trí:** `353, 170, 421, 192`
- **Kích thước:** 68×22px
- **Route:** `/orphanage`

### 🟤 **Guild (Hội)**
- **Màu:** Nâu (`#795548`)
- **Vị trí:** `487, 51, 543, 73`
- **Kích thước:** 56×22px
- **Route:** `/guild`

### 🟢 **Post Office (Bưu điện)**
- **Màu:** Xanh ngọc (`#009688`)
- **Vị trí:** `645, 26, 711, 46`
- **Kích thước:** 66×20px
- **Route:** `/post-office`

### 🩷 **Game Center (Trung tâm game)**
- **Màu:** Hồng (`#E91E63`)
- **Vị trí:** `21, 336, 106, 354`
- **Kích thước:** 85×18px
- **Route:** `/game-center`

### 🟣 **My Home (Nhà của tôi)**
- **Màu:** Tím đậm (`#673AB7`)
- **Vị trí:** `307, 328, 375, 348`
- **Kích thước:** 68×20px
- **Route:** `/my-home`

### 🔵 **Chat Room (Phòng chat)**
- **Màu:** Xanh cyan (`#00BCD4`)
- **Vị trí:** `184, 380, 239, 399`
- **Kích thước:** 55×19px
- **Route:** `/chat-room`

### 🟢 **Shop Bottom (Cửa hàng dưới)**
- **Màu:** Xanh lá (`#4CAF50`)
- **Vị trí:** `297, 460, 398, 481`
- **Kích thước:** 101×21px
- **Route:** `/shop`

### 🔴 **Logout (Đăng xuất)**
- **Màu:** Đỏ (`#F44336`)
- **Vị trí:** `556, 456, 611, 479`
- **Kích thước:** 55×23px
- **Route:** `/logout`

### 🟢 **Login (Đăng nhập)**
- **Màu:** Xanh lá (`#4CAF50`)
- **Vị trí:** `2, 462, 62, 481`
- **Kích thước:** 60×19px
- **Route:** `/login`

### 🟡 **Notice (Thông báo)**
- **Màu:** Vàng nhạt (`#FFEB3B`)
- **Vị trí:** `674, 220, 729, 248`
- **Kích thước:** 55×28px
- **Route:** `/notice`

## 🎮 **Cách test:**

### ✅ **Test từng vùng:**
1. **Click vào vùng có màu** trên map
2. **Kiểm tra URL** thay đổi đúng route
3. **Test responsive** trên các kích thước màn hình
4. **Toggle visibility** bằng button "👁️ Ẩn vùng"

### 🎯 **Test cases:**
- ✅ **Auction** → `/auction`
- ✅ **Shop** → `/shop`
- ✅ **River** → `/river`
- ✅ **Bank** → `/bank`
- ✅ **Latest News** → `/latest-news`
- ✅ **Orphanage** → `/orphanage`
- ✅ **Guild** → `/guild`
- ✅ **Post Office** → `/post-office`
- ✅ **Game Center** → `/game-center`
- ✅ **My Home** → `/my-home`
- ✅ **Chat Room** → `/chat-room`
- ✅ **Shop Bottom** → `/shop`
- ✅ **Logout** → `/logout`
- ✅ **Login** → `/login`
- ✅ **Notice** → `/notice`

## 🎨 **Màu sắc trong CSS:**

```css
/* Auction - Vàng */
.auction-area {
  border-color: rgba(255, 193, 7, 0.8);
  background: rgba(255, 193, 7, 0.2);
}

/* Shop - Xanh lá */
.shop-area {
  border-color: rgba(76, 175, 80, 0.8);
  background: rgba(76, 175, 80, 0.2);
}

/* River - Xanh dương */
.river-area {
  border-color: rgba(33, 150, 243, 0.8);
  background: rgba(33, 150, 243, 0.2);
}

/* Bank - Tím */
.bank-area {
  border-color: rgba(156, 39, 176, 0.8);
  background: rgba(156, 39, 176, 0.2);
}

/* Latest News - Cam */
.latest-news-area {
  border-color: rgba(255, 152, 0, 0.8);
  background: rgba(255, 152, 0, 0.2);
}

/* Orphanage - Đỏ */
.orphanage-area {
  border-color: rgba(244, 67, 54, 0.8);
  background: rgba(244, 67, 54, 0.2);
}

/* Guild - Nâu */
.guild-area {
  border-color: rgba(121, 85, 72, 0.8);
  background: rgba(121, 85, 72, 0.2);
}

/* Post Office - Xanh ngọc */
.post-office-area {
  border-color: rgba(0, 150, 136, 0.8);
  background: rgba(0, 150, 136, 0.2);
}

/* Game Center - Hồng */
.game-center-area {
  border-color: rgba(233, 30, 99, 0.8);
  background: rgba(233, 30, 99, 0.2);
}

/* My Home - Tím đậm */
.my-home-area {
  border-color: rgba(103, 58, 183, 0.8);
  background: rgba(103, 58, 183, 0.2);
}

/* Chat Room - Xanh cyan */
.chat-room-area {
  border-color: rgba(0, 188, 212, 0.8);
  background: rgba(0, 188, 212, 0.2);
}

/* Shop Bottom - Xanh lá */
.shop-bottom-area {
  border-color: rgba(76, 175, 80, 0.8);
  background: rgba(76, 175, 80, 0.2);
}

/* Logout - Đỏ */
.logout-area {
  border-color: rgba(244, 67, 54, 0.8);
  background: rgba(244, 67, 54, 0.2);
}

/* Login - Xanh lá */
.login-area {
  border-color: rgba(76, 175, 80, 0.8);
  background: rgba(76, 175, 80, 0.2);
}

/* Notice - Vàng nhạt */
.notice-area {
  border-color: rgba(255, 235, 59, 0.8);
  background: rgba(255, 235, 59, 0.2);
}
```

## 🎯 **Tính năng:**

### 🔄 **Toggle Visibility:**
- **Button:** "👁️ Ẩn vùng" / "👁️‍🗨️ Hiện vùng"
- **Chức năng:** Ẩn/hiện tất cả vùng clickable
- **Vị trí:** Trên cùng của map

### 🎨 **Visual Effects:**
- **Hover:** Opacity tăng, border sáng hơn
- **Transition:** Smooth animation 0.3s
- **Pointer events:** Không ảnh hưởng click

### 📱 **Responsive:**
- **Tự động scale** với image size
- **Không cần media queries**
- **Hoạt động trên mọi kích thước**

## 🎉 **Kết luận:**

Bây giờ bạn có thể:
- ✅ **Nhìn thấy rõ ràng** tất cả vùng clickable với màu sắc khác nhau
- ✅ **Test dễ dàng** từng vùng một cách trực quan
- ✅ **Toggle visibility** để ẩn/hiện các vùng
- ✅ **Responsive testing** trên mọi kích thước màn hình

**🎯 Hãy test từng vùng và kiểm tra xem navigation có hoạt động đúng không!**
