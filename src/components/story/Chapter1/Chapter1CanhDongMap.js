import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useIsMobile from '../../../hooks/useIsMobile';
import useMapImageReady from '../../../hooks/useMapImageReady';
import './Chapter1CanhDongMap.css';
import layoutFile from './chapter1CanhDongLayout.json';
import {
  ASSET,
  CHEST_COPY,
  CHEST_MARKS,
  HUBS,
  STAR_EACH,
  STAR_MAX,
  STAGES,
  STORY_LENGTH,
  SUMMARY,
  THEME,
  beatBox,
  currentStage,
  emptyProgress,
  hubForStage,
  loadProgress,
  saveProgress,
  stageState,
} from './chapter1CanhDongData';

function img(name) {
  return `${ASSET}${name}.png`;
}

function canvasSize(vp, map, zoom) {
  const cover = Math.max(vp.w / map.width, vp.h / map.height);
  const scale = cover * zoom;
  return { w: map.width * scale, h: map.height * scale, scale };
}

function clampPan(pan, size, vp) {
  const x = size.w <= vp.w ? (vp.w - size.w) / 2 : Math.min(0, Math.max(vp.w - size.w, pan.x));
  const y = size.h <= vp.h ? (vp.h - size.h) / 2 : Math.min(0, Math.max(vp.h - size.h, pan.y));
  return { x, y };
}

function boxCenter(box) {
  const [x1, y1, x2, y2] = Array.isArray(box) ? box : [0, 0, 0, 0];
  return { x: (Number(x1) + Number(x2)) / 2, y: (Number(y1) + Number(y2)) / 2 };
}

function centerOn(box, size, map, vp) {
  const point = boxCenter(box);
  return {
    x: vp.w / 2 - (point.x / map.width) * size.w,
    y: vp.h / 2 - (point.y / map.height) * size.h,
  };
}

function poly(boxes) {
  return boxes.map((box) => {
    const point = boxCenter(box);
    return `${point.x},${point.y}`;
  }).join(' ');
}

function anchor(box, map) {
  const point = boxCenter(box);
  return {
    left: `${(point.x / map.width) * 100}%`,
    top: `${(point.y / map.height) * 100}%`,
  };
}

function Chapter1CanhDongMap() {
  const navigate = useNavigate();
  const isMobile = useIsMobile(860);
  const map = isMobile ? layoutFile.mobile : layoutFile.desktop;
  const mapReady = useMapImageReady(map.src);
  const vpRef = useRef(null);
  const pinchRef = useRef(null);
  const dragRef = useRef(null);
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [mode, setMode] = useState('stages');
  const [progress, setProgress] = useState(loadProgress);
  const [selected, setSelected] = useState(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast, setToast] = useState('');

  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  const progressRef = useRef(progress);
  zoomRef.current = zoom;
  panRef.current = pan;
  progressRef.current = progress;

  useEffect(() => {
    document.body.classList.add('ch1-story-map');
    return () => document.body.classList.remove('ch1-story-map');
  }, []);

  useEffect(() => {
    const el = vpRef.current;
    if (!el) return undefined;
    const read = () => setVp({ w: el.clientWidth, h: el.clientHeight });
    read();
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const size = useMemo(
    () => (vp.w ? canvasSize(vp, map, zoom) : { w: map.width, h: map.height, scale: 1 }),
    [vp, map, zoom]
  );

  const focusBox = useCallback((box, nextZoom = zoomRef.current) => {
    if (!vp.w || !box) return;
    const nextSize = canvasSize(vp, map, nextZoom);
    setZoom(nextZoom);
    setPan(clampPan(centerOn(box, nextSize, map, vp), nextSize, vp));
  }, [vp, map]);

  const centeredFor = useRef('');
  useEffect(() => {
    if (!vp.w) return;
    const key = isMobile ? 'mobile' : 'desktop';
    const activeZoom = centeredFor.current === key ? zoomRef.current : 1;
    const nextSize = canvasSize(vp, map, activeZoom);
    if (centeredFor.current !== key) {
      centeredFor.current = key;
      setZoom(1);
      setPan(clampPan({
        x: (vp.w - nextSize.w) / 2,
        y: (vp.h - nextSize.h) / 2,
      }, nextSize, vp));
      return;
    }
    setPan((current) => clampPan(current, nextSize, vp));
  }, [isMobile, vp, map]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      setSelected(null);
      setInfoOpen(false);
      setSheetOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const el = vpRef.current;
    if (!el) return undefined;
    const onWheel = (event) => {
      event.preventDefault();
      const prevZoom = zoomRef.current;
      const nextZoom = Math.min(2.8, Math.max(1, prevZoom * (event.deltaY > 0 ? 0.92 : 1.08)));
      if (nextZoom === prevZoom || !vp.w) return;
      const prevSize = canvasSize(vp, map, prevZoom);
      const nextSize = canvasSize(vp, map, nextZoom);
      const cx = vp.w / 2 - panRef.current.x;
      const cy = vp.h / 2 - panRef.current.y;
      const k = nextSize.w / prevSize.w;
      setZoom(nextZoom);
      setPan(clampPan({
        x: vp.w / 2 - cx * k,
        y: vp.h / 2 - cy * k,
      }, nextSize, vp));
    };
    const stopPinchScroll = (event) => {
      if (event.touches && event.touches.length > 1) event.preventDefault();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchmove', stopPinchScroll, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchmove', stopPinchScroll);
    };
  }, [vp, map]);

  const apply = (next) => {
    saveProgress(next);
    setProgress(next);
  };

  const openStage = (n) => {
    const stage = STAGES[n - 1];
    setSelected(n);
    setSheetOpen(false);
    setInfoOpen(false);
    focusBox(beatBox(map, stage));
  };

  const completeStage = (n) => {
    if (stageState(n, progress.cleared) !== 'current') return;
    apply({ ...progress, cleared: n });
    if (n === STORY_LENGTH) {
      setToast('Chuyến giao thư đã kết thúc. Dấu đường hoa cũ còn chờ ở Thành Vinh Quang.');
    }
  };

  const claimChest = (mark) => {
    if (progress.cleared < mark) {
      setToast('Rương này mở khi xong mốc truyện tương ứng.');
      return;
    }
    if (progress.chests[mark]) {
      setToast(CHEST_COPY[mark]);
      return;
    }
    apply({ ...progress, chests: { ...progress.chests, [mark]: true } });
    setToast(CHEST_COPY[mark]);
  };

  const resetStory = () => {
    apply(emptyProgress());
    setSelected(1);
    setInfoOpen(false);
    focusBox(beatBox(map, STAGES[0]), 1);
  };

  const onPointerDown = (event) => {
    if (event.button != null && event.button !== 0) return;
    if (event.target.closest('button, a')) return;
    dragRef.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId || pinchRef.current) return;
    const next = clampPan({
      x: drag.panX + (event.clientX - drag.x),
      y: drag.panY + (event.clientY - drag.y),
    }, size, vp);
    setPan(next);
  };

  const onPointerUp = (event) => {
    if (dragRef.current?.id === event.pointerId) dragRef.current = null;
  };

  const onTouchStart = (event) => {
    if (event.touches.length !== 2) return;
    const [a, b] = event.touches;
    pinchRef.current = {
      dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
      zoom,
    };
  };

    const onTouchMove = (event) => {
    if (event.touches.length !== 2 || !pinchRef.current || !vp.w) return;
    const [a, b] = event.touches;
    const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const nextZoom = Math.min(2.8, Math.max(1, pinchRef.current.zoom * (dist / pinchRef.current.dist)));
    const prevSize = canvasSize(vp, map, zoomRef.current);
    const nextSize = canvasSize(vp, map, nextZoom);
    const cx = vp.w / 2 - panRef.current.x;
    const cy = vp.h / 2 - panRef.current.y;
    const k = nextSize.w / prevSize.w;
    setZoom(nextZoom);
    setPan(clampPan({ x: vp.w / 2 - cx * k, y: vp.h / 2 - cy * k }, nextSize, vp));
  };

  const onTouchEnd = () => {
    pinchRef.current = null;
  };

  const cleared = progress.cleared;
  const current = currentStage(cleared);
  const stars = cleared * STAR_EACH;
  const shownStages = STAGES.filter((item) => {
    if (item.kind === 'hub') return false;
    if (item.n > current) return false;
    if (mode === 'explore' && item.n < current) return false;
    return true;
  });
  const routeStages = STAGES.filter((item) => item.n <= current && (item.kind === 'hub' || item.n === current || mode === 'stages'));
  const routePoints = routeStages.map((item) => beatBox(map, item)).filter(Boolean);
  const donePoints = routeStages.filter((item) => item.n <= cleared).map((item) => beatBox(map, item)).filter(Boolean);
  const stage = selected ? STAGES[selected - 1] : null;
  const stageHub = stage ? hubForStage(stage.n) : null;

  return (
    <div className={`ch1-shell${isMobile ? ' is-mobile' : ''}`}>
      <div
        ref={vpRef}
        className={`ch1-viewport map-reveal${mapReady ? ' is-ready' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="ch1-canvas map-reveal-art"
          style={{ width: size.w, height: size.h, transform: `translate(${pan.x}px, ${pan.y}px)` }}
        >
          <img className="ch1-art" src={map.src} alt="Cánh Đồng Vạn Hoa" draggable={false} />
          <svg className="ch1-route" viewBox={`0 0 ${map.width} ${map.height}`} aria-hidden>
            {routePoints.length > 1 && (
              <polyline className="ch1-route-future" points={poly(routePoints)} />
            )}
            {donePoints.length > 1 && (
              <polyline className="ch1-route-done" points={poly(donePoints)} />
            )}
          </svg>

          {HUBS.map((hub) => {
            const open = cleared >= hub.stage;
            const reached = current >= hub.stage;
            return (
              <button
                key={hub.id}
                type="button"
                className={`ch1-hub${reached ? ' is-open' : ' is-locked'}`}
                style={anchor(map.hubs[hub.id], map)}
                onClick={() => (open ? navigate(hub.to) : openStage(hub.stage))}
              >
                <img src={img('scroll')} alt="" draggable={false} />
                <span className="ch1-hub-name">{hub.name}</span>
                <span className="ch1-hub-icons">
                  {hub.icons.map((icon) => (
                    <img key={icon} src={img(icon)} alt="" draggable={false} />
                  ))}
                </span>
                {!reached && <img className="ch1-hub-lock" src={img('icon-lock')} alt="" draggable={false} />}
              </button>
            );
          })}

          {shownStages.map((item) => {
            const state = stageState(item.n, cleared);
            const box = beatBox(map, item);
            if (!box) return null;
            return (
              <button
                key={item.id}
                type="button"
                className={`ch1-node ch1-node--${item.role} is-${state}${selected === item.n ? ' is-selected' : ''}`}
                style={anchor(box, map)}
                onClick={() => openStage(item.n)}
                aria-label={item.name}
              >
                {item.role === 'boss' ? (
                  <img src={img('boss-emblem')} alt="" draggable={false} />
                ) : item.role === 'mini' ? (
                  <img src={img('icon-swords')} alt="" draggable={false} />
                ) : item.role === 'elite' ? (
                  <>
                    <img className="ch1-node-star" src={img('ui-star')} alt="" draggable={false} />
                    <span>{item.name}</span>
                  </>
                ) : (
                  <span>{item.n}</span>
                )}
                {(item.role === 'mini' || item.role === 'boss') && (
                  <span className="ch1-node-caption">
                    {item.role === 'boss' ? 'BOSS' : item.name}
                  </span>
                )}
              </button>
            );
          })}

          <button
            type="button"
            className="ch1-start"
            style={anchor(map.start, map)}
            onClick={() => openStage(current)}
          >
            <img src={img('sign-start')} alt="" draggable={false} />
            <span>START</span>
          </button>
        </div>
        <div className="map-reveal-veil" aria-hidden={mapReady}>
          <span>Loading ...</span>
        </div>
      </div>

      <header className="ch1-top">
        <button type="button" className="ch1-back" onClick={() => navigate('/world-map')}>
          <img src={img('ui-back')} alt="" draggable={false} />
          {!isMobile && <span>World Map</span>}
        </button>

        <div className="ch1-heading">
          {!isMobile && <img className="ch1-flower" src={img('ui-flower-l')} alt="" draggable={false} />}
          <div>
            <h2>Cánh Đồng Vạn Hoa</h2>
            <p>Những hạt giống thất lạc</p>
          </div>
          {!isMobile && <img className="ch1-flower" src={img('ui-flower-r')} alt="" draggable={false} />}
        </div>

        <div className="ch1-top-actions">
          <div className="ch1-toggle" role="tablist" aria-label="Chế độ bản đồ">
            <button type="button" role="tab" aria-selected={mode === 'explore'} className={mode === 'explore' ? 'is-on' : ''} onClick={() => setMode('explore')}>
              <img src={img('icon-pin')} alt="" draggable={false} />
              Explore
            </button>
            <button type="button" role="tab" aria-selected={mode === 'stages'} className={mode === 'stages' ? 'is-on' : ''} onClick={() => setMode('stages')}>
              <img src={img('icon-swords')} alt="" draggable={false} />
              Stages
            </button>
          </div>
          {isMobile && (
            <button type="button" className="ch1-journey" onClick={() => setSheetOpen(true)}>
              Cốt truyện
            </button>
          )}
          <button type="button" className="ch1-region-btn" onClick={() => { setInfoOpen(true); setSelected(null); }}>
            <img src={img('ui-book')} alt="" draggable={false} />
            {!isMobile && <span>Region Info</span>}
          </button>
        </div>
      </header>

      <footer className="ch1-bottom">
        <div className="ch1-progress">
          <span className="ch1-progress-label">Chapter Progress</span>
          <div className="ch1-progress-track">
            <i style={{ width: `${(cleared / STORY_LENGTH) * 100}%` }} />
            <em>{cleared}/{STORY_LENGTH}</em>
          </div>
          <div className="ch1-chests">
            {CHEST_MARKS.map((mark) => {
              const ready = cleared >= mark && !progress.chests[mark];
              const claimed = progress.chests[mark];
              return (
                <button
                  key={mark}
                  type="button"
                  className={`ch1-chest${ready ? ' is-ready' : ''}${claimed ? ' is-claimed' : ''}`}
                  onClick={() => claimChest(mark)}
                >
                  <img src={img('chest')} alt="" draggable={false} />
                  <small>{mark}</small>
                </button>
              );
            })}
          </div>
        </div>
      </footer>

      {isMobile && (
        <>
          <button type="button" className="ch1-compass" onClick={() => focusBox(beatBox(map, STAGES[current - 1]), 1)} aria-label="Về chặng hiện tại">
            <img src={img('ui-compass')} alt="" draggable={false} />
          </button>
          <div className="ch1-mobile-star">
            <img src={img('ui-star')} alt="" draggable={false} />
            {stars}/{STAR_MAX}
          </div>
        </>
      )}

      {stage && (
        <section className="ch1-detail" role="dialog" aria-labelledby="ch1-detail-title">
          <button type="button" className="ch1-close" onClick={() => setSelected(null)} aria-label="Đóng">×</button>
          <p className="ch1-kicker">{stageState(stage.n, cleared) === 'cleared' ? 'Đã qua' : stageState(stage.n, cleared) === 'current' ? 'Đang tới' : 'Chưa mở'}</p>
          <h3 id="ch1-detail-title">{stage.name}</h3>
          <div className="ch1-tags">
            {stage.tags.map((tag) => <span key={tag}>{tag}</span>)}
          </div>
          <p className="ch1-beat">{stage.beat}</p>
          {stage.lines?.map((entry) => (
            <p key={entry.text} className="ch1-line">
              <b>{entry.speaker}:</b> {entry.text}
            </p>
          ))}
          {stageState(stage.n, cleared) === 'current' && (
            <>
              <button type="button" className="ch1-primary" onClick={() => completeStage(stage.n)}>
                {stage.n === STORY_LENGTH ? 'Kết thúc chương' : 'Đi tiếp'}
              </button>
              {stage.tags.some((tag) => tag === 'Chiến đấu' || tag === 'Mini Boss' || tag === 'Elite' || tag === 'Boss vùng') && (
                <p className="ch1-note">EXP và Peta vẫn thuộc về trận đấu. Bước này chỉ mở lối truyện, không cộng thưởng thêm.</p>
              )}
            </>
          )}
          {stageState(stage.n, cleared) === 'locked' && (
            <p className="ch1-note">Hãy xong «{STAGES[cleared]?.name || STAGES[0].name}» trước. Chỗ đã mở không cần đánh lại.</p>
          )}
          {stageHub && cleared >= stageHub.stage && (
            <button type="button" className="ch1-primary ch1-primary--ghost" onClick={() => navigate(stageHub.to)}>
              Đến {stageHub.name}
            </button>
          )}
        </section>
      )}

      {infoOpen && (
        <section className="ch1-info" role="dialog" aria-labelledby="ch1-info-title">
          <button type="button" className="ch1-close" onClick={() => setInfoOpen(false)} aria-label="Đóng">×</button>
          <p className="ch1-kicker">Chapter 1</p>
          <h3 id="ch1-info-title">Những hạt giống thất lạc</h3>
          <p className="ch1-beat">{SUMMARY}</p>
          <p className="ch1-note">{THEME}</p>
          <ul className="ch1-hub-list">
            {HUBS.map((hub) => (
              <li key={hub.id}>
                <b>{hub.name}</b>
                <span>{hub.blurb}</span>
              </li>
            ))}
          </ul>
          <button type="button" className="ch1-text-btn" onClick={resetStory}>Đọc lại từ đầu</button>
        </section>
      )}

      {sheetOpen && (
        <section className="ch1-sheet" role="dialog" aria-label="Cốt truyện chương 1">
          <header>
            <strong>Những hạt giống thất lạc</strong>
            <button type="button" onClick={() => setSheetOpen(false)}>Đóng</button>
          </header>
          <ol>
            {STAGES.map((item) => {
              const state = stageState(item.n, cleared);
              return (
                <li key={item.n}>
                  <button type="button" className={`is-${state}`} onClick={() => openStage(item.n)}>
                    <em>{item.kind === 'hub' ? 'Nơi' : item.role === 'boss' ? 'Boss' : 'Trận'}</em>
                    <span>{item.name}</span>
                    <small>{item.tags[0]}</small>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {toast && <div className="ch1-toast" role="status">{toast}</div>}
    </div>
  );
}

export default Chapter1CanhDongMap;
