# 🗺️ HTML Map Tag Guide - Giải pháp hoàn hảo cho Clickable Areas

## 📋 Tổng quan
HTML `<map>` tag là giải pháp **native** và **chính xác nhất** để tạo các vùng clickable trên image. Không bị ảnh hưởng bởi responsive, overflow, hay resize.

## ✅ **Ưu điểm của HTML Map Tag:**

### 🎯 **Chính xác tuyệt đối:**
- **Pixel-perfect positioning** - Vị trí chính xác đến từng pixel
- **No responsive issues** - Không bị ảnh hưởng bởi resize
- **Overflow-safe** - Hoạt động với mọi loại overflow
- **Native browser support** - Hỗ trợ tốt trên mọi trình duyệt

### 🔧 **Dễ sử dụng:**
- **Simple syntax** - Cú pháp đơn giản
- **Visual feedback** - Có thể thêm overlay để hiển thị
- **Accessibility** - Hỗ trợ tốt cho accessibility
- **SEO friendly** - Tốt cho SEO

## 🎯 **Cách hoạt động:**

### 📐 **Cấu trúc cơ bản:**
```html
<img src="map.jpg" alt="Bản đồ" useMap="#map-name" />
<map name="map-name" id="map-name">
  <area shape="rect" coords="x1,y1,x2,y2" alt="Mô tả" />
  <area shape="circle" coords="x,y,radius" alt="Mô tả" />
  <area shape="poly" coords="x1,y1,x2,y2,x3,y3" alt="Mô tả" />
</map>
```

### 🎨 **Các loại shape:**
- **`rect`** - Hình chữ nhật: `coords="left,top,right,bottom"`
- **`circle`** - Hình tròn: `coords="centerX,centerY,radius"`
- **`poly`** - Đa giác: `coords="x1,y1,x2,y2,x3,y3,..."`

## 🛠️ **Implementation trong React:**

### 📝 **HomePage.js:**
```javascript
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function HomePage() {
  const navigate = useNavigate();
  const [showAreas, setShowAreas] = useState(true);

  const handleAreaClick = (destination) => {
    navigate(destination);
  };

  return (
    <div>
      {/* Map Controls */}
      <div className="map-controls">
        <button onClick={() => setShowAreas(!showAreas)}>
          {showAreas ? '👁️ Ẩn vùng' : '👁️‍🗨️ Hiện vùng'}
        </button>
      </div>

      {/* Map Container */}
      <div className="map-scroll-container">
        <div className="map-wrapper">
          <img 
            src="map.jpg" 
            alt="Bản đồ Petaria" 
            className="map-img"
            useMap="#petaria-map"
          />
          
          {/* HTML Map with clickable areas */}
          <map name="petaria-map" id="petaria-map">
            <area 
              shape="rect" 
              coords="200, 300, 350, 450" 
              alt="Cửa hàng" 
              title="Cửa hàng - Click để vào"
              onClick={() => handleAreaClick('/shop')}
              style={{ cursor: 'pointer' }}
            />
            
            <area 
              shape="rect" 
              coords="500, 200, 700, 400" 
              alt="Trại mồ côi" 
              title="Trại mồ côi - Click để vào"
              onClick={() => handleAreaClick('/orphanage')}
              style={{ cursor: 'pointer' }}
            />
            
            {/* Thêm các area khác... */}
          </map>

          {/* Visual overlay (optional) */}
          {showAreas && (
            <div className="areas-overlay">
              <div className="area-visual shop-area" title="Cửa hàng"></div>
              <div className="area-visual orphanage-area" title="Trại mồ côi"></div>
              {/* Thêm các visual area khác... */}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

### 🎨 **CSS cho Visual Overlay:**
```css
.map-wrapper {
  position: relative;
  display: inline-block;
}

.areas-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.area-visual {
  position: absolute;
  border: 2px solid rgba(255, 255, 255, 0.8);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
  opacity: 0.6;
}

.area-visual:hover {
  opacity: 0.8;
  border-color: rgba(255, 255, 255, 1);
  background: rgba(255, 255, 255, 0.2);
}

/* Specific area positions - phải khớp với coords trong map tag */
.shop-area {
  left: 200px;
  top: 300px;
  width: 150px;
  height: 150px;
  border-color: rgba(76, 175, 80, 0.8);
}

.orphanage-area {
  left: 500px;
  top: 200px;
  width: 200px;
  height: 200px;
  border-color: rgba(255, 152, 0, 0.8);
}
```

## 🎯 **Cách xác định tọa độ chính xác:**

### 🛠️ **Sử dụng MapCoordinateTool (workflow mới):**
1. Truy cập `/map-tool` trong ứng dụng
2. Đổi `image src` (hoặc chọn file local), `map name` và `preview height`
3. Click-kéo để tạo vùng, nhập `name`, `path`, `button label`
4. Bấm **Export JSON**
5. Với HomePage castle map: ghi đè file `src/config/homepage-castle-map.json`
6. Bấm **Import JSON** khi muốn mở lại preset để chỉnh tiếp
7. `Copy Code` chỉ dùng khi cần paste thủ công vào component khác

### 📐 **Manual method:**
1. Mở Developer Tools (F12)
2. Inspect image element
3. Sử dụng console để tính tọa độ:
```javascript
// Lấy tọa độ click
document.querySelector('.map-img').addEventListener('click', (e) => {
  const rect = e.target.getBoundingClientRect();
  const x = Math.round(e.clientX - rect.left);
  const y = Math.round(e.clientY - rect.top);
  console.log(`Coords: ${x}, ${y}`);
});
```

## 🎨 **Advanced Features:**

### 🔄 **Toggle Visibility:**
```javascript
const [showAreas, setShowAreas] = useState(true);

// Toggle button
<button onClick={() => setShowAreas(!showAreas)}>
  {showAreas ? 'Ẩn vùng' : 'Hiện vùng'}
</button>

// Conditional overlay
{showAreas && <div className="areas-overlay">...</div>}
```

### 🎯 **Hover Effects:**
```css
.area-visual:hover {
  opacity: 0.8;
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
```

### 🎨 **Color Coding:**
```css
.shop-area { border-color: rgba(76, 175, 80, 0.8); }      /* Xanh lá */
.orphanage-area { border-color: rgba(255, 152, 0, 0.8); }  /* Cam */
.myhome-area { border-color: rgba(33, 150, 243, 0.8); }    /* Xanh dương */
.battle-area { border-color: rgba(244, 67, 54, 0.8); }     /* Đỏ */
```

## 🐛 **Troubleshooting:**

### ❌ **Area không click được:**
1. Kiểm tra `useMap="#map-name"` khớp với `name="map-name"`
2. Kiểm tra `coords` format đúng
3. Kiểm tra `onClick` handler
4. Kiểm tra console errors

### ❌ **Vị trí không đúng:**
1. Sử dụng MapCoordinateTool để lấy tọa độ chính xác
2. Kiểm tra image size và coords
3. Test trên các kích thước màn hình khác nhau

### ❌ **Visual overlay không hiển thị:**
1. Kiểm tra `showAreas` state
2. Kiểm tra CSS positioning
3. Kiểm tra `pointer-events: none` trên overlay

## 📱 **Responsive Considerations:**

### ✅ **HTML Map Tag tự động responsive:**
- Tọa độ tự động scale với image
- Không cần media queries
- Hoạt động trên mọi kích thước màn hình

### 🎨 **Visual Overlay responsive:**
```css
@media (max-width: 768px) {
  .area-visual {
    border-width: 1px;
    border-radius: 4px;
  }
}
```

## 🎯 **Best Practices:**

### ✅ **Nên làm:**
- Sử dụng MapCoordinateTool để lấy tọa độ chính xác
- Thêm `alt` và `title` cho accessibility
- Sử dụng visual overlay để UX tốt hơn
- Test trên nhiều kích thước màn hình

### ❌ **Không nên:**
- Sử dụng pixel values cố định
- Quên thêm `useMap` attribute
- Bỏ qua accessibility attributes
- Không test responsive

## 🎉 **Kết luận:**

HTML `<map>` tag là **giải pháp hoàn hảo** cho clickable areas trên image:

- ✅ **Chính xác tuyệt đối** - Pixel-perfect positioning
- ✅ **Responsive tự động** - Không cần media queries
- ✅ **Overflow-safe** - Hoạt động với mọi overflow
- ✅ **Native support** - Hỗ trợ tốt trên mọi browser
- ✅ **Accessibility** - Tốt cho screen readers
- ✅ **SEO friendly** - Tốt cho search engines

**🎯 Sử dụng MapCoordinateTool để tạo tọa độ chính xác và lưu preset JSON để tái sử dụng!**
