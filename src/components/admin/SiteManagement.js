import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './SiteManagement.css';
import { DEFAULT_CONTENT_BLOCKS, CONTENT_BLOCK_KEYS, CONTENT_BLOCK_LABELS, LIST_BLOCK_KEYS } from '../../data/homePageContentBlocks';

const DEFAULT_CONTENT_BLOCKS_STORAGE_KEY = 'petaria_default_content_blocks';

function getDefaultContentBlocks() {
  try {
    const saved = localStorage.getItem(DEFAULT_CONTENT_BLOCKS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') {
        return { ...DEFAULT_CONTENT_BLOCKS, ...parsed };
      }
    }
  } catch (e) { /* ignore */ }
  return { ...DEFAULT_CONTENT_BLOCKS };
}

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

function SiteManagement() {
  const navigate = useNavigate();
  const [pages, setPages] = useState([]);
  const [selectedPage, setSelectedPage] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [currentConfig, setCurrentConfig] = useState(null);
  const [savedConfigs, setSavedConfigs] = useState([]);
  const [customElements, setCustomElements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingConfigId, setEditingConfigId] = useState(null); // Track which config is being edited
  
  // Navbar management state
  const [navbarConfig, setNavbarConfig] = useState({
    bottomNavbar: {
      visible: true,
      showMenuOnly: false
    },
    floatingButtons: {
      visible: true
    }
  });
  const [activeTab, setActiveTab] = useState('pages'); // 'pages' | 'navbar'
  const [layoutCollapsed, setLayoutCollapsed] = useState(true);
  const [bannerCollapsed, setBannerCollapsed] = useState(true);
  const [elementsCollapsed, setElementsCollapsed] = useState(true);
  const [contentBlockCollapsed, setContentBlockCollapsed] = useState({ notice: true, forum: true, notes: true, worldmap: true });
  const [elementCardCollapsed, setElementCardCollapsed] = useState({}); // { [elementId]: true = collapsed }

  // API Functions
  const initializeDefaultPages = async () => {
    try {
      // Try to create default pages in database
      for (const page of defaultPages) {
        await savePageToDatabase(page);
      }
      console.log('Default pages initialized in database');
    } catch (error) {
      console.error('Error initializing default pages:', error);
    }
  };

  const fetchPages = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/site-config/pages`);
      if (!response.ok) throw new Error('Failed to fetch pages');
      const data = await response.json();
      
      if (data.length === 0) {
        // Database is empty, initialize with defaults
        await initializeDefaultPages();
        setPages(defaultPages);
      } else {
        setPages(data);
      }
    } catch (error) {
      console.error('Error fetching pages:', error);
      // Use default pages if API fails and try to initialize database
      setPages(defaultPages);
      await initializeDefaultPages();
    }
  };

  const fetchSavedConfigs = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/site-config/saved-configs`);
      if (!response.ok) throw new Error('Failed to fetch saved configs');
      const data = await response.json();
      setSavedConfigs(data);
    } catch (error) {
      console.error('Error fetching saved configs:', error);
      // Set empty array if API fails
      setSavedConfigs([]);
    }
  };

  const fetchPageConfig = async (path) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/site-config/pages/${encodeURIComponent(path)}`);
      if (!response.ok) throw new Error('Failed to fetch page config');
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching page config:', error);
      return null;
    }
  };

  const savePageToDatabase = async (pageData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/site-config/pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pageData)
      });
      if (!response.ok) throw new Error('Failed to save page');
      return await response.json();
    } catch (error) {
      console.error('Error saving page:', error);
      return null;
    }
  };

  const saveElementsToDatabase = async (pageId, elements) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/site-config/elements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId, elements })
      });
      if (!response.ok) throw new Error('Failed to save elements');
      return await response.json();
    } catch (error) {
      console.error('Error saving elements:', error);
      return null;
    }
  };

  const saveConfigToDatabase = async (configData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/site-config/saved-configs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configData)
      });
      if (!response.ok) throw new Error('Failed to save config');
      return await response.json();
    } catch (error) {
      console.error('Error saving config:', error);
      return null;
    }
  };

  const deleteConfigFromDatabase = async (configId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/site-config/saved-configs/${configId}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete config');
      return await response.json();
    } catch (error) {
      console.error('Error deleting config:', error);
      return null;
    }
  };

  // Navbar management functions
  const fetchNavbarConfig = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/site-config/navbar`);
      if (response.ok) {
        const data = await response.json();
        setNavbarConfig(data);
      }
    } catch (error) {
      console.error('Error fetching navbar config:', error);
    }
  };

  const saveNavbarConfig = async (config) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/site-config/navbar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (response.ok) {
        // Dispatch event to update navbar visibility
        window.dispatchEvent(new CustomEvent('navbarConfigUpdated', { detail: config }));
        return true;
      }
    } catch (error) {
      console.error('Error saving navbar config:', error);
    }
    return false;
  };

  const handleNavbarConfigChange = (section, key, value) => {
    setNavbarConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }));
  };

  // Default page configurations (fallback)
  const defaultPages = [
    {
      id: 'homepage',
      path: '/',
      name: 'Homepage',
      component: 'HomePageVer2',
      config: {
        displayType: 'video',
        video: {
          src: 'test.mp4',
          autoPlay: true,
          loop: true,
          muted: true,
          playsInline: true
        },
        text: {
          content: '',
          fontSize: '24px',
          fontFamily: 'Arial, sans-serif',
          color: '#ffffff',
          textAlign: 'center',
          margin: '20px',
          fontWeight: 'bold'
        },
        image: {
          src: '',
          alt: '',
          width: '100%',
          height: 'auto',
          margin: '0'
        },
                 layout: {
           backgroundColor: '#000000',
           padding: '20px',
           margin: '0'
         },
         contentBlocks: {},
         banner: {
           visible: true,
           title: 'Welcome to Petaria',
           background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
           textColor: '#ffffff',
           fontSize: '2.5rem',
           image: {
             src: '',
             position: 'center center',
             size: 'cover',
             repeat: 'no-repeat',
             opacity: 1
           },
           dimensions: {
             height: '400px',
             maxHeight: '600px',
             minHeight: '200px',
             heightUnit: 'px'
           },
           responsive: {
             mobile: { height: '250px' },
             tablet: { height: '350px' }
           }
         }
      }
    }
  ];

  useEffect(() => {
    const initializeData = async () => {
      setIsLoading(true);
      try {
        await Promise.all([
          fetchPages(),
          fetchSavedConfigs(),
          fetchNavbarConfig()
        ]);
      } catch (error) {
        console.error('Error initializing data:', error);
        // Use defaults if API completely fails
        setPages(defaultPages);
        setSavedConfigs([]);
      } finally {
        setIsLoading(false);
      }
    };

    initializeData();
  }, []);

  useEffect(() => {
    if (activeTab !== 'pages') return;
    const home = pages.find(p => p.path === '/') || defaultPages[0];
    if (home && (!selectedPage || selectedPage.path !== '/')) {
      handlePageSelect(home);
    }
  }, [activeTab, pages]);

  const handlePageSelect = async (page) => {
    setSelectedPage(page);
    const rawConfig = page.config;
    const config = typeof rawConfig === 'string' ? (() => { try { return JSON.parse(rawConfig); } catch { return {}; } })() : (rawConfig || {});
    if (page.path === '/' && (!config.contentBlocks || typeof config.contentBlocks !== 'object')) {
      config.contentBlocks = { ...getDefaultContentBlocks() };
    } else if (page.path === '/' && config.contentBlocks) {
      const defaults = getDefaultContentBlocks();
      config.contentBlocks = CONTENT_BLOCK_KEYS.reduce((acc, key) => ({
        ...acc,
        [key]: config.contentBlocks[key] ? { ...defaults[key], ...config.contentBlocks[key] } : defaults[key]
      }), {});
    }
    setCurrentConfig({ ...config });
    setIsEditing(false);
    
    // Fetch custom elements for this page
    try {
      const pageData = await fetchPageConfig(page.path);
      if (pageData && pageData.customElements) {
        setCustomElements(pageData.customElements);
      } else {
        setCustomElements([]);
      }
    } catch (error) {
      console.error('Error fetching page elements:', error);
      setCustomElements([]);
    }
  };

  const handleEditPage = () => {
    // Ensure currentConfig is properly set before editing
    if (selectedPage && selectedPage.config) {
      setCurrentConfig({ ...selectedPage.config });
    }
    setEditingConfigId(null); // Reset editing config ID when starting fresh edit
    setIsEditing(true);
  };

  const handleSaveAsDefault = () => {
    const blocks = currentConfig?.contentBlocks && typeof currentConfig.contentBlocks === 'object'
      ? currentConfig.contentBlocks
      : {};
    try {
      localStorage.setItem(DEFAULT_CONTENT_BLOCKS_STORAGE_KEY, JSON.stringify(blocks));
      alert('Đã lưu nội dung hiện tại làm mặc định. Các lần mở trang chủ sau sẽ dùng bản mặc định này nếu chưa có cấu hình lưu.');
    } catch (e) {
      alert('Không thể lưu mặc định.');
    }
  };

  const handleSavePage = async () => {
    if (!selectedPage || !currentConfig) {
      alert('Không có page được chọn hoặc config không hợp lệ!');
      return;
    }
    
    if (!selectedPage.id) {
      alert('Page ID không hợp lệ!');
      console.error('selectedPage:', selectedPage);
      return;
    }

    if (editingConfigId) {
      // UPDATE existing config
      const existingConfig = savedConfigs.find(config => config.id === editingConfigId);
      if (!existingConfig) {
        alert('Không tìm thấy config để cập nhật!');
        return;
      }

      try {
        const configData = {
          ...existingConfig,
          pageId: existingConfig.pageId || selectedPage?.id || 'homepage', // Ensure pageId is valid
          config: { ...currentConfig },
          customElements: [...customElements]
        };
        
        const saveResult = await saveConfigToDatabase(configData);
        
        if (saveResult) {
          // Update local saved configs state
          const updatedSavedConfigs = savedConfigs.map(config => 
            config.id === editingConfigId ? configData : config
          );
          setSavedConfigs(updatedSavedConfigs);
          
          setIsEditing(false);
          setEditingConfigId(null);
          
          alert(`Đã cập nhật cấu hình "${existingConfig.name}" thành công!`);
        } else {
          throw new Error('Database save failed');
        }
      } catch (error) {
        console.error('Error updating config:', error);
        alert('Lỗi khi cập nhật config! Vui lòng thử lại.');
      }
    } else {
      // CREATE new config
      const configName = prompt(`Nhập tên cho cấu hình mới:\n\nConfig hiện tại: ${currentConfig?.displayType || 'Unknown'}\nElements: ${customElements.length} items`);
      if (!configName) return;

      try {
        const configData = {
          id: Date.now().toString(),
          name: configName,
          pageId: selectedPage?.id || 'homepage', // Default to homepage if no page selected
          config: { ...currentConfig },
          customElements: [...customElements]
        };
        
        const saveResult = await saveConfigToDatabase(configData);
        
        if (saveResult) {
          // Update local saved configs state
          const updatedSavedConfigs = [...savedConfigs, configData];
          setSavedConfigs(updatedSavedConfigs);
          
          setIsEditing(false);
          
          alert(`Đã tạo cấu hình "${configName}" thành công!`);
        } else {
          throw new Error('Database save failed');
        }
      } catch (error) {
        console.error('Error creating config:', error);
        alert('Lỗi khi tạo config! Vui lòng thử lại.');
      }
    }
  };

  const handleCancelEdit = () => {
    setCurrentConfig({ ...selectedPage.config });
    setIsEditing(false);
    setEditingConfigId(null); // Reset editing config ID when canceling
  };



  const handleConfigChange = (section, key, value) => {
    setCurrentConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }));
  };

  const handleDisplayTypeChange = (type) => {
    setCurrentConfig(prev => ({
      ...prev,
      displayType: type
    }));
  };



  const saveCurrentConfig = async () => {
    if (!currentConfig) return;
    
    const configName = prompt('Nhập tên cho cấu hình này:');
    if (!configName) return;
    
    try {
      const configData = {
        id: Date.now().toString(),
        name: configName,
        pageId: selectedPage.id,
        config: { ...currentConfig },
        customElements: [...customElements]
      };
      
      const saveResult = await saveConfigToDatabase(configData);
      
      if (saveResult) {
        // Update local state
        const updatedSavedConfigs = [...savedConfigs, configData];
        setSavedConfigs(updatedSavedConfigs);
        alert(`Đã lưu cấu hình "${configName}" vào database!`);
      } else {
        throw new Error('Database save failed');
      }
    } catch (error) {
      console.error('Error saving config:', error);
      alert('Lỗi khi lưu config! Vui lòng thử lại.');
    }
  };

  const applyConfigDirectly = async (savedConfig) => {
    if (window.confirm(`Bạn có muốn áp dụng cấu hình "${savedConfig.name}" vào page này?`)) {
      try {
        if (!selectedPage || !selectedPage.id) {
          alert('Vui lòng chọn một page trước khi áp dụng config!');
          return;
        }

        // Apply config directly to the page without loading into editor
        const pageData = {
          id: selectedPage.id,
          path: selectedPage.path,
          name: selectedPage.name,
          component: selectedPage.component,
          config: savedConfig.config
        };
        const saveResult = await savePageToDatabase(pageData);
        
        if (saveResult) {
          // Always save custom elements (even if empty array to replace old ones)
          await saveElementsToDatabase(selectedPage.id, savedConfig.customElements || []);
        } else {
          throw new Error('Database save failed');
        }

        // Trigger page refresh
        window.dispatchEvent(new CustomEvent('configUpdated'));
        alert(`Đã áp dụng cấu hình "${savedConfig.name}" vào page thành công!`);
        
      } catch (error) {
        console.error('Error applying config directly:', error);
        alert('Lỗi khi áp dụng config! Vui lòng thử lại.');
      }
    }
  };

  const loadSavedConfig = async (savedConfig) => {
    if (window.confirm(`Bạn có muốn load cấu hình "${savedConfig.name}" để chỉnh sửa?`)) {
      try {
        // Ensure we have a valid selectedPage
        if (!selectedPage || !selectedPage.id) {
          alert('Vui lòng chọn một page trước khi load config!');
          return;
        }
        
        // Update current config (only for editing, not applying to page)
        setCurrentConfig({ ...savedConfig.config });
        
        // Try to fetch fresh data from database first
        try {
          const response = await fetch(`${API_BASE_URL}/api/site-config/saved-configs`);
          if (response.ok) {
            const allConfigs = await response.json();
            const freshConfig = allConfigs.find(config => config.id === savedConfig.id);
            
            if (freshConfig && freshConfig.customElements) {
              setCustomElements(freshConfig.customElements);
            } else if (savedConfig.customElements) {
              setCustomElements(savedConfig.customElements);
            } else {
              setCustomElements([]);
            }
          } else {
            // Fallback to savedConfig if database fetch fails
            if (savedConfig.customElements) {
              setCustomElements(savedConfig.customElements);
            } else {
              setCustomElements([]);
            }
          }
        } catch (fetchError) {
          console.error('Error fetching fresh config from database:', fetchError);
          // Fallback to savedConfig
          if (savedConfig.customElements) {
            setCustomElements(savedConfig.customElements);
          } else {
            setCustomElements([]);
          }
        }
        
        // Set the editing config ID to track which config is being edited
        setEditingConfigId(savedConfig.id);
        
        // Auto-enter edit mode when loading a saved config
        setIsEditing(true);
        
        alert(`Đã load cấu hình "${savedConfig.name}" để chỉnh sửa! Bạn có thể chỉnh sửa và sau đó click "Áp dụng vào Page" để áp dụng thay đổi.`);
      } catch (error) {
        console.error('Error loading saved config:', error);
        alert('Lỗi khi load config! Vui lòng thử lại.');
      }
    }
  };



  const renameSavedConfig = async (savedConfig) => {
    const newName = prompt(`Nhập tên mới cho cấu hình:\n\nTên hiện tại: "${savedConfig.name}"`, savedConfig.name);
    if (!newName || newName === savedConfig.name) return;

    try {
      const configData = {
        id: savedConfig.id,
        name: newName,
        pageId: savedConfig.page_id,
        config: savedConfig.config,
        customElements: savedConfig.customElements
      };
      
      const saveResult = await saveConfigToDatabase(configData);
      
      if (saveResult) {
        // Update local saved configs state
        const updatedSavedConfigs = savedConfigs.map(config => 
          config.id === savedConfig.id ? { ...config, name: newName } : config
        );
        setSavedConfigs(updatedSavedConfigs);
        alert(`Đã đổi tên cấu hình thành "${newName}" thành công!`);
      } else {
        throw new Error('Database save failed');
      }
    } catch (error) {
      console.error('Error renaming config:', error);
      alert('Lỗi khi đổi tên config! Vui lòng thử lại.');
    }
  };

  const deleteSavedConfig = async (configId) => {
    if (window.confirm('Bạn có chắc muốn xóa cấu hình này?')) {
      try {
        const deleteResult = await deleteConfigFromDatabase(configId);
        
        if (deleteResult) {
          // Update local state
          const updatedSavedConfigs = savedConfigs.filter(config => config.id !== configId);
          setSavedConfigs(updatedSavedConfigs);
          alert('Đã xóa cấu hình khỏi database!');
        } else {
          throw new Error('Database delete failed');
        }
      } catch (error) {
        console.error('Error deleting config:', error);
        alert('Lỗi khi xóa config! Vui lòng thử lại.');
      }
    }
  };

  // Element Management Functions
  const addCustomElement = (elementType) => {
    // Validate element type
    const validTypes = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'div', 'img'];
    const safeType = validTypes.includes(elementType) ? elementType : 'div';
    
    const newElement = {
      id: Date.now().toString(),
      type: safeType,
      content: safeType === 'img' ? '' : 'New Element',
      styles: {
        color: '#333333',
        fontSize: '16px',
        fontFamily: 'Arial, sans-serif',
        fontWeight: 'normal',
        textAlign: 'left',
        marginTop: '10px',
        marginRight: '10px',
        marginBottom: '10px',
        marginLeft: '10px',
        width: safeType === 'img' ? '200px' : 'auto',
        height: safeType === 'img' ? 'auto' : 'auto'
      },
      imageSrc: safeType === 'img' ? '' : '',
      imageAlt: safeType === 'img' ? 'Image' : ''
    };
    
    setCustomElements(prev => [...prev, newElement]);
  };

  const updateCustomElement = (elementId, updates) => {
    setCustomElements(prev => 
      prev.map(element => 
        element.id === elementId 
          ? { ...element, ...updates }
          : element
      )
    );
  };

  const deleteCustomElement = (elementId) => {
    if (window.confirm('Bạn có chắc muốn xóa element này?')) {
      setCustomElements(prev => prev.filter(element => element.id !== elementId));
    }
  };

  const moveElement = (elementId, direction) => {
    setCustomElements(prev => {
      const currentIndex = prev.findIndex(element => element.id === elementId);
      if (currentIndex === -1) return prev;
      
      const newElements = [...prev];
      if (direction === 'up' && currentIndex > 0) {
        [newElements[currentIndex], newElements[currentIndex - 1]] = 
        [newElements[currentIndex - 1], newElements[currentIndex]];
      } else if (direction === 'down' && currentIndex < newElements.length - 1) {
        [newElements[currentIndex], newElements[currentIndex + 1]] = 
        [newElements[currentIndex + 1], newElements[currentIndex]];
      }
      
      return newElements;
    });
  };

  if (isLoading) {
    return (
      <div className="site-management">
        <div className="site-management-header">
          <h1>Quản lý Site</h1>
          <button className="back-btn" onClick={() => navigate('/admin')}>
            ← Quay lại Admin Panel
          </button>
        </div>
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <p>Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="site-management">
      <div className="site-management-header">
        <h1>Quản lý Site</h1>
        <button className="back-btn" onClick={() => navigate('/admin')}>
          ← Quay lại Admin Panel
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="management-tabs">
        <button 
          className={`tab-btn ${activeTab === 'pages' ? 'active' : ''}`}
          onClick={() => setActiveTab('pages')}
        >
          📄 Quản lý Home Page
        </button>
        <button 
          className={`tab-btn ${activeTab === 'navbar' ? 'active' : ''}`}
          onClick={() => setActiveTab('navbar')}
        >
          🧭 Quản lý Navbar
        </button>
      </div>

      {activeTab === 'pages' && (
        <div className="site-management-content">
        {selectedPage && (
          <div className="page-editor">
            <div className="editor-header">
              <div className="editor-header-info">
                <h2>Chỉnh sửa: Homepage</h2>
                <p className="editor-component-info">Component: HomePageVer2.js</p>
              </div>
              <div className="editor-actions">
                {!isEditing ? (
                  <button className="edit-btn" onClick={handleEditPage}>
                    Chỉnh sửa
                  </button>
                ) : (
                  <>
                    <button className="save-btn" onClick={handleSavePage}>
                       {editingConfigId ? 'Cập nhật Config' : 'Lưu Config'}
                     </button>
                    <button className="cancel-btn" onClick={handleCancelEdit}>
                      Hủy
                    </button>
                    <button className="save-config-btn" onClick={saveCurrentConfig}>
                      Tạo Config
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="editor-content">
              <div className="config-section">
                <h3>Loại hiển thị</h3>
                <select 
                  value={currentConfig?.displayType || 'video'}
                  onChange={(e) => handleDisplayTypeChange(e.target.value)}
                  disabled={!isEditing}
                >
                  <option value="video">Video</option>
                  <option value="text">Text</option>
                  <option value="image">Image</option>
                  <option value="mixed">Mixed (Video + Text)</option>
                </select>
              </div>

              {/* Saved Configurations Section */}
              {savedConfigs.length > 0 && (
                <div className="config-section saved-configs-section">
                  <h3>Cấu hình đã lưu</h3>
                  <div className="saved-configs-grid">
                    {savedConfigs.map(savedConfig => (
                      <div key={savedConfig.id} className="saved-config-card">
                        <div className="saved-config-info">
                          <div className="config-name-row">
                            <h4>{savedConfig.name}</h4>
                            <button 
                              className="rename-icon-btn"
                              onClick={() => renameSavedConfig(savedConfig)}
                              title="Đổi tên cấu hình này"
                            >
                              ✏️
                            </button>
                          </div>
                          <p>Loại: {savedConfig.config.displayType}</p>
                          <p>Trang: {savedConfig.page_name || savedConfig.pageType || 'Unknown'}</p>
                          <p className="saved-config-date">
                            {(() => {
                              const dateValue = savedConfig.createdAt || savedConfig.created_at;
                              if (!dateValue) return 'Không có ngày';
                              
                              const date = new Date(dateValue);
                              if (isNaN(date.getTime())) return 'Ngày không hợp lệ';
                              
                              return date.toLocaleDateString('vi-VN');
                            })()}
                          </p>
                        </div>
                        <div className="config-apply-section">
                          <button 
                            className="apply-config-btn"
                            onClick={() => applyConfigDirectly(savedConfig)}
                            title="Áp dụng cấu hình này vào page"
                          >
                            Áp dụng vào Page
                          </button>
                        </div>
                        <div className="saved-config-actions">
                          <button 
                            className="edit-config-btn"
                            onClick={() => loadSavedConfig(savedConfig)}
                            title="Chỉnh sửa cấu hình này"
                          >
                            Chỉnh sửa
                          </button>
                          <button 
                            className="delete-config-btn"
                            onClick={() => deleteSavedConfig(savedConfig.id)}
                            title="Xóa cấu hình này"
                          >
                            Xóa
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {currentConfig?.displayType === 'video' && (
                <div className="config-section">
                  <h3>Cấu hình Video</h3>
                  <div className="config-row">
                    <label>Video Source:</label>
                    <input
                      type="text"
                      value={currentConfig.video?.src || ''}
                      onChange={(e) => handleConfigChange('video', 'src', e.target.value)}
                      disabled={!isEditing}
                      placeholder="test.mp4"
                    />
                  </div>
                  <div className="config-row">
                    <label>
                      <input
                        type="checkbox"
                        checked={currentConfig.video?.autoPlay || false}
                        onChange={(e) => handleConfigChange('video', 'autoPlay', e.target.checked)}
                        disabled={!isEditing}
                      />
                      Tự động phát
                    </label>
                  </div>
                  <div className="config-row">
                    <label>
                      <input
                        type="checkbox"
                        checked={currentConfig.video?.loop || false}
                        onChange={(e) => handleConfigChange('video', 'loop', e.target.checked)}
                        disabled={!isEditing}
                      />
                      Lặp lại
                    </label>
                  </div>
                  <div className="config-row">
                    <label>
                      <input
                        type="checkbox"
                        checked={currentConfig.video?.muted || false}
                        onChange={(e) => handleConfigChange('video', 'muted', e.target.checked)}
                        disabled={!isEditing}
                      />
                      Tắt âm
                    </label>
                  </div>
                </div>
              )}

              {/* Text configuration removed - use Custom Elements instead */}

              {currentConfig?.displayType === 'image' && (
                <div className="config-section">
                  <h3>Cấu hình Image</h3>
                  <div className="config-row">
                    <label>Image Source:</label>
                    <input
                      type="text"
                      value={currentConfig.image?.src || ''}
                      onChange={(e) => handleConfigChange('image', 'src', e.target.value)}
                      disabled={!isEditing}
                      placeholder="/images/background.jpg"
                    />
                  </div>
                  <div className="config-row">
                    <label>Alt text:</label>
                    <input
                      type="text"
                      value={currentConfig.image?.alt || ''}
                      onChange={(e) => handleConfigChange('image', 'alt', e.target.value)}
                      disabled={!isEditing}
                      placeholder="Background image"
                    />
                  </div>
                  <div className="config-row">
                    <label>Width:</label>
                    <input
                      type="text"
                      value={currentConfig.image?.width || '100%'}
                      onChange={(e) => handleConfigChange('image', 'width', e.target.value)}
                      disabled={!isEditing}
                      placeholder="100%"
                    />
                  </div>
                  <div className="config-row">
                    <label>Height:</label>
                    <input
                      type="text"
                      value={currentConfig.image?.height || 'auto'}
                      onChange={(e) => handleConfigChange('image', 'height', e.target.value)}
                      disabled={!isEditing}
                      placeholder="auto"
                    />
                  </div>
                  <div className="config-row">
                    <label>Margin:</label>
                    <input
                      type="text"
                      value={currentConfig.image?.margin || '0'}
                      onChange={(e) => handleConfigChange('image', 'margin', e.target.value)}
                      disabled={!isEditing}
                      placeholder="0"
                    />
                  </div>
                </div>
              )}

              {/* Cấu hình Layout - collapsible */}
              <div className="config-section config-section-collapsible">
                <button type="button" className="config-section-toggle" onClick={() => setLayoutCollapsed(!layoutCollapsed)} aria-expanded={!layoutCollapsed}>
                  <span className="config-section-toggle-icon">{layoutCollapsed ? '▶' : '▼'}</span>
                  <h3>Cấu hình Layout</h3>
                </button>
                {!layoutCollapsed && (
                  <div className="config-section-body">
                    <div className="config-row">
                      <label>Background color:</label>
                      <input type="color" value={currentConfig.layout?.backgroundColor || '#000000'} onChange={(e) => handleConfigChange('layout', 'backgroundColor', e.target.value)} disabled={!isEditing} />
                    </div>
                    <div className="config-row">
                      <label>Padding:</label>
                      <input type="text" value={currentConfig.layout?.padding || '20px'} onChange={(e) => handleConfigChange('layout', 'padding', e.target.value)} disabled={!isEditing} placeholder="20px" />
                    </div>
                    <div className="config-row">
                      <label>Margin:</label>
                      <input type="text" value={currentConfig.layout?.margin || '0'} onChange={(e) => handleConfigChange('layout', 'margin', e.target.value)} disabled={!isEditing} placeholder="0" />
                    </div>
                  </div>
                )}
              </div>

              {/* Banner Configuration - collapsible */}
                <div className="config-section config-section-collapsible">
                  <button type="button" className="config-section-toggle" onClick={() => setBannerCollapsed(!bannerCollapsed)} aria-expanded={!bannerCollapsed}>
                    <span className="config-section-toggle-icon">{bannerCollapsed ? '▶' : '▼'}</span>
                    <h3>Cấu hình Banner</h3>
                  </button>
                {!bannerCollapsed && (
                <div className="config-section-body">
                  <div className="config-row">
                    <label>
                      <input
                        type="checkbox"
                        checked={currentConfig.banner?.visible !== false}
                        onChange={(e) => handleConfigChange('banner', 'visible', e.target.checked)}
                        disabled={!isEditing}
                      />
                      Hiển thị Banner
                    </label>
                  </div>
                  <div className="config-row">
                    <label>Banner Title:</label>
                    <input
                      type="text"
                      value={currentConfig.banner?.title || 'Welcome to Petaria'}
                      onChange={(e) => handleConfigChange('banner', 'title', e.target.value)}
                      disabled={!isEditing}
                      placeholder="Welcome to Petaria"
                    />
                  </div>
                  <div className="config-row">
                    <label>Banner Background:</label>
                    <input
                      type="text"
                      value={currentConfig.banner?.background || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}
                      onChange={(e) => handleConfigChange('banner', 'background', e.target.value)}
                      disabled={!isEditing}
                      placeholder="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                    />
                  </div>
                  <div className="config-row">
                    <label>Banner Text Color:</label>
                    <input
                      type="color"
                      value={currentConfig.banner?.textColor || '#ffffff'}
                      onChange={(e) => handleConfigChange('banner', 'textColor', e.target.value)}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="config-row">
                    <label>Banner Font Size:</label>
                    <input
                      type="text"
                      value={currentConfig.banner?.fontSize || '2.5rem'}
                      onChange={(e) => handleConfigChange('banner', 'fontSize', e.target.value)}
                      disabled={!isEditing}
                      placeholder="2.5rem"
                    />
                  </div>
                  
                  <h4>Banner Image</h4>
                  <div className="config-row">
                    <label>Image URL:</label>
                    <input
                      type="text"
                      value={currentConfig.banner?.image?.src || ''}
                      onChange={(e) => handleConfigChange('banner', 'image', { ...currentConfig.banner?.image, src: e.target.value })}
                      disabled={!isEditing}
                      placeholder="/images/background/banner.jpeg"
                    />
                    <small style={{ color: '#666', fontSize: '0.8rem', marginTop: '4px' }}>
                      Ví dụ: /images/background/banner.jpeg, @/public/images/banner.jpeg, hoặc https://example.com/image.jpg
                    </small>
                  </div>
                  <div className="config-row">
                    <label>Position:</label>
                    <select
                      value={currentConfig.banner?.image?.position || 'center center'}
                      onChange={(e) => handleConfigChange('banner', 'image', { ...currentConfig.banner?.image, position: e.target.value })}
                      disabled={!isEditing}
                    >
                      <option value="center center">Center Center</option>
                      <option value="top left">Top Left</option>
                      <option value="top center">Top Center</option>
                      <option value="top right">Top Right</option>
                      <option value="center left">Center Left</option>
                      <option value="center right">Center Right</option>
                      <option value="bottom left">Bottom Left</option>
                      <option value="bottom center">Bottom Center</option>
                      <option value="bottom right">Bottom Right</option>
                    </select>
                  </div>
                  <div className="config-row">
                    <label>Size:</label>
                    <select
                      value={currentConfig.banner?.image?.size || 'cover'}
                      onChange={(e) => handleConfigChange('banner', 'image', { ...currentConfig.banner?.image, size: e.target.value })}
                      disabled={!isEditing}
                    >
                      <option value="cover">Cover</option>
                      <option value="contain">Contain</option>
                      <option value="auto">Auto</option>
                      <option value="100% 100%">Stretch</option>
                    </select>
                  </div>
                  <div className="config-row">
                    <label>Repeat:</label>
                    <select
                      value={currentConfig.banner?.image?.repeat || 'no-repeat'}
                      onChange={(e) => handleConfigChange('banner', 'image', { ...currentConfig.banner?.image, repeat: e.target.value })}
                      disabled={!isEditing}
                    >
                      <option value="no-repeat">No Repeat</option>
                      <option value="repeat">Repeat</option>
                      <option value="repeat-x">Repeat X</option>
                      <option value="repeat-y">Repeat Y</option>
                    </select>
                  </div>
                  <div className="config-row">
                    <label>Opacity:</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={currentConfig.banner?.image?.opacity || 1}
                      onChange={(e) => handleConfigChange('banner', 'image', { ...currentConfig.banner?.image, opacity: parseFloat(e.target.value) })}
                      disabled={!isEditing}
                    />
                    <span>{currentConfig.banner?.image?.opacity || 1}</span>
                  </div>
                  
                  <h4>Banner Dimensions</h4>
                  <div className="config-row">
                    <label>Height (Desktop):</label>
                    <input
                      type="text"
                      value={currentConfig.banner?.dimensions?.height || '400px'}
                      onChange={(e) => handleConfigChange('banner', 'dimensions', { ...currentConfig.banner?.dimensions, height: e.target.value })}
                      disabled={!isEditing}
                      placeholder="400px"
                    />
                    <select
                      value={currentConfig.banner?.dimensions?.heightUnit || 'px'}
                      onChange={(e) => handleConfigChange('banner', 'dimensions', { ...currentConfig.banner?.dimensions, heightUnit: e.target.value })}
                      disabled={!isEditing}
                      style={{ marginLeft: '8px', minWidth: '80px' }}
                    >
                      <option value="px">px</option>
                      <option value="vh">vh</option>
                      <option value="dvh">dvh</option>
                      <option value="%">%</option>
                      <option value="rem">rem</option>
                    </select>
                  </div>
                  <div className="config-row">
                    <label>Max Height:</label>
                    <input
                      type="text"
                      value={currentConfig.banner?.dimensions?.maxHeight || '600px'}
                      onChange={(e) => handleConfigChange('banner', 'dimensions', { ...currentConfig.banner?.dimensions, maxHeight: e.target.value })}
                      disabled={!isEditing}
                      placeholder="600px"
                    />
                  </div>
                  <div className="config-row">
                    <label>Min Height:</label>
                    <input
                      type="text"
                      value={currentConfig.banner?.dimensions?.minHeight || '200px'}
                      onChange={(e) => handleConfigChange('banner', 'dimensions', { ...currentConfig.banner?.dimensions, minHeight: e.target.value })}
                      disabled={!isEditing}
                      placeholder="200px"
                    />
                  </div>
                  
                  <h4>Responsive Settings</h4>
                  <div className="config-row">
                    <label>Mobile Height:</label>
                    <input
                      type="text"
                      value={currentConfig.banner?.responsive?.mobile?.height || '250px'}
                      onChange={(e) => handleConfigChange('banner', 'responsive', { 
                        ...currentConfig.banner?.responsive, 
                        mobile: { ...currentConfig.banner?.responsive?.mobile, height: e.target.value }
                      })}
                      disabled={!isEditing}
                      placeholder="250px"
                    />
                  </div>
                  <div className="config-row">
                    <label>Tablet Height:</label>
                    <input
                      type="text"
                      value={currentConfig.banner?.responsive?.tablet?.height || '350px'}
                      onChange={(e) => handleConfigChange('banner', 'responsive', { 
                        ...currentConfig.banner?.responsive, 
                        tablet: { ...currentConfig.banner?.responsive?.tablet, height: e.target.value }
                      })}
                      disabled={!isEditing}
                      placeholder="350px"
                    />
                  </div>
                  
                  <h4>Quick Presets</h4>
                  <div className="config-row">
                    <label>Size Preset:</label>
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          const presets = {
                            'small': { height: '200px', maxHeight: '300px', minHeight: '150px', mobile: '150px', tablet: '180px' },
                            'medium': { height: '400px', maxHeight: '600px', minHeight: '200px', mobile: '250px', tablet: '350px' },
                            'large': { height: '600px', maxHeight: '800px', minHeight: '300px', mobile: '350px', tablet: '500px' },
                            'fullscreen': { height: '100vh', maxHeight: 'none', minHeight: '300px', mobile: '70vh', tablet: '80vh' }
                          };
                          const preset = presets[e.target.value];
                          if (preset) {
                            handleConfigChange('banner', 'dimensions', {
                              height: preset.height,
                              maxHeight: preset.maxHeight,
                              minHeight: preset.minHeight
                            });
                            handleConfigChange('banner', 'responsive', {
                              mobile: { height: preset.mobile },
                              tablet: { height: preset.tablet }
                            });
                          }
                          e.target.value = '';
                        }
                      }}
                      disabled={!isEditing}
                    >
                      <option value="">Choose preset...</option>
                      <option value="small">Small (200px)</option>
                      <option value="medium">Medium (400px)</option>
                      <option value="large">Large (600px)</option>
                      <option value="fullscreen">Fullscreen (100vh)</option>
                    </select>
                  </div>
                  
                  <h4>Preview Banner</h4>
                  <div className="banner-preview">
                    <div 
                      className="preview-banner"
                      style={{
                        ...(currentConfig?.banner?.image?.src ? {
                          backgroundImage: `url(${currentConfig.banner.image.src})`,
                          backgroundPosition: currentConfig.banner.image.position || 'center center',
                          backgroundSize: currentConfig.banner.image.size || 'cover',
                          backgroundRepeat: currentConfig.banner.image.repeat || 'no-repeat'
                        } : {
                          background: currentConfig?.banner?.background || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                        }),
                        opacity: currentConfig?.banner?.image?.opacity || 1,
                        height: currentConfig?.banner?.dimensions?.height || '400px',
                        maxHeight: currentConfig?.banner?.dimensions?.maxHeight || '600px',
                        minHeight: currentConfig?.banner?.dimensions?.minHeight || '200px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        marginTop: '10px'
                      }}
                    >
                      <div style={{
                        textAlign: 'center',
                        padding: '20px'
                      }}>
                        <h2 style={{
                          color: currentConfig?.banner?.textColor || '#ffffff',
                          fontSize: currentConfig?.banner?.fontSize || '2.5rem',
                          margin: 0,
                          textShadow: '2px 2px 4px rgba(0,0,0,0.5)'
                        }}>
                          {currentConfig?.banner?.title || 'Welcome to Petaria'}
                        </h2>
                      </div>
                    </div>
                    <div className="preview-info">
                      <small style={{ color: '#666', fontSize: '0.8rem' }}>
                        Desktop: {currentConfig?.banner?.dimensions?.height || '400px'} | 
                        Tablet: {currentConfig?.banner?.responsive?.tablet?.height || '350px'} | 
                        Mobile: {currentConfig?.banner?.responsive?.mobile?.height || '250px'}
                      </small>
                    </div>
                  </div>
                </div>
                )}
                </div>

              {/* Custom Elements Management - collapsible */}
              <div className="config-section config-section-collapsible custom-elements-section">
                <button type="button" className="config-section-toggle" onClick={() => setElementsCollapsed(!elementsCollapsed)} aria-expanded={!elementsCollapsed}>
                  <span className="config-section-toggle-icon">{elementsCollapsed ? '▶' : '▼'}</span>
                  <h3>Quản lý Elements</h3>
                </button>
                {!elementsCollapsed && (
                  <div className="config-section-body">
                    <div className="add-elements-buttons">
                  <button 
                    className="add-element-btn"
                    onClick={() => addCustomElement('h1')}
                    disabled={!isEditing}
                  >
                    + H1
                  </button>
                  <button 
                    className="add-element-btn"
                    onClick={() => addCustomElement('h2')}
                    disabled={!isEditing}
                  >
                    + H2
                  </button>
                  <button 
                    className="add-element-btn"
                    onClick={() => addCustomElement('p')}
                    disabled={!isEditing}
                  >
                    + P
                  </button>
                  <button 
                    className="add-element-btn"
                    onClick={() => addCustomElement('img')}
                    disabled={!isEditing}
                  >
                    + Image
                  </button>
                </div>

                {customElements.length > 0 && (
                  <div className="custom-elements-list">
                    {customElements.map((element, index) => {
                      const cardCollapsed = elementCardCollapsed[element.id] !== false; // default collapsed
                      const setCardCollapsed = (v) => setElementCardCollapsed(prev => ({ ...prev, [element.id]: v }));
                      return (
                      <div key={element.id} className="custom-element-card config-section-collapsible">
                        <button
                          type="button"
                          className="config-section-toggle element-card-toggle"
                          onClick={() => setCardCollapsed(!cardCollapsed)}
                          aria-expanded={!cardCollapsed}
                        >
                          <span className="config-section-toggle-icon">{cardCollapsed ? '▶' : '▼'}</span>
                          <h4>{(element.type || 'div').toUpperCase()} Element</h4>
                          <div className="element-actions" onClick={(e) => e.stopPropagation()}>
                            <button 
                              className="move-element-btn"
                              onClick={() => moveElement(element.id, 'up')}
                              disabled={index === 0}
                              title="Di chuyển lên"
                            >
                              ↑
                            </button>
                            <button 
                              className="move-element-btn"
                              onClick={() => moveElement(element.id, 'down')}
                              disabled={index === customElements.length - 1}
                              title="Di chuyển xuống"
                            >
                              ↓
                            </button>
                            <button 
                              className="delete-element-btn"
                              onClick={() => deleteCustomElement(element.id)}
                              title="Xóa element"
                            >
                              ×
                            </button>
                          </div>
                        </button>

                        {!cardCollapsed && (
                        <div className="element-content config-section-body">
                           {(element.type || 'div') === 'img' ? (
                             <div className="element-config-row">
                               <label>Image Source:</label>
                               <input
                                 type="text"
                                 value={element.imageSrc || ''}
                                 onChange={(e) => updateCustomElement(element.id, { imageSrc: e.target.value })}
                                 disabled={!isEditing}
                                 placeholder="/images/example.jpg"
                               />
                             </div>
                           ) : (
                             <div className="element-config-row">
                               <label>Content:</label>
                               <textarea
                                 value={element.content || ''}
                                 onChange={(e) => updateCustomElement(element.id, { content: e.target.value })}
                                 disabled={!isEditing}
                                 rows="2"
                                 placeholder="Nhập nội dung..."
                               />
                             </div>
                           )}

                          <div className="element-styles">
                            <div className="style-row">
                              <label>Color:</label>
                              <input
                                type="color"
                                value={element.styles.color}
                                onChange={(e) => updateCustomElement(element.id, { 
                                  styles: { ...element.styles, color: e.target.value }
                                })}
                                disabled={!isEditing}
                              />
                              <label>Font Size:</label>
                              <input
                                type="text"
                                value={element.styles.fontSize}
                                onChange={(e) => updateCustomElement(element.id, { 
                                  styles: { ...element.styles, fontSize: e.target.value }
                                })}
                                disabled={!isEditing}
                                placeholder="16px"
                              />
                            </div>

                            <div className="style-row">
                              <label>Font Weight:</label>
                              <select
                                value={element.styles.fontWeight}
                                onChange={(e) => updateCustomElement(element.id, { 
                                  styles: { ...element.styles, fontWeight: e.target.value }
                                })}
                                disabled={!isEditing}
                              >
                                <option value="normal">Normal</option>
                                <option value="bold">Bold</option>
                                <option value="bolder">Bolder</option>
                                <option value="lighter">Lighter</option>
                              </select>
                              <label>Text Align:</label>
                              <select
                                value={element.styles.textAlign}
                                onChange={(e) => updateCustomElement(element.id, { 
                                  styles: { ...element.styles, textAlign: e.target.value }
                                })}
                                disabled={!isEditing}
                              >
                                <option value="left">Left</option>
                                <option value="center">Center</option>
                                <option value="right">Right</option>
                                <option value="justify">Justify</option>
                              </select>
                            </div>

                            <div className="style-row">
                              <label>Margin Top:</label>
                              <input
                                type="text"
                                value={element.styles.marginTop}
                                onChange={(e) => updateCustomElement(element.id, { 
                                  styles: { ...element.styles, marginTop: e.target.value }
                                })}
                                disabled={!isEditing}
                                placeholder="10px"
                              />
                              <label>Margin Right:</label>
                              <input
                                type="text"
                                value={element.styles.marginRight}
                                onChange={(e) => updateCustomElement(element.id, { 
                                  styles: { ...element.styles, marginRight: e.target.value }
                                })}
                                disabled={!isEditing}
                                placeholder="10px"
                              />
                            </div>

                            <div className="style-row">
                              <label>Margin Bottom:</label>
                              <input
                                type="text"
                                value={element.styles.marginBottom}
                                onChange={(e) => updateCustomElement(element.id, { 
                                  styles: { ...element.styles, marginBottom: e.target.value }
                                })}
                                disabled={!isEditing}
                                placeholder="10px"
                              />
                              <label>Margin Left:</label>
                              <input
                                type="text"
                                value={element.styles.marginLeft}
                                onChange={(e) => updateCustomElement(element.id, { 
                                  styles: { ...element.styles, marginLeft: e.target.value }
                                })}
                                disabled={!isEditing}
                                placeholder="10px"
                              />
                            </div>

                                                         {(element.type || 'div') === 'img' && (
                               <div className="style-row">
                                 <label>Width:</label>
                                 <input
                                   type="text"
                                   value={element.styles?.width || '200px'}
                                   onChange={(e) => updateCustomElement(element.id, { 
                                     styles: { ...element.styles, width: e.target.value }
                                   })}
                                   disabled={!isEditing}
                                   placeholder="200px"
                                 />
                                 <label>Height:</label>
                                 <input
                                   type="text"
                                   value={element.styles?.height || 'auto'}
                                   onChange={(e) => updateCustomElement(element.id, { 
                                     styles: { ...element.styles, height: e.target.value }
                                   })}
                                   disabled={!isEditing}
                                   placeholder="auto"
                                 />
                               </div>
                             )}
                          </div>
                        </div>
                        )}
                      </div>
                    );
                    })}
                  </div>
                )}

                {/* Nội dung khối trang chủ (4 block riêng) - chỉ khi chọn Homepage */}
                {selectedPage?.path === '/' && (
                  <div className="homepage-content-blocks-editor">
                    <div className="content-block-editor-actions" style={{ marginBottom: 12 }}>
                      <button
                        type="button"
                        className="toolbar-btn default-btn"
                        onClick={handleSaveAsDefault}
                      >
                        Lưu mặc định
                      </button>
                    </div>
                    {CONTENT_BLOCK_KEYS.map((key) => {
                      const defaults = getDefaultContentBlocks();
                      const block = (currentConfig.contentBlocks && currentConfig.contentBlocks[key]) || defaults[key];
                      const collapsed = contentBlockCollapsed[key];
                      const setCollapsed = (v) => setContentBlockCollapsed(prev => ({ ...prev, [key]: v }));
                      const isListBlock = LIST_BLOCK_KEYS.includes(key);
                      const items = Array.isArray(block?.items) ? block.items : (defaults[key]?.items ? [...defaults[key].items] : []);

                      const setItems = (newItems) => setCurrentConfig(prev => ({
                        ...prev,
                        contentBlocks: {
                          ...(prev.contentBlocks || {}),
                          [key]: { ...(prev.contentBlocks?.[key] || defaults[key]), items: newItems }
                        }
                      }));

                      const updateItem = (index, field, value) => {
                        const next = items.map((it, i) => i === index ? { ...it, [field]: value } : it);
                        setItems(next);
                      };

                      const addItem = () => setItems([...items, { text: '', link: '', color: key === 'notice' ? 'red' : 'orange', isNew: false, prefix: '' }]);
                      const removeItem = (index) => setItems(items.filter((_, i) => i !== index));

                      return (
                        <div key={key} className="content-block-editor-card config-section-collapsible">
                          <button type="button" className="config-section-toggle" onClick={() => setCollapsed(!collapsed)} aria-expanded={!collapsed}>
                            <span className="config-section-toggle-icon">{collapsed ? '▶' : '▼'}</span>
                            <h4>{CONTENT_BLOCK_LABELS[key]}</h4>
                          </button>
                          {!collapsed && (
                            <div className="config-section-body">
                              {isListBlock ? (
                                <>
                                  <div className="config-row">
                                    <label>Danh sách mục (mỗi dòng: text, link, color, isNew, prefix nếu có):</label>
                                    <button type="button" className="toolbar-btn" disabled={!isEditing} onClick={addItem}>+ Thêm mục</button>
                                  </div>
                                  <div className="content-block-items-list">
                                    {items.map((item, index) => (
                                      <div key={index} className="content-block-item-row">
                                        {key === 'notice' && (
                                          <input
                                            type="text"
                                            placeholder="Prefix (VD: Event)"
                                            value={item.prefix || ''}
                                            onChange={(e) => updateItem(index, 'prefix', e.target.value)}
                                            disabled={!isEditing}
                                            className="item-field item-prefix"
                                          />
                                        )}
                                        <input
                                          type="text"
                                          placeholder="Nội dung text"
                                          value={item.text || ''}
                                          onChange={(e) => updateItem(index, 'text', e.target.value)}
                                          disabled={!isEditing}
                                          className="item-field item-text"
                                        />
                                        <input
                                          type="text"
                                          placeholder="Link (tùy chọn)"
                                          value={item.link || ''}
                                          onChange={(e) => updateItem(index, 'link', e.target.value)}
                                          disabled={!isEditing}
                                          className="item-field item-link"
                                        />
                                        <input
                                          type="text"
                                          placeholder="Color (red/orange)"
                                          value={item.color || ''}
                                          onChange={(e) => updateItem(index, 'color', e.target.value)}
                                          disabled={!isEditing}
                                          className="item-field item-color"
                                        />
                                        <label className="item-new-check">
                                          <input
                                            type="checkbox"
                                            checked={!!item.isNew}
                                            onChange={(e) => updateItem(index, 'isNew', e.target.checked)}
                                            disabled={!isEditing}
                                          />
                                          New
                                        </label>
                                        <button type="button" className="item-remove-btn" onClick={() => removeItem(index)} disabled={!isEditing} title="Xóa mục">×</button>
                                      </div>
                                    ))}
                                  </div>
                                </>
                              ) : (
                                <div className="config-row">
                                  <label>HTML:</label>
                                  <textarea
                                    className="content-block-textarea"
                                    value={(currentConfig.contentBlocks && currentConfig.contentBlocks[key]?.html) ?? block?.html ?? ''}
                                    onChange={(e) => setCurrentConfig(prev => ({
                                      ...prev,
                                      contentBlocks: {
                                        ...(prev.contentBlocks || {}),
                                        [key]: { ...(prev.contentBlocks?.[key] || defaults[key]), html: e.target.value }
                                      }
                                    }))}
                                    disabled={!isEditing}
                                    rows={6}
                                    spellCheck={false}
                                  />
                                </div>
                              )}
                              {!isListBlock && (
                                <div className="config-row">
                                  <label>CSS (cho .homepage-block-{key}):</label>
                                  <textarea
                                    className="content-block-css-textarea"
                                    value={(currentConfig.contentBlocks && currentConfig.contentBlocks[key]?.css) ?? block?.css ?? ''}
                                    onChange={(e) => setCurrentConfig(prev => ({
                                      ...prev,
                                      contentBlocks: {
                                        ...(prev.contentBlocks || {}),
                                        [key]: { ...(prev.contentBlocks?.[key] || defaults[key]), css: e.target.value }
                                      }
                                    }))}
                                    disabled={!isEditing}
                                    rows={4}
                                    spellCheck={false}
                                    placeholder={'.homepage-block-' + key + ' { }'}
                                  />
                                </div>
                              )}
                              <div className="content-block-editor-actions">
                                <button
                                  type="button"
                                  className="toolbar-btn"
                                  disabled={!isEditing}
                                  onClick={() => setCurrentConfig(prev => ({
                                    ...prev,
                                    contentBlocks: {
                                      ...(prev.contentBlocks || {}),
                                      [key]: { ...DEFAULT_CONTENT_BLOCKS[key] }
                                    }
                                  }))}
                                >
                                  Khôi phục mặc định
                                </button>
                                <button
                                  type="button"
                                  className="toolbar-btn save-btn"
                                  onClick={handleSavePage}
                                  disabled={!selectedPage?.id || !currentConfig}
                                >
                                  Lưu (lưu cấu hình hiện tại)
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                </div>
                )}
              </div>

            </div>
          </div>
        )}
      </div>
      )}

      {/* Navbar Management Tab */}
      {activeTab === 'navbar' && (
        <div className="navbar-management">
          <div className="navbar-management-header">
            <h2>Quản lý Navbar</h2>
            <p>Điều chỉnh hiển thị floating action buttons</p>
          </div>

          <div className="navbar-config-section">
            <h3>Floating Action Buttons</h3>
            <div className="config-row">
              <label>
                <input
                  type="checkbox"
                  checked={navbarConfig.floatingButtons.visible}
                  onChange={(e) => handleNavbarConfigChange('floatingButtons', 'visible', e.target.checked)}
                />
                Hiển thị Floating Action Buttons
              </label>
            </div>
          </div>

          <div className="navbar-actions">
            <button 
              className="save-navbar-btn"
              onClick={() => saveNavbarConfig(navbarConfig)}
            >
              Lưu cấu hình Navbar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SiteManagement;
