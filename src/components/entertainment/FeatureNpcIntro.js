import React, { useEffect, useState } from 'react';
import GameDialogModal from '../ui/GameDialogModal';
import { applyNarrativeVars } from '../ui/NarrativeScene';

/**
 * Map admin narrative → props FeatureNpcIntro.
 * Trống speaker/portrait/greeting vẫn hợp lệ (placeholder layout).
 */
export function buildFeatureNpcProps(narrative = {}, vars = {}, fallbacks = {}) {
  const n = narrative && typeof narrative === 'object' ? narrative : {};
  const speaker = String(n.speaker || fallbacks.speaker || '').trim();
  const portraitSrc = String(n.portraitSrc || fallbacks.portraitSrc || '').trim();
  const lorePortraitSrc = String(n.lorePortraitSrc || '').trim();
  const rawLines =
    Array.isArray(n.lines) && n.lines.length
      ? n.lines
      : Array.isArray(fallbacks.lines)
        ? fallbacks.lines
        : [];
  const loreLines = rawLines.map((l) => applyNarrativeVars(l, vars));
  const greetingRaw = String(n.greeting ?? fallbacks.greeting ?? '').trim();
  const greeting = greetingRaw
    ? applyNarrativeVars(greetingRaw, vars)
    : loreLines[0] || '';
  return { speaker, portraitSrc, lorePortraitSrc, greeting, loreLines };
}

/**
 * Intro nhân vật trên trang (pattern Mystery Box).
 * Có thể để trống ảnh/NPC — vẫn giữ khung dialog + nút ?.
 */
function FeatureNpcIntro({
  speaker = '',
  portraitSrc = '',
  lorePortraitSrc = '',
  greeting = '',
  loreLines = [],
  portraitAlt = '',
  portraitFallback = '',
}) {
  const [loreOpen, setLoreOpen] = useState(false);
  const hasPortrait = Boolean(String(portraitSrc || '').trim());
  const hasLorePortrait = Boolean(
    String(lorePortraitSrc || portraitSrc || portraitFallback || '').trim(),
  );
  const stageDefault = portraitSrc || portraitFallback || '';
  const loreDefault = lorePortraitSrc || portraitSrc || portraitFallback || '';
  const [stageImg, setStageImg] = useState(stageDefault);
  const [loreImg, setLoreImg] = useState(loreDefault);

  useEffect(() => {
    setStageImg(portraitSrc || portraitFallback || '');
  }, [portraitSrc, portraitFallback]);

  useEffect(() => {
    setLoreImg(lorePortraitSrc || portraitSrc || portraitFallback || '');
  }, [lorePortraitSrc, portraitSrc, portraitFallback]);

  const name = String(speaker || '').trim() || '…';
  const lines = (Array.isArray(loreLines) ? loreLines : [])
    .map((l) => String(l || '').trim())
    .filter(Boolean);
  const greetingText = String(greeting || lines[0] || '').trim();
  const loreBody =
    lines.length > 0
      ? lines
      : greetingText
        ? [greetingText]
        : ['Hội thoại sẽ được cập nhật sớm.'];

  const openLore = () => setLoreOpen(true);

  return (
    <>
      <div className={`ec-feature-stage${hasPortrait ? '' : ' ec-feature-stage--no-portrait'}`}>
        {hasPortrait ? (
          <div className="ec-feature-visual">
            <button
              type="button"
              className="ec-feature-portrait-btn"
              onClick={openLore}
              aria-label={`Mở hội thoại ${name}`}
            >
              <img
                className="ec-feature-hero"
                src={stageImg}
                alt={portraitAlt || name}
                draggable={false}
                onError={() => {
                  if (portraitFallback) setStageImg(portraitFallback);
                }}
              />
            </button>
          </div>
        ) : null}

        <section className="ec-feature-dialog" aria-label={name}>
          <div className="ec-feature-dialog__rule">
            <span className="ec-feature-dialog__rule-line" aria-hidden />
            <span className="ec-feature-dialog__name-wrap">
              <span className="ec-feature-dialog__gem" aria-hidden />
              <span className="ec-feature-dialog__nameplate">
                <span className="ec-feature-dialog__name">{name}</span>
                <button
                  type="button"
                  className="modal-help-icon-btn ec-feature-help-btn"
                  onClick={openLore}
                  aria-label={`Xem hội thoại ${name}`}
                  title={`Hội thoại ${name}`}
                >
                  ?
                </button>
              </span>
            </span>
            <span className="ec-feature-dialog__rule-line" aria-hidden />
          </div>
          <div className="ec-feature-dialog__body">
            <p>{greetingText || 'Hội thoại sẽ được cập nhật sớm.'}</p>
          </div>
        </section>
      </div>

      <GameDialogModal
        isOpen={loreOpen}
        onClose={() => setLoreOpen(false)}
        title={name === '…' ? 'Hội thoại' : name}
        mode="alert"
        confirmLabel="Đóng"
        tone="info"
        onConfirm={() => setLoreOpen(false)}
        className="ec-feature-lore-modal"
      >
        <div className="ec-feature-lore">
          {hasLorePortrait ? (
            <img
              className="ec-feature-lore__img"
              src={loreImg}
              alt=""
              onError={() => {
                if (portraitFallback) setLoreImg(portraitFallback);
              }}
            />
          ) : null}
          <div className="ec-feature-lore__dialog">
            <div className="ec-feature-dialog__rule" aria-hidden>
              <span className="ec-feature-dialog__rule-line" />
              <span className="ec-feature-dialog__name-wrap">
                <span className="ec-feature-dialog__gem" aria-hidden />
                <span className="ec-feature-dialog__nameplate">
                  <span className="ec-feature-dialog__name">{name}</span>
                </span>
              </span>
              <span className="ec-feature-dialog__rule-line" />
            </div>
            <div className="ec-feature-dialog__body">
              {loreBody.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </div>
        </div>
      </GameDialogModal>
    </>
  );
}

export default FeatureNpcIntro;
