import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import TypewriterText from '../../ui/TypewriterText';
import './OpeningReel.css';

/**
 * Opening reel — màn kể chuyện toàn màn hình.
 * Chương sau chỉ cần truyền ảnh, câu chữ hoặc thẻ tiêu đề.
 */
function useMobileReel() {
  const query = '(max-width: 599px)';
  const [mobile, setMobile] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const media = window.matchMedia(query);
    const sync = () => setMobile(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  return mobile;
}

export default function OpeningReel({
  imageSrc,
  mobileImageSrc = '',
  stepKey,
  line = '',
  title = '',
  subtitle = '',
  onAdvance,
  onSkip,
}) {
  const mobile = useMobileReel();
  const src = mobile && mobileImageSrc ? mobileImageSrc : imageSrc;
  const [ratio, setRatio] = useState(0);
  const [phase, setPhase] = useState('in');
  const [typed, setTyped] = useState(false);
  const [rush, setRush] = useState(false);
  const timer = useRef(0);
  const advanceRef = useRef(onAdvance);
  advanceRef.current = onAdvance;

  useEffect(() => {
    document.body.classList.add('ch0-opening-reel');
    return () => {
      document.body.classList.remove('ch0-opening-reel');
      window.clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    setRatio(0);
  }, [src]);

  const rememberSize = (event) => {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    if (naturalWidth && naturalHeight) setRatio(naturalWidth / naturalHeight);
  };

  useEffect(() => {
    setPhase('in');
    setTyped(!line);
    setRush(false);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const id = window.setTimeout(() => setPhase('hold'), reduce ? 0 : 900);
    return () => window.clearTimeout(id);
  }, [stepKey, line]);

  const advance = () => {
    if (phase !== 'hold') return;
    if (line && !typed) {
      setRush(true);
      setTyped(true);
      return;
    }
    setPhase('out');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => advanceRef.current?.(), reduce ? 0 : 700);
  };

  return createPortal(
    <div className="ch0-opening-reel" role="dialog" aria-label="Opening reel">
      <button type="button" className={`ch0-opening-reel__stage${mobile ? ' is-mobile' : ''}`} onClick={advance}>
        <img className="ch0-opening-reel__wash" src={src} alt="" />
        <span
          className="ch0-opening-reel__frame"
          style={!mobile && ratio ? { '--reel-ratio': String(ratio) } : undefined}
        >
          <img className="ch0-opening-reel__img" src={src} alt="" onLoad={rememberSize} />
          <span className="ch0-opening-reel__dim" />
          {phase === 'hold' && line ? (
            <span className="ch0-opening-reel__copy">
              <TypewriterText
                key={stepKey}
                text={line}
                msPerChar={36}
                active={!rush}
                onComplete={() => setTyped(true)}
              />
            </span>
          ) : null}
          {phase === 'hold' && title ? (
            <span className="ch0-opening-reel__copy">
              <span className="ch0-opening-reel__title" key={stepKey}>
                {title}
                {subtitle ? <em>{subtitle}</em> : null}
              </span>
            </span>
          ) : null}
        </span>
        <span className={`ch0-opening-reel__veil${phase === 'out' ? ' is-out' : ' is-in'}`} />
      </button>
      {onSkip ? (
        <button type="button" className="ch0-opening-reel__skip" onClick={onSkip}>
          Bỏ qua
        </button>
      ) : null}
    </div>,
    document.body
  );
}
