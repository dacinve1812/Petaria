import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import TypewriterText from '../../ui/TypewriterText';
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
  const hasChoices = choices.length > 0;
  const spoken = line || prompt;
  const choiceKey = choices.map((option) => option.id).join('|');
  const [questionDone, setQuestionDone] = useState(!hasChoices);

  useEffect(() => {
    setQuestionDone(!hasChoices);
  }, [spoken, choiceKey, hasChoices]);

  const advanceLine = () => {
    if (hasChoices) {
      if (!questionDone) setQuestionDone(true);
      return;
    }
    if (spoken) onAdvance?.();
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
      <div className="ch0-talk__dock">
      {hasChoices && questionDone ? (
        <div className="ch0-talk__choices">
          {choices.map((option) => (
            <button key={option.id} type="button" className="ch0-talk__choice" onClick={() => onChoose?.(option)}>
              {option.text}
            </button>
          ))}
        </div>
      ) : null}
      <div className="ch0-talk__bar">
        {spoken ? (
          <button type="button" className="ch0-talk__line" onClick={advanceLine}>
            {hasChoices ? (
              <TypewriterText
                text={spoken}
                active={!questionDone}
                onComplete={() => setQuestionDone(true)}
              />
            ) : (
              <span>{spoken}</span>
            )}
          </button>
        ) : null}
        {actionLabel ? (
          <button type="button" className="ch0-talk__action" onClick={onAction}>
            {actionLabel}
          </button>
        ) : null}
        {(onSkip || onDismiss) && !hasChoices ? (
          <div className="ch0-talk__tools">
            {onSkip ? <button type="button" onClick={onSkip}>Bỏ qua</button> : null}
            {onDismiss ? <button type="button" onClick={onDismiss}>Skip</button> : null}
          </div>
        ) : null}
        {spoken && !(hasChoices && questionDone) ? <span className="ch0-talk__chevron" aria-hidden /> : null}
      </div>
      </div>
    </div>,
    document.body
  );
}
