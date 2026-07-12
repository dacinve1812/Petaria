import React, { useEffect, useRef, useState } from 'react';

/**
 * Chữ chạy từng ký tự.
 *
 * @param {object} props
 * @param {string} props.text
 * @param {number} [props.msPerChar=28]
 * @param {boolean} [props.active=true] — false = hiện full ngay
 * @param {() => void} [props.onComplete]
 * @param {string} [props.className]
 */
function TypewriterText({
  text = '',
  msPerChar = 28,
  active = true,
  onComplete,
  className = '',
}) {
  const full = String(text ?? '');
  const [shown, setShown] = useState(active ? '' : full);
  const doneRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    doneRef.current = false;
    if (!active) {
      setShown(full);
      if (!doneRef.current) {
        doneRef.current = true;
        onCompleteRef.current?.();
      }
      return undefined;
    }

    setShown('');
    if (!full) {
      doneRef.current = true;
      onCompleteRef.current?.();
      return undefined;
    }

    let i = 0;
    const speed = Math.max(8, Number(msPerChar) || 28);
    const id = window.setInterval(() => {
      i += 1;
      setShown(full.slice(0, i));
      if (i >= full.length) {
        window.clearInterval(id);
        if (!doneRef.current) {
          doneRef.current = true;
          onCompleteRef.current?.();
        }
      }
    }, speed);

    return () => window.clearInterval(id);
  }, [full, msPerChar, active]);

  return (
    <span className={className} aria-live="polite">
      {shown}
    </span>
  );
}

export default TypewriterText;
