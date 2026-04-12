## 📋 Tổng quan

Hệ thống authentication của Petaria được thiết kế với focus vào **bảo mật** và **hiệu suất**. Sử dụng JWT token với validation từ database, không lưu trữ thông tin nhạy cảm trong localStorage.

## 🏗️ Kiến trúc hệ thống

### **Backend (Node.js + Express)**
- **JWT Token**: 23 giờ expiration
- **Database validation**: Admin role từ database
- **API endpoints**: Login, refresh-token, user-profile

### **Frontend (React)**
- **UserContext**: Centralized state management
- **Token validation**: Client-side + server-side
- **Auto-refresh**: Token tự động gia hạn

## 🔧 Các thành phần chính

### 1. **UserContext.js** - Core Authentication Logic

```javascript
// State management với useReducer
const initialState = {
  user: null,
  isLoading: true,
  error: null,
  isAuthenticated: false
};

// Các functions chính
const {
  user,           // Thông tin user hiện tại
  isLoading,      // Trạng thái loading
  isAuthenticated, // User đã đăng nhập
  login,          // Hàm đăng nhập
  logout,         // Hàm đăng xuất
  refreshToken,   // Refresh token
  isTokenValid,   // Kiểm tra token
  getTokenInfo    // Debug info
} = useUser();
```

### 2. **Backend APIs**

#### **POST /login**
```javascript
// Request
{
  "username": "admin",
  "password": "password"
}

// Response
{
  "message": "User logged in successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "hasPet": true
}
```

#### **GET /api/user/profile**
```javascript
// Headers
Authorization: Bearer <token>

// Response
{
  "userId": 6,
  "username": "admin",
  "role": "admin",
  "isAdmin": true,
  "hasPet": true
}
```

#### **POST /refresh-token**
```javascript
// Headers
Authorization: Bearer <token>

// Response
{
  "message": "Token refreshed successfully",
  "token": "new_token_here",
  "isAdmin": true,
  "hasPet": true
}
```

## 🔒 Bảo mật

### **Vấn đề đã khắc phục:**

#### **❌ Trước (KHÔNG AN TOÀN):**
```javascript
// Lưu isAdmin trong localStorage - CÓ THỂ BỊ GIẢ MẠO
localStorage.setItem('isAdmin', 'true');
const isAdmin = localStorage.getItem('isAdmin') === 'true';
```

#### **✅ Sau (AN TOÀN):**
```javascript
// Lấy isAdmin từ database qua API
const response = await fetch('/api/user/profile', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { isAdmin } = await response.json(); // Từ database
```

### **Security Features:**
- ✅ **Token-based authentication**
- ✅ **Database role validation**
- ✅ **No sensitive data in localStorage**
- ✅ **Auto token refresh**
- ✅ **Server-side validation**

## 🚀 Performance Optimization

### **API Calls Minimization:**

#### **Khi nào gọi API:**
1. **App khởi động**: 1 call `/api/user/profile`
2. **User login**: 1 call `/api/user/profile`
3. **Token refresh**: 1 call `/refresh-token`

#### **Khi nào KHÔNG gọi API:**
- ✅ Vào trang admin
- ✅ Chuyển đổi giữa các trang
- ✅ Check authentication trong components

### **Caching Strategy:**
```javascript
// UserContext cache user data trong memory
// Không cần gọi API mỗi lần vào trang mới
const { user, isLoading } = useUser();
if (!user || !user.isAdmin) {
  navigate('/login'); // 0 API calls
}
```

## 📱 Cách sử dụng

### **1. Trong App.js:**
```javascript
import { UserProvider } from './UserContext';

function App() {
  return (
    <UserProvider>
      {/* Your app components */}
    </UserProvider>
  );
}
```

### **2. Trong Components:**
```javascript
import { useUser } from '../UserContext';

function MyComponent() {
  const { user, isLoading, logout } = useUser();
  
  if (isLoading) return <div>Loading...</div>;
  if (!user) return <div>Please login</div>;
  
  return (
    <div>
      Welcome {user.username}!
      {user.isAdmin && <AdminPanel />}
    </div>
  );
}
```

### **3. Admin Components Pattern:**
```javascript
function AdminComponent() {
  const { user, isLoading } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && (!user || !user.isAdmin)) {
      navigate('/login');
    }
  }, [user, isLoading, navigate]);

  if (isLoading) return <div>Loading...</div>;
  if (!user || !user.isAdmin) return null;

  return <div>Admin Content</div>;
}
```

## 🔄 Authentication Flow

### **1. Login Flow:**
```
User Login → Backend validates → Returns token
Frontend calls /api/user/profile → Gets user data
UserContext stores data → User authenticated
```

### **2. Page Navigation Flow:**
```
User navigates to admin page
Component checks UserContext (0 API calls)
If not admin → Redirect to login
If admin → Show content
```

### **3. Token Refresh Flow:**
```
Token expires in 1 hour
Auto-refresh calls /refresh-token
Gets new token + user data
Updates UserContext
User stays logged in
```

## 🛠️ Troubleshooting

### **Common Issues:**

#### **1. "Cannot update component while rendering"**
```javascript
// ❌ WRONG - Direct navigation in render
if (!user || !user.isAdmin) {
  navigate('/login'); // Causes error
  return null;
}

// ✅ CORRECT - Use useEffect
useEffect(() => {
  if (!isLoading && (!user || !user.isAdmin)) {
    navigate('/login');
  }
}, [user, isLoading, navigate]);
```

#### **2. Admin bị logout khi vào trang con**
```javascript
// ❌ WRONG - Using old UserContext
const user = useContext(UserContext);

// ✅ CORRECT - Using new useUser hook
const { user, isLoading } = useUser();
```

#### **3. Token expired**
```javascript
// ✅ Auto-handled by UserContext
// Token sẽ tự động refresh 1 giờ trước khi hết hạn
// Nếu refresh fail → Auto logout
```

## 📊 Performance Metrics

### **API Calls per User Session:**
- **App start**: 1 call
- **Login**: 1 call  
- **Token refresh**: 1 call (mỗi 22 giờ)
- **Page navigation**: 0 calls ✅

### **Total**: ~3-5 calls per session (rất tối ưu!)

## 🔮 Future Enhancements

### **Có thể thêm:**
1. **WebSocket**: Real-time admin status updates
2. **Cache TTL**: Giảm API calls hơn nữa
3. **Background refresh**: Update user data định kỳ
4. **Multi-device sync**: Sync login across devices

### **Không cần thiết:**
- ❌ Gọi API mỗi trang
- ❌ Lưu admin status trong localStorage
- ❌ Client-side role validation

## 📝 Best Practices

### **DO:**
- ✅ Sử dụng `useUser()` hook
- ✅ Check `isLoading` trước khi redirect
- ✅ Sử dụng `useEffect` cho navigation
- ✅ Handle loading states

### **DON'T:**
- ❌ Gọi API trong render
- ❌ Direct navigation trong render
- ❌ Sử dụng `useContext(UserContext)` cũ
- ❌ Lưu sensitive data trong localStorage

## 🎯 Kết luận

Hệ thống authentication hiện tại đã được tối ưu hóa về:
- **Bảo mật**: Token-based với database validation
- **Performance**: Minimal API calls
- **UX**: Smooth navigation không bị lag
- **Maintainability**: Centralized state management

**Không cần thay đổi gì thêm** trừ khi có yêu cầu đặc biệt! 🚀

## 📁 File Structure

```
petaria/
├── src/
│   ├── UserContext.js          # Core authentication logic
│   ├── App.js                  # UserProvider wrapper
│   └── components/
│       ├── Auth.js             # Login/Register component
│       ├── Admin.js            # Admin dashboard
│       └── admin/              # Admin sub-components
└── backend/
    └── server.js               # Authentication APIs
```

## 🔗 Related Files

- **UserContext.js**: Core authentication state management
- **Auth.js**: Login/Register component
- **Admin.js**: Admin dashboard
- **server.js**: Backend authentication APIs
- **All admin components**: Updated to use new UserContext

---

*Documentation được tạo ngày: $(Get-Date)*
*Version: 2.0 - Secure Authentication System*
"@