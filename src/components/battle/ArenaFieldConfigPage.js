import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import TemplatePage from '../template/TemplatePage';
import formationSystem from '../../data/formationSystem';
import {
  ARENA_FIELD_CONFIG,
  ARENA_FIELD_CONFIG_PATH,
  loadArenaFieldConfig,
  listFormationsForConfigMode,
  scaleFromTop,
} from '../../data/arenaFieldConfig';
import '../css/ArenaBattlePage.css';
import './ArenaFieldConfigPage.css';

const { getFormation, getLineIndices } = formationSystem;

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function Marker({
  side,
  line,
  index,
  left,
  top,
  scale,
  selected,
  onSelect,
  onDragStart,
}) {
  return (
    <button
      type="button"
      className={[
        'afc-marker',
        `afc-marker--${side}`,
        `afc-marker--${line}`,
        selected ? 'afc-marker--selected' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        left: `${left}%`,
        top: `${top}%`,
        transform: `translate(-50%, -78%) scale(${scale})`,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onPointerDown={(e) => onDragStart(e)}
      title={`${side} ${line} #${index + 1}`}
    >
      <span className="afc-marker__badge">
        {line === 'back' ? 'B' : 'F'}
        {index + 1}
      </span>
      <span className="afc-marker__dot" />
      <span className="afc-marker__label">
        {Math.round(left)}/{Math.round(top)}
      </span>
    </button>
  );
}

function ArenaFieldConfigPage() {
  const [mode, setMode] = useState('5v5');
  const formations = useMemo(() => listFormationsForConfigMode(mode), [mode]);
  const [formationId, setFormationId] = useState(formations[0] || '3-2');
  const [config, setConfig] = useState(() => loadArenaFieldConfig());
  const [selected, setSelected] = useState({ line: 'back', index: 0 });
  const [flash, setFlash] = useState('');
  const [drag, setDrag] = useState(null);

  useEffect(() => {
    const list = listFormationsForConfigMode(mode);
    if (!list.includes(formationId)) setFormationId(list[0]);
  }, [mode, formationId]);

  const layout = config.formations[formationId] || ARENA_FIELD_CONFIG.formations[formationId];
  const meta = getFormation(formationId);
  const lines = getLineIndices(formationId);
  const is3v3 = mode === '3v3';

  const selectedPos =
    selected.line === 'back'
      ? layout?.back?.[selected.index]
      : layout?.front?.[selected.index];

  const flashMsg = (msg) => {
    setFlash(msg);
    window.setTimeout(() => setFlash(''), 2800);
  };

  const updatePos = useCallback(
    (line, index, next) => {
      setConfig((prev) => {
        const copy = clone(prev);
        if (!copy.formations[formationId]) {
          copy.formations[formationId] = clone(ARENA_FIELD_CONFIG.formations[formationId]);
        }
        const arr = copy.formations[formationId][line];
        if (!arr?.[index]) return prev;
        arr[index] = {
          left: Math.max(0, Math.min(50, Number(next.left))),
          top: Math.max(0, Math.min(100, Number(next.top))),
        };
        return copy;
      });
    },
    [formationId]
  );

  const handleArenaPointerMove = (e) => {
    if (!drag) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const left = Math.max(2, Math.min(48, x));
    const top = Math.max(5, Math.min(95, y));
    updatePos(drag.line, drag.index, { left, top });
  };

  const endDrag = () => setDrag(null);

  const handleResetFormation = () => {
    const def = ARENA_FIELD_CONFIG.formations[formationId];
    if (!def) return;
    setConfig((prev) => {
      const copy = clone(prev);
      copy.formations[formationId] = clone(def);
      return copy;
    });
  };

  const handleResetAll = () => {
    setConfig(loadArenaFieldConfig());
    flashMsg('Đã reset về config trong project.');
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'arena-field-config.json';
    a.click();
    URL.revokeObjectURL(url);
    flashMsg('Đã export JSON — paste vào src/data/arenaFieldConfig.js để áp dụng.');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(config, null, 2));
      flashMsg('Đã copy JSON vào clipboard.');
    } catch {
      flashMsg('Không copy được — dùng Export JSON.');
    }
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        if (!parsed?.formations) throw new Error('missing formations');
        setConfig({
          version: Number(parsed.version) || 1,
          formations: { ...loadArenaFieldConfig().formations, ...parsed.formations },
        });
        flashMsg('Đã import (preview only — Export rồi cập nhật file project).');
      } catch {
        flashMsg('File JSON không hợp lệ.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const markers = [];
  (layout?.back || []).forEach((p, i) => {
    markers.push({
      key: `p-back-${i}`,
      side: 'player',
      line: 'back',
      index: i,
      left: p.left,
      top: p.top,
      scale: scaleFromTop(p.top, is3v3),
    });
    markers.push({
      key: `e-back-${i}`,
      side: 'enemy',
      line: 'back',
      index: i,
      left: 100 - p.left,
      top: p.top,
      scale: scaleFromTop(p.top, is3v3),
      mirror: true,
    });
  });
  (layout?.front || []).forEach((p, i) => {
    markers.push({
      key: `p-front-${i}`,
      side: 'player',
      line: 'front',
      index: i,
      left: p.left,
      top: p.top,
      scale: scaleFromTop(p.top, is3v3),
    });
    markers.push({
      key: `e-front-${i}`,
      side: 'enemy',
      line: 'front',
      index: i,
      left: 100 - p.left,
      top: p.top,
      scale: scaleFromTop(p.top, is3v3),
      mirror: true,
    });
  });
  markers.sort((a, b) => a.top - b.top);

  return (
    <TemplatePage showSearch={false} showTabs={false}>
      <div className="afc-page">
        <header className="afc-header">
          <div>
            <h1 className="afc-title">Arena Field Config</h1>
            <p className="afc-path">
              Path: <code>{ARENA_FIELD_CONFIG_PATH}</code>
            </p>
            <p className="afc-hint">
              Preview / chỉnh layout. Battle đọc từ{' '}
              <code>src/data/arenaFieldConfig.js</code> (không dùng localStorage).
            </p>
          </div>
          <div className="afc-header__actions">
            <Link className="afc-link" to="/battle/champion">
              Champion
            </Link>
            <Link className="afc-link" to="/battle">
              Battle hub
            </Link>
          </div>
        </header>

        <div className="afc-toolbar">
          <div className="afc-seg" role="group" aria-label="Mode">
            {['3v3', '5v5'].map((m) => (
              <button
                key={m}
                type="button"
                className={`afc-seg__btn${mode === m ? ' afc-seg__btn--on' : ''}`}
                onClick={() => setMode(m)}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="afc-seg afc-seg--wrap" role="group" aria-label="Formation">
            {formations.map((id) => (
              <button
                key={id}
                type="button"
                className={`afc-seg__btn${formationId === id ? ' afc-seg__btn--on' : ''}`}
                onClick={() => {
                  setFormationId(id);
                  setSelected({ line: 'back', index: 0 });
                }}
              >
                {id}
              </button>
            ))}
          </div>
        </div>

        <p className="afc-meta">
          {meta?.name} — {meta?.title} · back {lines.back.length} / front {lines.front.length}
        </p>

        <div className="afc-workspace">
          <div
            className={`afc-arena abm-arena${is3v3 ? ' abm-arena--3v3' : ''}`}
            onPointerMove={handleArenaPointerMove}
            onPointerUp={endDrag}
            onPointerLeave={endDrag}
            onClick={() => setDrag(null)}
          >
            <div className="abm-arena__floor" aria-hidden>
              <div className="abm-arena__floor-ring" />
              <div className="abm-arena__floor-glow" />
              <div className="abm-arena__vanish" />
            </div>
            <div className="afc-arena__cast">
              {markers.map((m) => (
                <Marker
                  key={m.key}
                  side={m.side}
                  line={m.line}
                  index={m.index}
                  left={m.left}
                  top={m.top}
                  scale={m.scale}
                  selected={
                    !m.mirror &&
                    selected.line === m.line &&
                    selected.index === m.index
                  }
                  onSelect={() => {
                    if (m.mirror) return;
                    setSelected({ line: m.line, index: m.index });
                  }}
                  onDragStart={(e) => {
                    if (m.mirror) return;
                    e.currentTarget.setPointerCapture?.(e.pointerId);
                    setSelected({ line: m.line, index: m.index });
                    setDrag({ line: m.line, index: m.index });
                  }}
                />
              ))}
            </div>
          </div>

          <aside className="afc-side">
            <h2 className="afc-side__title">Slot đang chọn</h2>
            {selectedPos ? (
              <div className="afc-fields">
                <label className="afc-field">
                  <span>
                    {selected.line === 'back' ? 'Back' : 'Front'} #{selected.index + 1} — left %
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    step={0.5}
                    value={selectedPos.left}
                    onChange={(e) =>
                      updatePos(selected.line, selected.index, {
                        left: e.target.value,
                        top: selectedPos.top,
                      })
                    }
                  />
                </label>
                <label className="afc-field">
                  <span>top %</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={selectedPos.top}
                    onChange={(e) =>
                      updatePos(selected.line, selected.index, {
                        left: selectedPos.left,
                        top: e.target.value,
                      })
                    }
                  />
                </label>
                <p className="afc-enemy-note">
                  Enemy mirror: left {Math.round(100 - selectedPos.left)}% / top{' '}
                  {Math.round(selectedPos.top)}%
                </p>
              </div>
            ) : (
              <p className="afc-hint">Chọn một marker player.</p>
            )}

            <div className="afc-slot-list">
              <h3>Back</h3>
              {(layout?.back || []).map((p, i) => (
                <button
                  key={`b-${i}`}
                  type="button"
                  className={`afc-slot-row${
                    selected.line === 'back' && selected.index === i
                      ? ' afc-slot-row--on'
                      : ''
                  }`}
                  onClick={() => setSelected({ line: 'back', index: i })}
                >
                  B{i + 1}: {p.left} , {p.top}
                </button>
              ))}
              <h3>Front</h3>
              {(layout?.front || []).map((p, i) => (
                <button
                  key={`f-${i}`}
                  type="button"
                  className={`afc-slot-row${
                    selected.line === 'front' && selected.index === i
                      ? ' afc-slot-row--on'
                      : ''
                  }`}
                  onClick={() => setSelected({ line: 'front', index: i })}
                >
                  F{i + 1}: {p.left} , {p.top}
                </button>
              ))}
            </div>

            <div className="afc-actions">
              <button type="button" className="afc-btn afc-btn--primary" onClick={handleExport}>
                Export JSON
              </button>
              <button type="button" className="afc-btn" onClick={handleCopy}>
                Copy JSON
              </button>
              <button type="button" className="afc-btn" onClick={handleResetFormation}>
                Reset formation này
              </button>
              <button type="button" className="afc-btn" onClick={handleResetAll}>
                Reset tất cả
              </button>
              <label className="afc-btn afc-btn--file">
                Import JSON (preview)
                <input type="file" accept="application/json,.json" onChange={handleImport} hidden />
              </label>
            </div>
            {flash ? <p className="afc-flash">{flash}</p> : null}
          </aside>
        </div>
      </div>
    </TemplatePage>
  );
}

export default ArenaFieldConfigPage;
