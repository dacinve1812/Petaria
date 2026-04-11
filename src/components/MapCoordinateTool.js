import React, { useRef, useState } from 'react';
import './MapCoordinateTool.css';

function MapCoordinateTool() {
  const [coordinates, setCoordinates] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentArea, setCurrentArea] = useState(null);
  const [areaName, setAreaName] = useState('');
  const [areaPath, setAreaPath] = useState('');
  const [areaButtonLabel, setAreaButtonLabel] = useState('');

  const [imageSrc, setImageSrc] = useState('/castle.jpg');
  const [mapName, setMapName] = useState('petaria-map');
  const [previewHeight, setPreviewHeight] = useState(640);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [lastPointer, setLastPointer] = useState({ x: null, y: null });

  const mapRef = useRef(null);
  const mapAreaRef = useRef(null);
  const fileInputRef = useRef(null);
  const presetInputRef = useRef(null);

  const imageScale = (() => {
    const img = mapRef.current;
    if (!img || !img.clientWidth || !img.naturalWidth) return 1;
    return img.clientWidth / img.naturalWidth;
  })();

  const buildMapButtonsFromCoordinates = (areas) =>
    (Array.isArray(areas) ? areas : []).map((area, idx) => {
      const id = Number(area.id) || idx + 1;
      const coords = Array.isArray(area.coords) ? area.coords : [0, 0, 0, 0];
      const x = Math.round((coords[0] + coords[2]) / 2);
      const y = Math.round((coords[1] + coords[3]) / 2);
      return {
        id,
        x,
        y,
        path: area.path || `/vung-${id}`,
        label: area.buttonLabel || area.name || `Go ${id}`,
      };
    });

  const toNaturalPoint = (clientX, clientY) => {
    const img = mapRef.current;
    if (!img) return null;
    const rect = img.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    if (px < 0 || py < 0 || px > rect.width || py > rect.height) return null;
    const sx = img.naturalWidth / rect.width;
    const sy = img.naturalHeight / rect.height;
    return {
      x: Math.round(px * sx),
      y: Math.round(py * sy),
    };
  };

  const toRenderedRect = (coords) => {
    const img = mapRef.current;
    if (!img || !img.naturalWidth || !img.naturalHeight) {
      return { left: 0, top: 0, width: 0, height: 0 };
    }
    const rect = img.getBoundingClientRect();
    const sx = rect.width / img.naturalWidth;
    const sy = rect.height / img.naturalHeight;
    return {
      left: coords[0] * sx,
      top: coords[1] * sy,
      width: (coords[2] - coords[0]) * sx,
      height: (coords[3] - coords[1]) * sy,
    };
  };

  const handleMouseDown = (e) => {
    const p = toNaturalPoint(e.clientX, e.clientY);
    if (!p) return;
    setIsDrawing(true);
    setCurrentArea({
      startX: p.x,
      startY: p.y,
      endX: p.x,
      endY: p.y,
    });
  };

  const handleMouseMove = (e) => {
    const p = toNaturalPoint(e.clientX, e.clientY);
    if (p) setLastPointer({ x: p.x, y: p.y });
    if (!isDrawing || !currentArea || !p) return;
    setCurrentArea((prev) => ({ ...prev, endX: p.x, endY: p.y }));
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentArea) return;
    const finalArea = {
      id: coordinates.length + 1,
      coords: [
        Math.min(currentArea.startX, currentArea.endX),
        Math.min(currentArea.startY, currentArea.endY),
        Math.max(currentArea.startX, currentArea.endX),
        Math.max(currentArea.startY, currentArea.endY),
      ],
      name: areaName || `Vung ${coordinates.length + 1}`,
      path: areaPath || `/vung-${coordinates.length + 1}`,
      buttonLabel: areaButtonLabel || `Go ${coordinates.length + 1}`,
    };
    if (finalArea.coords[2] - finalArea.coords[0] > 1 && finalArea.coords[3] - finalArea.coords[1] > 1) {
      setCoordinates((prev) => [...prev, finalArea]);
    }
    setIsDrawing(false);
    setCurrentArea(null);
    setAreaName('');
    setAreaPath('');
    setAreaButtonLabel('');
  };

  const removeArea = (index) => {
    setCoordinates((prev) => prev.filter((_, i) => i !== index));
  };

  const updateAreaField = (index, field, value) => {
    setCoordinates((prev) =>
      prev.map((area, i) => (i === index ? { ...area, [field]: value } : area))
    );
  };

  const copyToClipboard = () => {
    const code = generateCode();
    navigator.clipboard
      .writeText(code)
      .then(() => window.alert('Code da duoc copy vao clipboard!'))
      .catch(() => {
        const textArea = document.createElement('textarea');
        textArea.value = code;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        window.alert('Code da duoc copy vao clipboard!');
      });
  };

  const generateCode = () => {
    if (coordinates.length === 0) {
      return '// Chua co toa do nao duoc tao';
    }

    const coordinatesCode = coordinates
      .map(
        (area) =>
          `  { id: ${area.id}, coords: [${area.coords.join(', ')}], path: '${area.path}', name: '${area.name}' }`
      )
      .join(',\n');

    const buttonsCode = coordinates
      .map((area) => {
        const cx = Math.round((area.coords[0] + area.coords[2]) / 2);
        const cy = Math.round((area.coords[1] + area.coords[3]) / 2);
        return `  { id: ${area.id}, x: ${cx}, y: ${cy}, path: '${area.path}', label: '${area.buttonLabel || area.name}' }`;
      })
      .join(',\n');

    return `// Generated by MapCoordinateTool
// Base image: ${imageSrc}
// Natural size: ${naturalSize.width || '?'}x${naturalSize.height || '?'}
// map name/id: ${mapName}

const originalCoordinates = [
${coordinatesCode}
];

const mapButtons = [
${buttonsCode}
];

/*
<img src="${imageSrc}" alt="Map" useMap="#${mapName}" />
<map name="${mapName}" id="${mapName}">
  {originalCoordinates.map((area) => (
    <area
      key={area.id}
      shape="rect"
      coords={area.coords.join(',')}
      alt={area.name}
      title={area.name}
      onClick={() => handleAreaClick(area.path)}
    />
  ))}
</map>

{mapButtons.map((btn) => (
  <button
    key={btn.id}
    className="map-nav-btn"
    style={{
      position: 'absolute',
      left: \`\${(btn.x / IMG_NATURAL_WIDTH) * 100}%\`,
      top: \`\${(btn.y / IMG_NATURAL_HEIGHT) * 100}%\`,
      transform: 'translate(-50%, -50%)',
    }}
    onClick={() => handleAreaClick(btn.path)}
  >
    {btn.label}
  </button>
))}
*/
`;
  };

  const clearAll = () => setCoordinates([]);

  const exportPresetJson = () => {
    const mapButtons = buildMapButtonsFromCoordinates(coordinates);
    const payload = {
      version: 1,
      imageSrc,
      mapName,
      previewHeight,
      originalHeight: naturalSize.height || previewHeight,
      naturalSize,
      originalCoordinates: coordinates,
      mapButtons,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${mapName || 'map'}-preset.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importPresetJson = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        const nextImageSrc =
          typeof parsed.imageSrc === 'string' && parsed.imageSrc.trim()
            ? parsed.imageSrc
            : '/castle.jpg';
        const nextMapName =
          typeof parsed.mapName === 'string' && parsed.mapName.trim()
            ? parsed.mapName
            : 'petaria-map';
        const nextPreview = Math.max(200, Number(parsed.previewHeight) || 640);
        const nextCoords = Array.isArray(parsed.coordinates)
          ? parsed.coordinates
              .filter((a) => a && Array.isArray(a.coords) && a.coords.length === 4)
              .map((a, idx) => ({
                id: Number(a.id) || idx + 1,
                coords: a.coords.map((n) => Math.round(Number(n) || 0)),
                name: a.name || `Vung ${idx + 1}`,
                path: a.path || `/vung-${idx + 1}`,
                buttonLabel: a.buttonLabel || a.name || `Go ${idx + 1}`,
              }))
          : Array.isArray(parsed.originalCoordinates)
          ? parsed.originalCoordinates
              .filter((a) => a && Array.isArray(a.coords) && a.coords.length === 4)
              .map((a, idx) => ({
                id: Number(a.id) || idx + 1,
                coords: a.coords.map((n) => Math.round(Number(n) || 0)),
                name: a.name || `Vung ${idx + 1}`,
                path: a.path || `/vung-${idx + 1}`,
                buttonLabel: a.buttonLabel || a.name || `Go ${idx + 1}`,
              }))
          : [];
        setImageSrc(nextImageSrc);
        setMapName(nextMapName);
        setPreviewHeight(nextPreview);
        setCoordinates(nextCoords);
        setCurrentArea(null);
        setIsDrawing(false);
        setAreaName('');
        setAreaPath('');
        setAreaButtonLabel('');
      } catch (err) {
        window.alert(`Import JSON loi: ${err.message || String(err)}`);
      }
    };
    reader.readAsText(file);
  };

  const handleImageLoad = () => {
    const img = mapRef.current;
    if (!img) return;
    setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
  };

  const handlePickFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const localUrl = URL.createObjectURL(file);
    setImageSrc(localUrl);
    setCoordinates([]);
    setCurrentArea(null);
  };

  const currentRectStyle = currentArea
    ? (() => {
        const c = [
          Math.min(currentArea.startX, currentArea.endX),
          Math.min(currentArea.startY, currentArea.endY),
          Math.max(currentArea.startX, currentArea.endX),
          Math.max(currentArea.startY, currentArea.endY),
        ];
        const r = toRenderedRect(c);
        return {
          left: r.left,
          top: r.top,
          width: r.width,
          height: r.height,
        };
      })()
    : null;

  return (
    <div className="tool-container">
      <div className="tool-header">
        <h1>Map Coordinate Tool</h1>
        <p>Ve vung rect, doi anh map trong UI, xuat coords + button config.</p>
      </div>

      <div className="tool-top-controls">
        <label>
          Image src
          <input
            type="text"
            value={imageSrc}
            onChange={(e) => setImageSrc(e.target.value)}
            placeholder="/castle.jpg hoac /worldmap/1-1.png"
          />
        </label>
        <label>
          Map name/id
          <input type="text" value={mapName} onChange={(e) => setMapName(e.target.value)} />
        </label>
        <label>
          Preview height (px)
          <input
            type="number"
            min={200}
            max={1600}
            value={previewHeight}
            onChange={(e) => setPreviewHeight(Math.max(200, Number(e.target.value) || 640))}
          />
        </label>
        <button type="button" onClick={() => fileInputRef.current?.click()} className="copy-btn">
          Chon file local
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handlePickFile}
          style={{ display: 'none' }}
        />
      </div>

      <div className="tool-content">
        <div className="map-section">
          <div
            ref={mapAreaRef}
            className="map-area"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <img
              ref={mapRef}
              src={imageSrc}
              alt="Map"
              style={{ height: `${previewHeight}px` }}
              onLoad={handleImageLoad}
              draggable={false}
            />

            {coordinates.map((area, index) => {
              const box = toRenderedRect(area.coords);
              return (
                <div
                  key={area.id}
                  className="drawn-area"
                  style={{
                    left: box.left,
                    top: box.top,
                    width: box.width,
                    height: box.height,
                  }}
                  title={`${area.name} - click de xoa`}
                  onClick={() => removeArea(index)}
                />
              );
            })}

            {currentRectStyle && (
              <div
                className="drawing-area"
                style={{
                  left: currentRectStyle.left,
                  top: currentRectStyle.top,
                  width: currentRectStyle.width,
                  height: currentRectStyle.height,
                }}
              />
            )}
          </div>
        </div>

        <div className="coordinates-panel">
          <div className="panel-header">
            <h3>Toa do da tao</h3>
            <div className="panel-actions">
              <button onClick={copyToClipboard} className="copy-btn">
                Copy Code
              </button>
              <button onClick={exportPresetJson} className="copy-btn">
                Export JSON
              </button>
              <button onClick={() => presetInputRef.current?.click()} className="copy-btn">
                Import JSON
              </button>
              <button onClick={clearAll} className="clear-btn">
                Xoa tat ca
              </button>
            </div>
            <input
              ref={presetInputRef}
              type="file"
              accept=".json,application/json"
              onChange={importPresetJson}
              style={{ display: 'none' }}
            />
          </div>

          <div className="tool-meta">
            <div>
              Natural size: <strong>{naturalSize.width || '?'} x {naturalSize.height || '?'}</strong>
            </div>
            <div>
              Scale preview: <strong>{imageScale.toFixed(3)}x</strong>
            </div>
            <div>
              Pointer: <strong>{lastPointer.x != null ? `${lastPointer.x}, ${lastPointer.y}` : '--'}</strong>
            </div>
          </div>

          <div className="new-area-inputs">
            <label>
              Ten vung moi
              <input
                type="text"
                value={areaName}
                onChange={(e) => setAreaName(e.target.value)}
                placeholder="VD: Khu rung bi an"
              />
            </label>
            <label>
              Path vung moi
              <input
                type="text"
                value={areaPath}
                onChange={(e) => setAreaPath(e.target.value)}
                placeholder="/hunting-world"
              />
            </label>
            <label>
              Button label
              <input
                type="text"
                value={areaButtonLabel}
                onChange={(e) => setAreaButtonLabel(e.target.value)}
                placeholder="VD: Vao khu nay"
              />
            </label>
          </div>

          <div className="coordinates-list">
            {coordinates.length === 0 ? (
              <p className="no-coordinates">Chua co toa do nao duoc tao</p>
            ) : (
              coordinates.map((area, index) => (
                <div key={area.id} className="coordinate-item">
                  <div className="area-header">
                    <strong>{area.name}</strong>
                    <button
                      onClick={() => removeArea(index)}
                      className="remove-btn"
                      title="Xoa vung nay"
                    >
                      X
                    </button>
                  </div>

                  <div className="area-details">
                    <div className="detail-row">
                      <label>ID:</label>
                      <span>{area.id}</span>
                    </div>
                    <div className="detail-row">
                      <label>Toa do:</label>
                      <code>[{area.coords.join(', ')}]</code>
                    </div>
                    <div className="detail-row">
                      <label>Path:</label>
                      <input
                        type="text"
                        value={area.path}
                        onChange={(e) => updateAreaField(index, 'path', e.target.value)}
                        className="path-input"
                      />
                    </div>
                    <div className="detail-row">
                      <label>Ten:</label>
                      <input
                        type="text"
                        value={area.name}
                        onChange={(e) => updateAreaField(index, 'name', e.target.value)}
                        className="name-input"
                      />
                    </div>
                    <div className="detail-row">
                      <label>Button:</label>
                      <input
                        type="text"
                        value={area.buttonLabel || ''}
                        onChange={(e) => updateAreaField(index, 'buttonLabel', e.target.value)}
                        className="name-input"
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="code-preview">
            <h4>Code Preview</h4>
            <pre className="code-block">
              <code>{generateCode()}</code>
            </pre>
          </div>

          <div className="instructions">
            <h4>Huong dan nhanh</h4>
            <ol>
              <li>Doi image src (hoac chon file local) va map name.</li>
              <li>Click-kéo de tao rect, roi nhap ten/path/button label cho vung moi.</li>
              <li>Chinh sua tung vung trong danh sach ben phai neu can.</li>
              <li>Chon <b>Export JSON</b> de luu preset map.</li>
              <li>Copy file preset vao <code>src/config/homepage-castle-map.json</code> (neu dung cho HomePage).</li>
              <li>Dung <b>Import JSON</b> de mo lai preset va tiep tuc chinh sua.</li>
              <li><b>Copy Code</b> chi dung khi ban can paste nhanh vao component khac.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MapCoordinateTool;
