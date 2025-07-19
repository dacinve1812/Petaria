import React from 'react';
import './HomePageVer2.css';

function HomePageVer2() {
  const handleButtonClick = (page) => {
    // Navigate to different pages based on button clicked
    switch(page) {
      case 'shop':
        window.location.href = '/shop';
        break;
      case 'battle':
        window.location.href = '/battle';
        break;
      case 'inventory':
        window.location.href = '/inventory';
        break;
      case 'profile':
        window.location.href = '/profile';
        break;
      default:
        console.log('Unknown page:', page);
    }
  };

  return (
    <div className="map-container">
       <video
        className="background-video"
        autoPlay
        loop
        muted
        playsInline
      >
        <source src="test.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
      {/* <div className="map-image">
        <div className="invisible-filler">
          {[...Array(65)].map((_, i) => (
            <p key={i}>{i + 1}</p>
          ))}
        </div>
        

        <div className="map-buttons">
          <button 
            className="map-button shop-button"
            onClick={() => handleButtonClick('shop')}
          >
            Shop
          </button>
          
          <button 
            className="map-button battle-button"
            onClick={() => handleButtonClick('battle')}
          >
            Battle Arena
          </button>
          
          <button 
            className="map-button inventory-button"
            onClick={() => handleButtonClick('inventory')}
          >
            Inventory
          </button>
          
          <button 
            className="map-button profile-button"
            onClick={() => handleButtonClick('profile')}
          >
            Profile
          </button>
        </div>
      </div> */}
    </div>
  );
}

export default HomePageVer2;