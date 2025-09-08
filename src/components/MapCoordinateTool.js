import React, { useState, useRef } from 'react';
import './MapCoordinateTool.css';

function MapCoordinateTool() {
  const [coordinates, setCoordinates] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentArea, setCurrentArea] = useState(null);
  const [areaName, setAreaName] = useState('');
  const [areaPath, setAreaPath] = useState('');

  const mapRef = useRef(null);

  const handleMouseDown = (e) => {
    if (!isDrawing) {
      const rect = e.target.getBoundingClientRect();
      const x = Math.round(e.clientX - rect.left);
      const y = Math.round(e.clientY - rect.top);
      
      setIsDrawing(true);
      setCurrentArea({
        startX: x,
        startY: y,
        endX: x,
        endY: y
      });
    }
  };

  const handleMouseMove = (e) => {
    if (isDrawing && currentArea) {
      const rect = e.target.getBoundingClientRect();
      const x = Math.round(e.clientX - rect.left);
      const y = Math.round(e.clientY - rect.top);
      
      setCurrentArea(prev => ({
        ...prev,
        endX: x,
        endY: y
      }));
    }
  };

  const handleMouseUp = () => {
    if (isDrawing && currentArea) {
      const finalArea = {
        id: coordinates.length + 1,
        coords: [
          Math.min(currentArea.startX, currentArea.endX),
          Math.min(currentArea.startY, currentArea.endY),
          Math.max(currentArea.startX, currentArea.endX),
          Math.max(currentArea.startY, currentArea.endY)
        ],
        name: areaName || `Vùng ${coordinates.length + 1}`,
        path: areaPath || `/vùng-${coordinates.length + 1}`
      };
      
      setCoordinates(prev => [...prev, finalArea]);
      setIsDrawing(false);
      setCurrentArea(null);
      setAreaName('');
      setAreaPath('');
    }
  };

  const removeArea = (index) => {
    setCoordinates(prev => prev.filter((_, i) => i !== index));
  };

  const updateAreaName = (index, newName) => {
    setCoordinates(prev => prev.map((area, i) => 
      i === index ? { ...area, name: newName } : area
    ));
  };

  const updateAreaPath = (index, newPath) => {
    setCoordinates(prev => prev.map((area, i) => 
      i === index ? { ...area, path: newPath } : area
    ));
  };

  const copyToClipboard = () => {
    const code = generateCode();
    navigator.clipboard.writeText(code).then(() => {
      alert('Code đã được copy vào clipboard!');
    }).catch(err => {
      console.error('Failed to copy: ', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = code;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('Code đã được copy vào clipboard!');
    });
  };

  const generateCode = () => {
    if (coordinates.length === 0) {
      return '// Chưa có tọa độ nào được tạo';
    }

    const coordinatesCode = coordinates.map(area => 
      `    { id: ${area.id}, coords: [${area.coords.join(', ')}], path: '${area.path}', name: '${area.name}' }`
    ).join(',\n');

    return `// Tọa độ gốc (ở height 640px)
const originalCoordinates = [
${coordinatesCode}
];`;
  };

  const clearAll = () => {
    setCoordinates([]);
  };

  return (
    <div className="tool-container">
      <div className="tool-header">
        <h1>🗺️ Map Coordinate Tool</h1>
        <p>Click và kéo để tạo vùng clickable trên map</p>
      </div>

      <div className="tool-content">
        <div className="map-section">
          <div className="map-area">
            <img 
              ref={mapRef}
              src="map.jpg" 
              alt="Map" 
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
            
            {/* Existing areas */}
            {coordinates.map((area, index) => (
              <div
                key={area.id}
                className="drawn-area"
                style={{
                  position: 'absolute',
                  left: area.coords[0],
                  top: area.coords[1],
                  width: area.coords[2] - area.coords[0],
                  height: area.coords[3] - area.coords[1],
                  border: '2px solid #4CAF50',
                  backgroundColor: 'rgba(76, 175, 80, 0.2)',
                  cursor: 'pointer'
                }}
                title={`${area.name} - Click để xóa`}
                onClick={() => removeArea(index)}
              />
            ))}
            
            {/* Current drawing area */}
            {currentArea && (
              <div
                className="drawing-area"
                style={{
                  position: 'absolute',
                  left: Math.min(currentArea.startX, currentArea.endX),
                  top: Math.min(currentArea.startY, currentArea.endY),
                  width: Math.abs(currentArea.endX - currentArea.startX),
                  height: Math.abs(currentArea.endY - currentArea.startY),
                  border: '2px solid #F44336',
                  backgroundColor: 'rgba(244, 67, 54, 0.2)',
                  pointerEvents: 'none'
                }}
              />
            )}
          </div>
        </div>

        <div className="coordinates-panel">
          <div className="panel-header">
            <h3>📋 Tọa độ đã tạo</h3>
            <div className="panel-actions">
              <button onClick={copyToClipboard} className="copy-btn">
                📋 Copy Code
              </button>
              <button onClick={clearAll} className="clear-btn">
                🗑️ Xóa tất cả
              </button>
            </div>
          </div>

          <div className="coordinates-list">
            {coordinates.length === 0 ? (
              <p className="no-coordinates">Chưa có tọa độ nào được tạo</p>
            ) : (
              coordinates.map((area, index) => (
                <div key={area.id} className="coordinate-item">
                  <div className="area-header">
                    <strong>{area.name}</strong>
                    <button
                      onClick={() => removeArea(index)}
                      className="remove-btn"
                      title="Xóa vùng này"
                    >
                      ❌
                    </button>
                  </div>
                  
                  <div className="area-details">
                    <div className="detail-row">
                      <label>ID:</label>
                      <span>{area.id}</span>
                    </div>
                    <div className="detail-row">
                      <label>Tọa độ:</label>
                      <code>[{area.coords.join(', ')}]</code>
                    </div>
                    <div className="detail-row">
                      <label>Path:</label>
                      <input
                        type="text"
                        value={area.path}
                        onChange={(e) => updateAreaPath(index, e.target.value)}
                        placeholder="Nhập path..."
                        className="path-input"
                      />
                    </div>
                    <div className="detail-row">
                      <label>Tên:</label>
                      <input
                        type="text"
                        value={area.name}
                        onChange={(e) => updateAreaName(index, e.target.value)}
                        placeholder="Nhập tên..."
                        className="name-input"
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="code-preview">
            <h4>📄 Code Preview:</h4>
            <pre className="code-block">
              <code>{generateCode()}</code>
            </pre>
          </div>

          <div className="instructions">
            <h4>📝 Hướng dẫn sử dụng:</h4>
            <ol>
              <li>Click và kéo trên map để tạo vùng</li>
              <li>Nhập tên và path cho từng vùng</li>
              <li>Click "Copy Code" để copy code hoàn chỉnh</li>
              <li>Paste vào <code>originalCoordinates</code> trong <code>HomePage.js</code></li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MapCoordinateTool;
