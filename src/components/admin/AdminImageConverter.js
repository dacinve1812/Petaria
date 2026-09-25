import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../UserContext';
import './AdminConfigPage.css';
import './AdminImageConverter.css';

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/bmp'];

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function webpName(name) {
  return `${String(name || 'image').replace(/\.[^.]+$/, '')}.webp`;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({ image, url });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Không thể đọc file ảnh này.'));
    };
    image.src = url;
  });
}

function canvasToWebp(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Trình duyệt không thể tạo ảnh WebP.'));
      },
      'image/webp',
      quality
    );
  });
}

function averageCornerColor(data, width, height) {
  const sample = Math.max(1, Math.min(8, Math.floor(Math.min(width, height) / 10)));
  const corners = [
    [0, 0],
    [Math.max(0, width - sample), 0],
    [0, Math.max(0, height - sample)],
    [Math.max(0, width - sample), Math.max(0, height - sample)],
  ];
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;

  corners.forEach(([startX, startY]) => {
    for (let y = startY; y < Math.min(height, startY + sample); y += 1) {
      for (let x = startX; x < Math.min(width, startX + sample); x += 1) {
        const i = (y * width + x) * 4;
        if (data[i + 3] === 0) continue;
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        count += 1;
      }
    }
  });

  return count ? [r / count, g / count, b / count] : [255, 255, 255];
}

/**
 * Xóa các pixel nền nối với biên ảnh. Cách này chạy local và an toàn cho vùng
 * bên trong chủ thể có màu gần nền hơn so với xóa toàn bộ theo chroma-key.
 */
function removeConnectedBackground(imageData, tolerance) {
  const { data, width, height } = imageData;
  const [bgR, bgG, bgB] = averageCornerColor(data, width, height);
  const maxDistance = Math.max(5, Number(tolerance)) * 4.42;
  const visited = new Uint8Array(width * height);
  const stack = [];

  const push = (x, y) => {
    const p = y * width + x;
    if (visited[p]) return;
    visited[p] = 1;
    stack.push(p);
  };

  for (let x = 0; x < width; x += 1) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    push(0, y);
    push(width - 1, y);
  }

  while (stack.length) {
    const p = stack.pop();
    const i = p * 4;
    const dr = data[i] - bgR;
    const dg = data[i + 1] - bgG;
    const db = data[i + 2] - bgB;
    const distance = Math.sqrt(dr * dr + dg * dg + db * db);
    if (distance > maxDistance) continue;

    // Làm mềm viền thay vì cắt alpha hoàn toàn ngay tại ngưỡng.
    const edgeStart = maxDistance * 0.72;
    data[i + 3] =
      distance <= edgeStart
        ? 0
        : Math.round(255 * ((distance - edgeStart) / (maxDistance - edgeStart)));

    const x = p % width;
    const y = Math.floor(p / width);
    if (x > 0) push(x - 1, y);
    if (x + 1 < width) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y + 1 < height) push(x, y + 1);
  }

  return imageData;
}

function AdminImageConverter() {
  const { user, isLoading } = useUser();
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const sourceUrlRef = useRef(null);
  const resultUrlRef = useRef(null);

  const [file, setFile] = useState(null);
  const [sourceSize, setSourceSize] = useState({ width: 0, height: 0 });
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [lockRatio, setLockRatio] = useState(true);
  const [quality, setQuality] = useState(82);
  const [removeBackground, setRemoveBackground] = useState(false);
  const [tolerance, setTolerance] = useState(28);
  const [result, setResult] = useState(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isLoading && (!user || !user.isAdmin)) navigate('/login');
  }, [user, isLoading, navigate]);

  useEffect(
    () => () => {
      if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    },
    []
  );

  const clearResult = () => {
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    resultUrlRef.current = null;
    setResult(null);
  };

  const selectFile = async (selected) => {
    setError('');
    clearResult();
    if (!selected) return;
    if (!ACCEPTED_TYPES.includes(selected.type)) {
      setError('Chỉ hỗ trợ PNG, JPG/JPEG, WebP và BMP.');
      return;
    }

    try {
      const loaded = await loadImage(selected);
      if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
      sourceUrlRef.current = loaded.url;
      imageRef.current = loaded.image;
      setFile(selected);
      setSourceSize({ width: loaded.image.naturalWidth, height: loaded.image.naturalHeight });
      setWidth(String(loaded.image.naturalWidth));
      setHeight(String(loaded.image.naturalHeight));
    } catch (err) {
      setError(err.message);
    }
  };

  const changeWidth = (value) => {
    setWidth(value);
    clearResult();
    if (lockRatio && sourceSize.width && Number(value) > 0) {
      setHeight(String(Math.max(1, Math.round((Number(value) * sourceSize.height) / sourceSize.width))));
    }
  };

  const changeHeight = (value) => {
    setHeight(value);
    clearResult();
    if (lockRatio && sourceSize.height && Number(value) > 0) {
      setWidth(String(Math.max(1, Math.round((Number(value) * sourceSize.width) / sourceSize.height))));
    }
  };

  const resetSize = () => {
    setWidth(String(sourceSize.width));
    setHeight(String(sourceSize.height));
    clearResult();
  };

  const convert = async () => {
    const targetWidth = Math.round(Number(width));
    const targetHeight = Math.round(Number(height));
    if (!imageRef.current || !file) {
      setError('Hãy chọn ảnh cần chuyển đổi.');
      return;
    }
    if (
      !Number.isInteger(targetWidth) ||
      !Number.isInteger(targetHeight) ||
      targetWidth < 1 ||
      targetHeight < 1 ||
      targetWidth > 8192 ||
      targetHeight > 8192
    ) {
      setError('Width và height phải từ 1 đến 8192 px.');
      return;
    }

    setWorking(true);
    setError('');
    clearResult();
    try {
      const canvas = canvasRef.current;
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: removeBackground });
      ctx.clearRect(0, 0, targetWidth, targetHeight);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(imageRef.current, 0, 0, targetWidth, targetHeight);

      if (removeBackground) {
        const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
        ctx.putImageData(removeConnectedBackground(imageData, tolerance), 0, 0);
      }

      const blob = await canvasToWebp(canvas, quality / 100);
      const url = URL.createObjectURL(blob);
      resultUrlRef.current = url;
      setResult({ blob, url, name: webpName(file.name), width: targetWidth, height: targetHeight });
    } catch (err) {
      console.error(err);
      setError(err.message || 'Không thể chuyển đổi ảnh.');
    } finally {
      setWorking(false);
    }
  };

  const download = () => {
    if (!result) return;
    const link = document.createElement('a');
    link.href = result.url;
    link.download = result.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  if (isLoading) return <div>Loading...</div>;
  if (!user || !user.isAdmin) return null;

  return (
    <div className="admin-config-page admin-image-converter">
      <div className="admin-header">
        <div className="header-text">
          <h1>Chuyển đổi ảnh sang WebP</h1>
          <p>Resize, tối ưu dung lượng và xóa nền ngay trong trình duyệt. Ảnh không được upload lên server.</p>
        </div>
        <button type="button" className="back-admin-btn" onClick={() => navigate('/admin')}>
          ← Admin Panel
        </button>
      </div>

      <div className="aic-layout">
        <section className="section-card aic-controls">
          <label className="aic-file-drop">
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.webp,.bmp,image/png,image/jpeg,image/webp,image/bmp"
              onChange={(event) => selectFile(event.target.files?.[0])}
            />
            <strong>{file ? file.name : 'Chọn ảnh PNG / JPG / WebP / BMP'}</strong>
            <span>{file ? `${sourceSize.width} × ${sourceSize.height}px · ${formatBytes(file.size)}` : 'Click để chọn file'}</span>
          </label>

          <div className="aic-field-row">
            <label>
              Width (px)
              <input type="number" min="1" max="8192" value={width} onChange={(e) => changeWidth(e.target.value)} />
            </label>
            <span className="aic-size-x">×</span>
            <label>
              Height (px)
              <input type="number" min="1" max="8192" value={height} onChange={(e) => changeHeight(e.target.value)} />
            </label>
          </div>

          <div className="aic-inline-options">
            <label className="aic-check">
              <input type="checkbox" checked={lockRatio} onChange={(e) => setLockRatio(e.target.checked)} />
              Giữ tỷ lệ
            </label>
            <button type="button" className="aic-text-btn" onClick={resetSize} disabled={!file}>
              Kích thước gốc
            </button>
          </div>

          <label className="aic-range">
            <span>Chất lượng WebP: <strong>{quality}%</strong></span>
            <input type="range" min="10" max="100" value={quality} onChange={(e) => { setQuality(Number(e.target.value)); clearResult(); }} />
          </label>

          <label className="aic-check aic-background-toggle">
            <input
              type="checkbox"
              checked={removeBackground}
              onChange={(e) => { setRemoveBackground(e.target.checked); clearResult(); }}
            />
            Xóa nền tự động
          </label>
          {removeBackground && (
            <label className="aic-range">
              <span>Độ nhạy nền: <strong>{tolerance}</strong></span>
              <input type="range" min="5" max="70" value={tolerance} onChange={(e) => { setTolerance(Number(e.target.value)); clearResult(); }} />
              <small>Phù hợp nhất với nền đơn sắc, lấy màu nền từ bốn góc ảnh.</small>
            </label>
          )}

          {error && <p className="aic-error">{error}</p>}

          <button type="button" className="aic-convert-btn" onClick={convert} disabled={!file || working}>
            {working ? 'Đang xử lý…' : 'Chuyển sang WebP'}
          </button>
        </section>

        <section className="section-card aic-preview-card">
          <div className="aic-preview-heading">
            <h2>Xem trước</h2>
            {result && (
              <span>
                {result.width} × {result.height}px · {formatBytes(result.blob.size)}
                {file?.size > 0 && ` · ${Math.round((1 - result.blob.size / file.size) * 100)}%`}
              </span>
            )}
          </div>
          <div className="aic-preview-stage">
            {result ? (
              <img src={result.url} alt="Kết quả WebP" />
            ) : file && sourceUrlRef.current ? (
              <img src={sourceUrlRef.current} alt="Ảnh gốc" />
            ) : (
              <p>Chưa chọn ảnh</p>
            )}
          </div>
          <button type="button" className="aic-download-btn" onClick={download} disabled={!result}>
            Tải ảnh WebP
          </button>
        </section>
      </div>

      <canvas ref={canvasRef} className="aic-hidden-canvas" aria-hidden />
    </div>
  );
}

export default AdminImageConverter;
