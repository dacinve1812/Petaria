import React, { useState, useEffect } from 'react';
import './HomePageVer2.css';
import { resolveAssetPath } from '../utils/pathUtils';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

function HomePageVer2() {
  const [pageConfig, setPageConfig] = useState(null);
  const [customElements, setCustomElements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // API Functions
  const fetchPageConfig = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/site-config/pages/`);
      if (!response.ok) throw new Error('Failed to fetch page config');
      const data = await response.json();
      
      if (data && data.length > 0) {
        const homepageConfig = data.find(page => page.path === '/');
        if (homepageConfig) {
          setPageConfig(homepageConfig.config);
          
          // Fetch custom elements for homepage
          const elementsResponse = await fetch(`${API_BASE_URL}/api/site-config/pages/${encodeURIComponent('/')}`);
          if (elementsResponse.ok) {
            const pageData = await elementsResponse.json();
            setCustomElements(pageData.customElements || []);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching page config from API:', error);
      // Set default values if API fails
      setPageConfig({
        displayType: 'video',
        video: {
          src: 'test.mp4',
          loop: true,
          muted: true,
          autoPlay: true,
          playsInline: true
        },
        banner: {
          visible: true,
          title: 'Welcome to Petaria!',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: '#ffffff',
          fontSize: '2rem'
        }
      });
      setCustomElements([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPageConfig();
    
    // Listen for config updates from SiteManagement
    const handleConfigUpdate = () => {
      fetchPageConfig();
    };
    
    window.addEventListener('configUpdated', handleConfigUpdate);
    
    return () => {
      window.removeEventListener('configUpdated', handleConfigUpdate);
    };
  }, []);

  // Set CSS variables for responsive banner heights
  useEffect(() => {
    if (pageConfig?.banner?.responsive) {
      const root = document.documentElement;
      if (pageConfig.banner.responsive.mobile?.height) {
        root.style.setProperty('--banner-mobile-height', pageConfig.banner.responsive.mobile.height);
      }
      if (pageConfig.banner.responsive.tablet?.height) {
        root.style.setProperty('--banner-tablet-height', pageConfig.banner.responsive.tablet.height);
      }
    }
  }, [pageConfig?.banner?.responsive]);

  const renderContent = () => {
    if (!pageConfig) return null;

    const { displayType, video, image, layout } = pageConfig;

  return (
      <>
        {/* Video Content */}
        {displayType === 'video' && video?.src && (
       <video
        className="background-video"
            autoPlay={video.autoPlay}
            loop={video.loop}
            muted={video.muted}
            playsInline={video.playsInline}
          >
            <source src={video.src} type="video/mp4" />
          </video>
        )}

        {/* Image Content */}
        {displayType === 'image' && image?.src && (
          <img
            className="background-image"
            src={image.src}
            alt={image.alt}
            style={{
              width: image.width,
              height: image.height,
              margin: image.margin
            }}
          />
        )}

        {/* Mixed Content */}
        {displayType === 'mixed' && (
          <>
            {video?.src && (
              <video
                className="background-video"
                autoPlay={video.autoPlay}
                loop={video.loop}
                muted={video.muted}
                playsInline={video.playsInline}
              >
                <source src={video.src} type="video/mp4" />
              </video>
            )}
          </>
        )}

        {/* Custom Elements */}
        {customElements.map(element => (
          <div
            key={element.id}
            className="custom-element"
            style={{
              color: element.styles.color,
              fontSize: element.styles.fontSize,
              fontFamily: element.styles.fontFamily,
              fontWeight: element.styles.fontWeight,
              textAlign: element.styles.textAlign,
              marginTop: element.styles.marginTop,
              marginRight: element.styles.marginRight,
              marginBottom: element.styles.marginBottom,
              marginLeft: element.styles.marginLeft,
              width: element.styles.width,
              height: element.styles.height,
              position: 'relative',
              zIndex: 10
            }}
          >
            {element.type === 'img' ? (
              <img
                src={element.imageSrc || '/images/placeholder.jpg'}
                alt={element.imageAlt}
                style={{
                  width: element.styles.width,
                  height: element.styles.height
                }}
              />
            ) : (
              React.createElement(
                element.type && ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'div'].includes(element.type) 
                  ? element.type 
                  : 'div', 
                {
                  dangerouslySetInnerHTML: {
                    __html: element.content || 'Element'
                  }
                }
              )
            )}
          </div>
        ))}


      </>
    );
  };

  if (isLoading) {
    return (
      <div className="map-container">
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100%',
          fontSize: '18px',
          color: '#666'
        }}>
          Đang tải trang...
        </div>
      </div>
    );
  }

  return (
    <div className="homepage-container">
      {/* Banner section */}
      {pageConfig?.banner?.visible !== false && (
        <div 
          className="homepage-banner"
          style={{
            ...(pageConfig?.banner?.image?.src ? {
              // If image is provided, use image as background
              backgroundImage: `url(${resolveAssetPath(pageConfig.banner.image.src)})`,
              backgroundPosition: pageConfig.banner.image.position || 'center center',
              backgroundSize: pageConfig.banner.image.size || 'cover',
              backgroundRepeat: pageConfig.banner.image.repeat || 'no-repeat'
            } : {
              // If no image, use background color/gradient
              background: pageConfig?.banner?.background || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
            }),
            opacity: pageConfig?.banner?.image?.opacity || 1,
            // Dimensions
            height: pageConfig?.banner?.dimensions?.height || '400px',
            maxHeight: pageConfig?.banner?.dimensions?.maxHeight || '600px',
            minHeight: pageConfig?.banner?.dimensions?.minHeight || '200px'
          }}
        >
          <div className="banner-content">
            <div className="banner-center">
              <h2 style={{
                color: pageConfig?.banner?.textColor || '#ffffff',
                fontSize: pageConfig?.banner?.fontSize || '2.5rem'
              }}>
                {pageConfig?.banner?.title || 'Welcome to Petaria'}
              </h2>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="map-container" style={{
        backgroundColor: pageConfig?.layout?.backgroundColor || '#000000',
        padding: pageConfig?.layout?.padding || '20px',
        margin: pageConfig?.layout?.margin || '0'
      }}>
        {renderContent()}
      </div>
    </div>
  );
}

export default HomePageVer2;