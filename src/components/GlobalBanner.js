import React from 'react';
import { useNavigate } from 'react-router-dom';
import './GlobalBanner.css';
import BackButton from './BackButton';

const GlobalBanner = ({ 
  backgroundImage, 
  title, 
  subtitle, 
  showBackButton = false, 
  onBackClick,
  className = '',
  overlay = true,
  backgroundPosition = 'center center'
}) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBackClick) {
      onBackClick();
    } else {
      navigate(-1);
    }
  };

  return (
    <div className={`global-banner ${className}`}>
      <div 
        className="banner-background"
        style={{
          backgroundImage: backgroundImage ? `url(${backgroundImage})` : 'none',
          backgroundPosition: backgroundPosition
        }}
      >
        {overlay && <div className="banner-overlay" />}
        
        <div className="banner-content">
          {showBackButton && (
              <BackButton onClick={handleBack} /> 
          )}
         
          
          <div className="banner-text">
            {title && <h1 className="banner-title">{title}</h1>}
            {subtitle && <p className="banner-subtitle">{subtitle}</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalBanner;
{/* <GlobalBanner
  backgroundImage="/images/background/shop-banner.jpg"  // Đường dẫn ảnh
  title="Shop Title"                                    // Tiêu đề chính
  subtitle="Shop description"                           // Mô tả phụ
  showBackButton={true}                                 // Hiển thị nút back
  onBackClick={handleBack}                              // Function xử lý back
  className="small"                                     // Size variant
  overlay={true}                                        // Hiển thị overlay
  backgroundPosition="70% 70%"                          // Vị trí background (mặc định: center center)
/> */}
// 2. Size Variants:
// small: 200px height
// Default: 300px height
// large: 400px height
// 3. Overlay Variants:
// Default: Dark gradient overlay
// dark-overlay: Darker overlay
// light-overlay: Light overlay
// no-overlay: Không có overlay
// 4. Background Position Examples:
// Default: "center center"
// Custom: "70% 70%", "top left", "bottom right", "20% 80%"