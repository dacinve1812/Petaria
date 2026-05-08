import React, { useEffect, useMemo, useRef, useState } from 'react';

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function ScratchCell({
  className = '',
  disabled = false,
  /** 0..1 phần trăm đã cào để tự mở */
  revealThreshold = 0.58,
  /** 0..1 phần trăm đã cào ở vùng trung tâm để tự mở */
  centerRevealThreshold = 0.22,
  /** tỉ lệ vùng trung tâm (0..1) tính theo chiều rộng/cao */
  centerBoxRatio = 0.55,
  brushPx = 18,
  /** lớp phủ ban đầu (opaque để không thấy icon bên dưới) */
  coverColor = '#9ca3af',
  /** mỗi stroke chỉ “xóa” một phần alpha (cào nhiều sẽ rõ dần) */
  brushAlpha = 0.22,
  coverText = 'CÀO',
  onRevealed,
  children,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const isDownRef = useRef(false);
  const lastPtRef = useRef(null);
  const rafRef = useRef(0);
  const [revealed, setRevealed] = useState(false);

  const dpr = useMemo(() => (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1), []);

  const setupCanvas = () => {
    const canvas = canvasRef.current;
    const host = containerRef.current;
    if (!canvas || !host) return;
    const rect = host.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // cover layer
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = coverColor;
    ctx.fillRect(0, 0, w, h);

    // subtle speckles
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#0f172a';
    for (let i = 0; i < 70; i += 1) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const r = 0.6 + Math.random() * 1.7;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // label
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '700 14px system-ui, -apple-system, Segoe UI, Roboto, Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(coverText, w / 2, h / 2);
  };

  useEffect(() => {
    setupCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dpr, coverColor, coverText]);

  useEffect(() => {
    const host = containerRef.current;
    if (!host) return undefined;
    const ro = new ResizeObserver(() => {
      if (revealed) return;
      setupCanvas();
    });
    ro.observe(host);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed]);

  const scratchAt = (x, y) => {
    const canvas = canvasRef.current;
    const host = containerRef.current;
    if (!canvas || !host) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = host.getBoundingClientRect();
    const lx = clamp(x - rect.left, 0, rect.width);
    const ly = clamp(y - rect.top, 0, rect.height);

    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = brushAlpha;
    ctx.beginPath();
    ctx.arc(lx, ly, brushPx, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  };

  const computeRevealed = () => {
    const canvas = canvasRef.current;
    if (!canvas) return false;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;
    const { width, height } = canvas;
    const img = ctx.getImageData(0, 0, width, height);
    const data = img.data;
    // sample thưa để nhanh hơn (step 8px theo dpr)
    const step = Math.max(1, Math.floor(8 * dpr));
    let total = 0;
    let cleared = 0;
    let centerTotal = 0;
    let centerCleared = 0;

    const cbr = clamp(Number(centerBoxRatio) || 0.55, 0.25, 0.9);
    const cx0 = Math.floor(width * (0.5 - cbr / 2));
    const cx1 = Math.floor(width * (0.5 + cbr / 2));
    const cy0 = Math.floor(height * (0.5 - cbr / 2));
    const cy1 = Math.floor(height * (0.5 + cbr / 2));

    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const a = data[(y * width + x) * 4 + 3];
        total += 1;
        if (a < 40) cleared += 1;
        if (x >= cx0 && x <= cx1 && y >= cy0 && y <= cy1) {
          centerTotal += 1;
          if (a < 40) centerCleared += 1;
        }
      }
    }
    const ratio = total ? cleared / total : 0;
    const centerRatio = centerTotal ? centerCleared / centerTotal : 0;
    return ratio >= revealThreshold || centerRatio >= centerRevealThreshold;
  };

  const scheduleCheck = () => {
    if (rafRef.current) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = 0;
      if (revealed) return;
      if (computeRevealed()) {
        setRevealed(true);
        onRevealed?.();
      }
    });
  };

  const onPointerDown = (e) => {
    if (disabled || revealed) return;
    isDownRef.current = true;
    lastPtRef.current = { x: e.clientX, y: e.clientY };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {
      // ignore
    }
    scratchAt(e.clientX, e.clientY);
    scheduleCheck();
  };

  const onPointerMove = (e) => {
    if (disabled || revealed) return;
    if (!isDownRef.current) return;
    scratchAt(e.clientX, e.clientY);
    lastPtRef.current = { x: e.clientX, y: e.clientY };
    scheduleCheck();
  };

  const onPointerUp = (e) => {
    if (disabled || revealed) return;
    isDownRef.current = false;
    lastPtRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (_) {
      // ignore
    }
    scheduleCheck();
  };

  return (
    <div
      ref={containerRef}
      className={`ec-scratch-slot ${revealed ? 'is-revealed' : 'is-covered'} ${className}`.trim()}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role="button"
      tabIndex={0}
      aria-label="Ô vé cào"
      style={{ touchAction: 'none' }}
    >
      <div className="ec-scratch-slot__content">{children}</div>
      {!revealed && <canvas ref={canvasRef} className="ec-scratch-slot__cover" />}
    </div>
  );
}

export default ScratchCell;

