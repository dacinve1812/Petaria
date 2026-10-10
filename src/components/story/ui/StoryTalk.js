import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import './StoryTalk.css';

function Actor({ person }) {
  if (!person?.src) return <div className="ch0-talk__actor ch0-talk__actor--empty" />;
  return (
    <figure className={`ch0-talk__actor${person.speaking ? ' is-speaking' : ''}`}>
      <img src={person.src} alt="" />
      {person.speaking && person.name ? <span className="ch0-talk__name">{person.name}</span> : null}
    </figure>
  );
}

/**
 * Story talk — hai nhân vật và thanh thoại.
 * Chương sau truyền chân dung, câu chữ, lựa chọn hoặc một nút hành động.
 */
export default function StoryTalk({
  left,
  right,
  line = '',
  onAdvance,
  prompt = '',
  choices = [],
  onChoose,
  actionLabel = '',
  onAction,
  onSkip,
  onDismiss,
  blocking = false,
}) {
  const advanceLine = () => {
    if (line) onAdvance?.();
  };

  useEffect(() => {
    document.body.classList.add('ch0-talk-open');
    return () => document.body.classList.remove('ch0-talk-open');
  }, []);

  return createPortal(
    <div className={`ch0-talk${blocking ? ' ch0-talk--focus' : ''}`} role="dialog" aria-label="Hội thoại">
      <div className="ch0-talk__cast" onClick={advanceLine}>
        <Actor person={left} />
        <Actor person={right} />
      </div>
      <div className="ch0-talk__bar">
        {line ? (
          <button type="button" className="ch0-talk__line" onClick={onAdvance}>
            <span>{line}</span>
          </button>
        ) : null}
        {choices.length > 0 ? (
          <div className="ch0-talk__choices">
            {prompt ? <p>{prompt}</p> : null}
            {choices.map((option) => (
              <button key={option.id} type="button" onClick={() => onChoose?.(option)}>
                {option.text}
              </button>
            ))}
          </div>
        ) : null}
        {actionLabel ? (
          <button type="button" className="ch0-talk__action" onClick={onAction}>
            {actionLabel}
          </button>
        ) : null}
        {(onSkip || onDismiss) && choices.length === 0 ? (
          <div className="ch0-talk__tools">
            {onSkip ? <button type="button" onClick={onSkip}>Bỏ qua</button> : null}
            {onDismiss ? <button type="button" onClick={onDismiss}>Skip</button> : null}
          </div>
        ) : null}
        {line ? <span className="ch0-talk__chevron" aria-hidden /> : null}
      </div>
    </div>,
    document.body
  );
}
