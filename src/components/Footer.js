import React from 'react';
import './Footer.css';

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-links">
        <div className="footer-links-row">
          <a href="#">Giới thiệu cho bạn bè</a>
          <span className="footer-sep">|</span>
          <a href="#">Nâng cấp Tài khoản VIP</a>
          <span className="footer-sep">|</span>
          <a href="#">Luật lệ</a>
          <span className="footer-sep">|</span>
          <a href="#">Chính sách bảo mật</a>
          <span className="footer-sep">|</span>
          <a href="#">Liên hệ</a>
        </div>
        <div className="footer-copyright">
        Bản quyền nội dung thuộc Vnpet.com. Bản quyền hình ảnh thuộc về Pokemon, Digimon, Neopets, Anatheria, Teripets... được sử dụng với mục đích phục vụ cộng đồng.
      </div>
      </div>



    </footer>
  );
}

export default Footer;
