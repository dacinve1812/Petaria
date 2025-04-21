import React, { useEffect, useState  } from 'react';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import './UserProfile.css'; // Tạo file UserProfile.css

function Navbar() {
  
    return (
    
      <div className="navbar">
        <nav>
          <ul>
              {/* <li><a href="/myhome">Trợ giúp về Vật phẩm</a></li>  */}
              <li><a href="/myhome">Trang Cá Nhân</a></li>   
              {/* <li><a href="/myhome">Trang Thú Cưng</a></li>
              <li><a href="/myhome">Trang Linh Thú</a></li>
              <li><a href="/myhome">Vật phẩm của tôi</a></li>
              <li><a href="/myhome">Phòng Triển lãm của tôi</a></li>
              <li><a href="/myhome">Cửa hàng của tôi</a></li>
              <li><a href="/myhome">Trung tâm mua sắm</a></li>
              <li><a href="/myhome">Cửa hàng của tôi</a></li>
              <li><a href="/myhome">Trung tâm mua sắm</a></li>
              <li><a href="/myhome">Cửa hàng của tôi</a></li> */}
              <li><a href="/shop">Trung tâm mua sắm</a></li>
              <li><Link to="/inventory">Inventory</Link></li>
              
          </ul>
        </nav>
        </div>
    );
  }
  
  export default Navbar;