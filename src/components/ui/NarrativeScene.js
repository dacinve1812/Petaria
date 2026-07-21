import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TypewriterText from './TypewriterText';
import './NarrativeScene.css';

/**
 * Chuẩn hóa 1 dòng script thành { speaker?, text, portraitSrc? }.
 * Hỗ trợ string hoặc object.
 */
export function normalizeNarrativeLine(line, defaults = {}) {
  if (line == null) return null;
  if (typeof line === 'string') {
    const text = line.trim();
    if (!text) return null;
    return {
      speaker: defaults.speaker || '',
      text,
      portraitSrc: defaults.portraitSrc || '',
    };
  }
  if (typeof line === 'object') {
    const text = String(line.text ?? line.line ?? '').trim();
    if (!text) return null;
    return {
      speaker: String(line.speaker ?? defaults.speaker ?? '').trim(),
      text,
      portraitSrc: String(line.portraitSrc ?? line.portrait ?? defaults.portraitSrc ?? '').trim(),
    };
  }
  return null;
}

/**
 * Thay token `{key}` trong script bằng vars (string/number).
 * Ví dụ: {minPeta}, {cooldownHours}, {amount}, {remaining}
 */
export function applyNarrativeVars(template, vars = {}) {
  const raw = String(template ?? '');
  if (!raw) return '';
  return raw.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
    if (!Object.prototype.hasOwnProperty.call(vars, key)) return match;
    const v = vars[key];
    if (v == null) return '';
    return String(v);
  });
}

/**
 * Hội thoại NPC — chỉ nhân vật + hộp thoại.
 *
 * mode:
 * - 'inline' (mặc định): nằm trong page flow (tương thích cũ)
 * - 'overlay': absolute fill parent / #peta-body — nền lấy từ container_fixed
 *
 * Không còn vẽ nền riêng. Actions (nếu có) chỉ dùng inline legacy; overlay không dùng actions.
 */
function NarrativeScene({
  mode = 'inline',
  speaker = '',
  portraitSrc = '',
  backgroundSrc = '',
  useBackground = false,
  lines = [],
  vars = {},
  typingMsPerChar = 28,
  actions = null,
  showActions = 'never',
  onScriptComplete,
  onAdvance,
  onSkip,
  title = '',
  align = 'left',
  scriptKey = 'default',
  className = '',
  portraitFallback = '/images/character/knight_warrior.jpg',
  emptyText = '…',
}) {
  const normalized = useMemo(() => {
    const defaults = { speaker, portraitSrc };
    return (Array.isArray(lines) ? lines : [])
      .map((l) => normalizeNarrativeLine(l, defaults))
      .filter(Boolean)
      .map((l) => ({
        ...l,
        text: applyNarrativeVars(l.text, vars),
        speaker: applyNarrativeVars(l.speaker || speaker, vars),
      }));
  }, [lines, speaker, portraitSrc, vars]);

  const [index, setIndex] = useState(0);
  const [typingDone, setTypingDone] = useState(false);
  const [forceFull, setForceFull] = useState(false);
  const completedKeyRef = useRef('');

  useEffect(() => {
    setIndex(0);
    setTypingDone(false);
    setForceFull(false);
    completedKeyRef.current = '';
  }, [scriptKey]);

  useEffect(() => {
    setIndex((i) => {
      if (normalized.length === 0) return 0;
      return Math.min(i, normalized.length - 1);
    });
  }, [normalized.length]);

  const safeIndex = normalized.length === 0 ? 0 : Math.min(index, normalized.length - 1);
  const current = normalized[safeIndex] || null;
  const isLast = normalized.length === 0 || safeIndex >= normalized.length - 1;
  const scriptDone = normalized.length === 0 || (isLast && typingDone);

  useEffect(() => {
    if (!scriptDone) return;
    const key = `${scriptKey}:${normalized.length}`;
    if (completedKeyRef.current === key) return;
    completedKeyRef.current = key;
    onScriptComplete?.();
  }, [scriptDone, scriptKey, normalized.length, onScriptComplete]);

  const displayPortrait =
    (current?.portraitSrc || portraitSrc || '').trim() || portraitFallback;
  const displaySpeaker = (current?.speaker || speaker || '').trim();
  const displayText = current?.text || emptyText;

  const goToEnd = useCallback(() => {
    if (normalized.length === 0) {
      setTypingDone(true);
      setForceFull(true);
      onSkip?.();
      return;
    }
    setIndex(normalized.length - 1);
    setForceFull(true);
    setTypingDone(true);
    onSkip?.();
  }, [normalized.length, onSkip]);

  const handleAdvance = useCallback(() => {
    if (!typingDone && current) {
      setForceFull(true);
      setTypingDone(true);
      return;
    }
    if (!isLast) {
      setIndex((i) => i + 1);
      setTypingDone(false);
      setForceFull(false);
      onAdvance?.(safeIndex + 1);
      return;
    }
    onAdvance?.(safeIndex);
  }, [typingDone, current, isLast, onAdvance, safeIndex]);

  const isOverlay = mode === 'overlay';
  const reserveActions = !isOverlay && showActions !== 'never' && actions;
  const revealActions =
    showActions === 'always' || (showActions === 'end' && scriptDone);

  // Legacy: nền chỉ khi inline + bật useBackground (không khuyến nghị)
  const bgEnabled = !isOverlay && useBackground !== false;
  const bgUrl =
    bgEnabled && String(backgroundSrc || '').trim() ? String(backgroundSrc).trim() : '';

  const rootClass = [
    'narrative-scene',
    `narrative-scene--align-${align}`,
    isOverlay ? 'narrative-scene--overlay' : 'narrative-scene--inline',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section className={rootClass} aria-label={title || displaySpeaker || 'Hội thoại'}>
      <div
        className={[
          'narrative-scene__stage',
          bgUrl ? 'narrative-scene__stage--has-bg' : 'narrative-scene__stage--no-bg',
        ].join(' ')}
        style={bgUrl ? { backgroundImage: `url(${bgUrl})` } : undefined}
      >
        {title ? <p className="narrative-scene__title">{title}</p> : null}

        <div className="narrative-scene__cast">
          <div className="narrative-scene__portrait-wrap">
            <img
              className="narrative-scene__portrait"
              src={displayPortrait}
              alt={displaySpeaker || 'NPC'}
              onError={(e) => {
                if (e.currentTarget.src !== portraitFallback) {
                  e.currentTarget.src = portraitFallback;
                }
              }}
            />
          </div>
        </div>

        <div className="narrative-scene__dialog">
          <button
            type="button"
            className="narrative-scene__text"
            onClick={handleAdvance}
            aria-label={
              typingDone
                ? isLast
                  ? 'Kết thúc hội thoại'
                  : 'Câu tiếp theo'
                : 'Hiện hết câu'
            }
          >
            <span className="narrative-scene__text-inner">
              {forceFull ? (
                displayText
              ) : (
                <TypewriterText
                  key={`${scriptKey}-${safeIndex}`}
                  text={displayText}
                  msPerChar={typingMsPerChar}
                  onComplete={() => setTypingDone(true)}
                />
              )}
            </span>
          </button>

          <div className="narrative-scene__rule" aria-hidden>
            <span className="narrative-scene__rule-line" />
            {displaySpeaker ? (
              <span className="narrative-scene__nameplate">
                <span className="narrative-scene__nameplate-gem" aria-hidden />
                <span className="narrative-scene__nameplate-label">{displaySpeaker}</span>
              </span>
            ) : null}
            <span className="narrative-scene__rule-line" />
          </div>

          <div className="narrative-scene__nav">
            <button
              type="button"
              className={`narrative-scene__nav-btn${typingDone && !isLast ? ' is-ready' : ''}`}
              onClick={handleAdvance}
              aria-label="Tiếp"
              title="Tiếp"
            >
              &gt;
            </button>
            <button
              type="button"
              className="narrative-scene__nav-btn narrative-scene__nav-btn--skip"
              onClick={goToEnd}
              aria-label="Bỏ qua hội thoại"
              title="Skip"
              disabled={scriptDone}
            >
              &gt;&gt;|
            </button>
          </div>
        </div>
      </div>

      {reserveActions ? (
        <div
          className={`narrative-scene__actions${revealActions ? ' is-revealed' : ' is-pending'}`}
          aria-hidden={!revealActions}
        >
          {actions}
        </div>
      ) : null}
    </section>
  );
}

export default NarrativeScene;
