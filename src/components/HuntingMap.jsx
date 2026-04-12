import React, { useEffect, useRef, useState, useLayoutEffect, useCallback } from 'react';
import { useParams, useNavigate, useBlocker } from 'react-router-dom';
import Phaser from 'phaser';
import PreloadScene from '../game/scenes/PreloadScene';
import MainScene from '../game/scenes/MainScene';
import { CAMERA_ZOOM } from '../game/config/huntingConfig';
import { fetchPublicHuntingMap } from '../api/huntingMapsApi';
import { getCustomMap } from '../utils/huntingMapsStorage';
import GameDialogModal from './ui/GameDialogModal';
import {
  clearActiveHuntingMap,
  clearHuntingSession,
  setActiveHuntingMap,
} from '../utils/huntingSessionStorage';
import './HuntingMap.css';

function isHuntingMapPath(pathname) {
  return /\/hunting-world\/map\//.test(pathname || '');
}

function emitCamera(action) {
  window.dispatchEvent(new CustomEvent('petaria-hunting-camera', { detail: { action } }));
}

function emitSpeed(action) {
  window.dispatchEvent(new CustomEvent('petaria-hunting-move-speed', { detail: { action } }));
}

function emitDpad(phase, dir) {
  window.dispatchEvent(new CustomEvent('petaria-hunting-dpad', { detail: { phase, dir } }));
}

function huntingCanvasDpr() {
  if (typeof window === 'undefined') return 1;
  return Math.min(Math.max(window.devicePixelRatio || 1, 1), 2.25);
}

function readGameSize(areaEl) {
  const w = Math.floor(areaEl.clientWidth);
  const h = Math.floor(areaEl.clientHeight);
  if (w >= 64 && h >= 64) return { width: w, height: h };
  const vw = typeof window !== 'undefined' ? window.innerWidth : 800;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 600;
  return {
    width: Math.max(320, Math.floor(vw - 24)),
    height: Math.max(280, Math.floor(vh * 0.5)),
  };
}

function DpadButton({ dir, label, className = '' }) {
  const endHold = useCallback(() => {
    emitDpad('up');
  }, []);

  return (
    <button
      type="button"
      className={`hunting-dpad-btn ${className}`.trim()}
      onPointerDown={(e) => {
        e.preventDefault();
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch (_) {
          /* ignore */
        }
        emitDpad('down', dir);
      }}
      onPointerUp={endHold}
      onPointerCancel={endHold}
      onLostPointerCapture={endHold}
    >
      {label}
    </button>
  );
}

function HuntingMap() {
  const gameRef = useRef(null);
  const containerRef = useRef(null);
  const gameAreaRef = useRef(null);
  const { id } = useParams();
  const navigate = useNavigate();
  const [zoomLabel, setZoomLabel] = useState(() => CAMERA_ZOOM.toFixed(2));
  const [speedLabel, setSpeedLabel] = useState('1.0×');
  const [stepsLabel, setStepsLabel] = useState('…');
  const [exhaustedModalOpen, setExhaustedModalOpen] = useState(false);
  const [leaveHuntModalOpen, setLeaveHuntModalOpen] = useState(false);
  const allowLeaveRef = useRef(false);
  /** undefined = đang tải; null = không có payload server/local (dùng getHuntingMap trong scene); object = mapOverride */
  const [mapPayload, setMapPayload] = useState(undefined);

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (allowLeaveRef.current) return false;
    if (!isHuntingMapPath(currentLocation.pathname)) return false;
    if (isHuntingMapPath(nextLocation.pathname)) return false;
    return true;
  });

  useEffect(() => {
    if (blocker.state === 'blocked') {
      setLeaveHuntModalOpen(true);
    }
  }, [blocker.state, blocker]);

  useEffect(() => {
    const onExhausted = () => setExhaustedModalOpen(true);
    window.addEventListener('petaria-hunting-steps-exhausted', onExhausted);
    return () => window.removeEventListener('petaria-hunting-steps-exhausted', onExhausted);
  }, []);

  useEffect(() => {
    const lid = String(id || 'forest').toLowerCase();
    setActiveHuntingMap(lid);
    if (lid === 'forest') {
      setMapPayload(null);
      return;
    }
    let cancelled = false;
    setMapPayload(undefined);
    (async () => {
      try {
        const api = await fetchPublicHuntingMap(lid);
        if (cancelled) return;
        if (api && api.tiles && api.width && api.height) {
          setMapPayload(api);
          return;
        }
        const local = getCustomMap(lid);
        if (cancelled) return;
        if (local && local.tiles && local.width && local.height) {
          setMapPayload(local);
          return;
        }
        setMapPayload(null);
      } catch {
        if (!cancelled) setMapPayload(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleExhaustedConfirm = useCallback(() => {
    clearActiveHuntingMap();
    clearHuntingSession();
    setExhaustedModalOpen(false);
    navigate('/hunting-world');
  }, [navigate]);

  const handleLeaveConfirm = useCallback(() => {
    clearActiveHuntingMap();
    clearHuntingSession();
    setLeaveHuntModalOpen(false);
    allowLeaveRef.current = true;
    if (blocker.state === 'blocked') {
      blocker.proceed();
      return;
    }
    navigate('/hunting-world');
  }, [blocker, navigate]);

  const handleLeaveCancel = useCallback(() => {
    setLeaveHuntModalOpen(false);
    allowLeaveRef.current = false;
    if (blocker.state === 'blocked') {
      blocker.reset();
    }
  }, [blocker]);

  useLayoutEffect(() => {
    const onZoomState = (e) => {
      const z = e.detail?.zoom;
      if (typeof z === 'number') setZoomLabel(z.toFixed(2));
    };
    const onSpeedState = (e) => {
      const m = e.detail?.multiplier;
      if (typeof m === 'number') setSpeedLabel(`${m.toFixed(2)}×`);
    };
    const onSteps = (e) => {
      const { remaining, max, unlimited } = e.detail || {};
      if (unlimited) setStepsLabel('∞');
      else if (typeof remaining === 'number' && typeof max === 'number') {
        setStepsLabel(`${remaining} / ${max}`);
      } else setStepsLabel('—');
    };
    window.addEventListener('petaria-hunting-camera-state', onZoomState);
    window.addEventListener('petaria-hunting-speed-state', onSpeedState);
    window.addEventListener('petaria-hunting-steps-changed', onSteps);
    return () => {
      window.removeEventListener('petaria-hunting-camera-state', onZoomState);
      window.removeEventListener('petaria-hunting-speed-state', onSpeedState);
      window.removeEventListener('petaria-hunting-steps-changed', onSteps);
    };
  }, []);

  useEffect(() => {
    const area = gameAreaRef.current;
    const parent = containerRef.current;
    if (!area || !parent) return;
    if (mapPayload === undefined) return;

    const { width, height } = readGameSize(area);
    const resolution = huntingCanvasDpr();

    const mapOverride = mapPayload != null ? mapPayload : undefined;

    const config = {
      type: Phaser.AUTO,
      parent,
      width,
      height,
      resolution,
      backgroundColor: '#1b1f2a',
      // Giữ pixelArt để sprite không bị mờ; nền map HD chỉnh FilterMode riêng trong MainScene.
      pixelArt: true,
      scale: {
        mode: Phaser.Scale.NONE,
      },
      physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 }, debug: false },
      },
      scene: [
        new PreloadScene({ selectedMapId: id, ...(mapOverride ? { mapOverride } : {}) }),
        new MainScene({ selectedMapId: id, ...(mapOverride ? { mapOverride } : {}) }),
      ],
    };

    gameRef.current = new Phaser.Game(config);
    setZoomLabel(CAMERA_ZOOM.toFixed(2));
    setSpeedLabel('1.00×');
    setStepsLabel('…');

    const ro = new ResizeObserver(() => {
      if (!gameRef.current || !area) return;
      const next = readGameSize(area);
      if (next.width >= 64 && next.height >= 64) {
        gameRef.current.scale.resize(next.width, next.height);
      }
    });
    ro.observe(area);

    return () => {
      ro.disconnect();
      emitDpad('cancel');
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [id, mapPayload]);

  const loadingMap = mapPayload === undefined && String(id || '').toLowerCase() !== 'forest';

  return (
    <div className="hunting-map-wrapper">
      <GameDialogModal
        isOpen={exhaustedModalOpen}
        onClose={handleExhaustedConfirm}
        title="Hết lượt đi săn"
        tone="warning"
        mode="info"
        closeOnOverlayClick={false}
        confirmLabel="Về bản đồ đi săn"
        onConfirm={handleExhaustedConfirm}
      >
        <p className="hunting-map-dialog-text">
          Bạn đã hết lượt bước trên map này. Nhấn xác nhận để trở lại bản đồ đi săn.
        </p>
      </GameDialogModal>

      <GameDialogModal
        isOpen={leaveHuntModalOpen}
        onClose={handleLeaveCancel}
        title="Kết thúc đi săn?"
        tone="default"
        mode="confirm"
        closeOnOverlayClick={false}
        cancelLabel="Cancel"
        confirmLabel="Confirm"
        onCancel={handleLeaveCancel}
        onConfirm={handleLeaveConfirm}
      >
        
          Bạn muốn kết thúc cuộc đi săn không?
        
      </GameDialogModal>

      <div className="hunting-map-toolbar" aria-label="Camera, bước và tốc độ">
        <div className="hunting-map-toolbar-row hunting-map-toolbar-row--steps">
          <span className="hunting-map-toolbar-label">Bước còn</span>
          <span className="hunting-map-steps-value" title="Mỗi ô đi mới trừ 1. Map không giới hạn hiển thị ∞">
            {stepsLabel}
          </span>
          <button
            type="button"
            className="hunting-map-tool-btn hunting-map-tool-wide hunting-map-end-btn"
            onClick={() => setLeaveHuntModalOpen(true)}
            title="Kết thúc đi săn"
          >
            Kết thúc đi săn
          </button>
        </div>
      </div>

      <div ref={gameAreaRef} className="hunting-map-game-area">
        {loadingMap && (
          <div className="hunting-map-loading" aria-live="polite">
            Đang tải map…
          </div>
        )}
        <div className="hunting-floating-controls" aria-label="Điều khiển zoom và tốc độ">
          <div className="hunting-floating-group">
            <span className="hunting-floating-label">Zoom</span>
            <button
              type="button"
              className="hunting-map-tool-btn hunting-map-icon-btn"
              onClick={() => emitCamera('zoomOut')}
              title="Thu nhỏ"
            >
              −
            </button>
            <button
              type="button"
              className="hunting-map-tool-btn hunting-map-icon-btn"
              onClick={() => emitCamera('zoomIn')}
              title="Phóng to"
            >
              +
            </button>
            <button
              type="button"
              className="hunting-map-tool-btn hunting-map-icon-btn"
              onClick={() => emitCamera('zoomReset')}
              title="Zoom mặc định"
            >
              ◎
            </button>
            <button
              type="button"
              className="hunting-map-tool-btn hunting-map-icon-btn"
              onClick={() => emitCamera('zoomFit')}
              title="Lấp đầy map"
            >
              ⤢
            </button>
            <span className="hunting-map-toolbar-value">{zoomLabel}×</span>
          </div>
          <div className="hunting-floating-group">
            <span className="hunting-floating-label">Tốc độ</span>
            <button
              type="button"
              className="hunting-map-tool-btn hunting-map-icon-btn"
              onClick={() => emitSpeed('slower')}
              title="Chậm hơn"
            >
              ◀
            </button>
            <button
              type="button"
              className="hunting-map-tool-btn hunting-map-icon-btn"
              onClick={() => emitSpeed('faster')}
              title="Nhanh hơn"
            >
              ▶
            </button>
            <button
              type="button"
              className="hunting-map-tool-btn hunting-map-icon-btn"
              onClick={() => emitSpeed('speedReset')}
              title="Mặc định"
            >
              ↺
            </button>
            <span className="hunting-map-toolbar-value">{speedLabel}</span>
          </div>
        </div>
        <div ref={containerRef} className="hunting-map-root" />
        <div className="hunting-dpad" aria-label="Giữ nút để đi tiếp theo từng ô">
          <div className="hunting-dpad-row">
            <DpadButton dir="up" label="↑" className="hunting-dpad-up" />
          </div>
          <div className="hunting-dpad-row hunting-dpad-mid">
            <DpadButton dir="left" label="←" />
            <DpadButton dir="down" label="↓" />
            <DpadButton dir="right" label="→" />
          </div>
        </div>
      </div>
    </div>
  );
}


export default HuntingMap;
