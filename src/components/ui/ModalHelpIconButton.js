import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

const POPOVER_Z = 10050;

/** Giữ tâm popover (translate -50%) trong viewport; mobile margin rộng hơn. */
function clampPopoverCenterX(desiredCenterX, popoverWidth, viewportMargin) {
  const vw = window.innerWidth;
  const half = popoverWidth / 2;
  const minC = viewportMargin + half;
  const maxC = vw - viewportMargin - half;
  if (maxC < minC) return vw / 2;
  return Math.min(maxC, Math.max(minC, desiredCenterX));
}

/**
 * Nút "?" — click mở box info (portal + fixed, phía trên nút hoặc flip xuống nếu thiếu chỗ).
 * Không đụng overflow modal → giữ nguyên border-radius inventory-item-modal.
 */
function ModalHelpIconButton({
  infoText,
  infoContent,
  sectionEnd = false,
  ariaLabel = 'Xem thông tin',
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState(null);
  const wrapRef = useRef(null);
  const buttonRef = useRef(null);
  const popoverRef = useRef(null);

  const body = infoContent ?? infoText;

  const updatePopoverPosition = () => {
    const btn = buttonRef.current;
    const pop = popoverRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const gap = 8;
    const isMobile = window.innerWidth < 768;
    const viewportMargin = isMobile ? 14 : 10;
    const estimatedW = Math.min(280, Math.max(160, window.innerWidth - viewportMargin * 2));
    const popW = pop ? pop.getBoundingClientRect().width : estimatedW;

    let left = clampPopoverCenterX(r.left + r.width / 2, popW, viewportMargin);
    let top = r.top - gap;
    let transform = 'translate(-50%, -100%)';
    if (pop) {
      const ph = pop.getBoundingClientRect().height;
      if (r.top - ph - gap < 8) {
        top = r.bottom + gap;
        transform = 'translate(-50%, 0)';
      }
    }
    setPopoverStyle({
      position: 'fixed',
      left: `${left}px`,
      top: `${top}px`,
      transform,
      zIndex: POPOVER_Z,
    });
  };

  useLayoutEffect(() => {
    if (!open) {
      setPopoverStyle(null);
      return;
    }
    updatePopoverPosition();
    const raf = requestAnimationFrame(() => {
      updatePopoverPosition();
    });
    window.addEventListener('resize', updatePopoverPosition);
    window.addEventListener('scroll', updatePopoverPosition, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', updatePopoverPosition);
      window.removeEventListener('scroll', updatePopoverPosition, true);
    };
  }, [open, body]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e) => {
      if (wrapRef.current?.contains(e.target)) return;
      if (popoverRef.current?.contains(e.target)) return;
      setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown, { passive: true });

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const wrapClass = [
    'modal-help-icon-btn-wrap',
    sectionEnd && 'modal-help-icon-btn--section-end',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const popoverNode =
    open &&
    createPortal(
      <div
        ref={popoverRef}
        className="modal-help-icon-popover"
        role="dialog"
        aria-label={ariaLabel}
        style={popoverStyle || { position: 'fixed', left: -9999, top: -9999, zIndex: POPOVER_Z }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {body}
      </div>,
      document.body
    );

  return (
    <>
      <span ref={wrapRef} className={wrapClass}>
        <button
          ref={buttonRef}
          type="button"
          className="modal-help-icon-btn"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={ariaLabel}
        >
          ?
        </button>
      </span>
      {popoverNode}
    </>
  );
}

export default ModalHelpIconButton;
