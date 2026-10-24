import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useChapter0 } from './Chapter0Context';
import '../ui/storySpotlight.css';

export function storyButtonClass(active) {
  return active ? ' regionmap-button--story' : '';
}

function spotStyle(box, naturalWidth, naturalHeight) {
  const [x1, y1, x2, y2] = box;
  return {
    left: `${(Math.min(x1, x2) / naturalWidth) * 100}%`,
    top: `${(Math.min(y1, y2) / naturalHeight) * 100}%`,
    width: `${(Math.abs(x2 - x1) / naturalWidth) * 100}%`,
    height: `${(Math.abs(y2 - y1) / naturalHeight) * 100}%`,
  };
}

export function Chapter0CapitalSpots({ naturalWidth, naturalHeight, isMobile }) {
  const { story, postEvent, openQuestBoard } = useChapter0();
  const location = useLocation();
  const navigate = useNavigate();
  const capital = story?.guidance?.capital;
  const spot = capital ? story?.spotlights?.[capital] : null;
  const box = spot ? (isMobile ? spot.mobile : spot.desktop) : null;
  const spotRef = useRef(null);
  const boxKey = Array.isArray(box) ? box.join(',') : '';
  const board = story?.spotlights?.QUEST_BOARD;
  const boardBox = board ? (isMobile ? board.mobile : board.desktop) : null;
  const showQuietBoard = Boolean(
    story?.quest?.tracker && capital !== 'QUEST_BOARD' && boardBox && naturalWidth && naturalHeight
  );

  useEffect(() => {
    if (!isMobile || !spotRef.current) return undefined;
    spotRef.current.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
    return undefined;
  }, [isMobile, capital, boxKey]);

  if ((!box && !showQuietBoard) || !naturalWidth || !naturalHeight) return null;

  const go = () => {
    if (capital === 'QUEST_BOARD') {
      openQuestBoard();
      return;
    }
    if (capital === 'CAPITAL_PORT') {
      postEvent({ type: 'PORT_ARM', path: location.pathname });
      return;
    }
    if (spot?.route) navigate(spot.route);
  };

  const guidance = box ? (
    isMobile || capital === 'CAPITAL_PORT' || capital === 'QUEST_BOARD' ? (
      <button
        type="button"
        ref={spotRef}
        className="story-spot story-spot--hit"
        style={spotStyle(box, naturalWidth, naturalHeight)}
        data-story-target={
          capital === 'QUEST_BOARD'
            ? 'capital-quest'
            : (isMobile && String(story?.guidance?.lock || '').startsWith('capital-')
              ? story.guidance.lock
              : undefined)
        }
        aria-label={capital === 'QUEST_BOARD' ? 'Bảng nhiệm vụ' : (capital || 'Điểm trên bản đồ')}
        onClick={go}
      />
    ) : (
      <div className="story-spot" style={spotStyle(box, naturalWidth, naturalHeight)} aria-hidden />
    )
  ) : null;

  return (
    <>
      {guidance}
      {showQuietBoard ? (
        <button
          type="button"
          className="quest-board-spot"
          style={spotStyle(boardBox, naturalWidth, naturalHeight)}
          aria-label="Bảng nhiệm vụ"
          onClick={() => openQuestBoard()}
        />
      ) : null}
    </>
  );
}
