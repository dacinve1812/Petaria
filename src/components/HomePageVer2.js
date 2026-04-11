import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import GlobalBanner from './GlobalBanner';
import PetNotice from './PetNotice';
import './HomePageVer2.css';
import { resolveAssetPath } from '../utils/pathUtils';
import { DEFAULT_CONTENT_BLOCKS, CONTENT_BLOCK_KEYS, LIST_BLOCK_KEYS } from '../data/homePageContentBlocks';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

function HomePageVer2() {
  const navigate = useNavigate();
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
          const raw = homepageConfig.config;
          const config = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return raw || {}; } })() : (raw || {});
          setPageConfig(config);
          
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

        {/* 4 khối nội dung trang chủ (từ config.contentBlocks hoặc default) */}
        <div className="homepage-content-blocks">
          {CONTENT_BLOCK_KEYS.map((key) => {
            const fromConfig = pageConfig?.contentBlocks && pageConfig.contentBlocks[key];
            const defaultBlock = DEFAULT_CONTENT_BLOCKS[key];
            const block = fromConfig || defaultBlock;
            const itemsToUse = LIST_BLOCK_KEYS.includes(key)
              ? (Array.isArray(block?.items) && block.items.length > 0 ? block.items : defaultBlock?.items || [])
              : [];
            const useItems = itemsToUse.length > 0;
            const useHtml = !LIST_BLOCK_KEYS.includes(key) && block?.html && String(block.html).trim() !== '';
            const notesBlockForRow = key === 'forum' ? (pageConfig?.contentBlocks?.notes || DEFAULT_CONTENT_BLOCKS['notes']) : null;
            const notesItemsForRow = notesBlockForRow && Array.isArray(notesBlockForRow?.items) && notesBlockForRow.items.length > 0 ? notesBlockForRow.items : (DEFAULT_CONTENT_BLOCKS['notes']?.items || []);
            const notesHasContent = key === 'forum' && notesItemsForRow.length > 0;
            const hasContent = useItems || useHtml || notesHasContent;
            if (!block || !hasContent) return null;
            const className = `homepage-block homepage-block-${key}`;
            const listItems = useItems ? (
              <>
                {itemsToUse.map((item, i) => (
                  <div key={i} className="list-item" style={{ color: item.color || undefined }}>
                    * {item.prefix && <span>{item.prefix} </span>}
                    {item.link ? (
                      <a href={item.link} target="_blank" rel="noopener noreferrer">{item.text}</a>
                    ) : (
                      <span>{item.text}</span>
                    )}
                    {item.isNew && <img src="/images/background/new.gif" alt="new" style={{ verticalAlign: 'middle', marginLeft: 4 }} />}
                  </div>
                ))}
              </>
            ) : null;
            return (
              <React.Fragment key={key}>
                {!LIST_BLOCK_KEYS.includes(key) && block.css && <style dangerouslySetInnerHTML={{ __html: block.css }} />}
                {key === 'notice' && useItems ? (
                  <div className={className}>
                    <table bgcolor="#00ccff" cellSpacing={2} cellPadding={2} width="40%" className="homepage-block-notice-table">
                      <tbody>
                        <tr bgcolor="#FFFFFF">
                          <td width="50%" className="homepage-block-notice-td">
                            <div className="homepage-block-notice-title">THÔNG BÁO</div>
                            <div className="homepage-block-notice-body">{listItems}</div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : key === 'forum' ? (
                  (() => {
                    const notesFromConfig = pageConfig?.contentBlocks && pageConfig.contentBlocks['notes'];
                    const notesDefault = DEFAULT_CONTENT_BLOCKS['notes'];
                    const notesBlock = notesFromConfig || notesDefault;
                    const notesItemsToUse = Array.isArray(notesBlock?.items) && notesBlock.items.length > 0 ? notesBlock.items : notesDefault?.items || [];
                    const notesUseItems = notesItemsToUse.length > 0;
                    if (!useItems && !notesUseItems) return null;
                    const notesListItems = notesUseItems ? (
                      <>
                        {notesItemsToUse.map((item, i) => (
                          <div key={i} className="list-item" style={{ color: item.color || undefined }}>
                            * {item.prefix && <span>{item.prefix} </span>}
                            {item.link ? (
                              <a href={item.link} target="_blank" rel="noopener noreferrer">{item.text}</a>
                            ) : (
                              <span>{item.text}</span>
                            )}
                            {item.isNew && <img src="/images/background/new.gif" alt="new" style={{ verticalAlign: 'middle', marginLeft: 4 }} />}
                          </div>
                        ))}
                      </>
                    ) : null;
                    return (
                      <div className="homepage-block-forum-notes-row">
                        <div className="homepage-block homepage-block-forum">
                          <div className="homepage-block-forum-title">Thông tin Diễn đàn</div>
                          <div className="homepage-block-forum-body">{listItems}</div>
                        </div>
                        <div className="homepage-block homepage-block-notes">
                          <div className="homepage-block-notes-title">Lưu ý</div>
                          <div className="homepage-block-notes-body">{notesListItems}</div>
                        </div>
                      </div>
                    );
                  })()
                ) : key === 'notes' ? null : useHtml ? (
                  key === 'worldmap' ? (
                    <div
                      className={className + ' homepage-block-worldmap-clickable'}
                      role="link"
                      tabIndex={0}
                      onClick={(e) => {
                        const anchor = e.target.closest('a');
                        if (anchor) e.preventDefault();
                        navigate('/world-map');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          navigate('/world-map');
                        }
                      }}
                      dangerouslySetInnerHTML={{ __html: block.html }}
                    />
                  ) : (
                    <div className={className} dangerouslySetInnerHTML={{ __html: block.html }} />
                  )
                ) : null}
              </React.Fragment>
            );
          })}
        </div>
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
    <div>
      
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